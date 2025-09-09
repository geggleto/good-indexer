/// <reference types="node" />
import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { resolve } from 'path';
import { findRootSync } from '@manypkg/find-root';
import { RpcReadClient, bigIntToHex, Log, GetLogsParams } from '@good-indexer/adapters-evm';
import { IngestConfig } from './config.js';
import { stablePartitionKey } from './util/hash.js';
import { TokenBucket, CircuitBreaker } from '@good-indexer/adapters-evm';
import { Counter, Histogram, Gauge, MetricsRegistry, MetricsServer } from '@good-indexer/metrics';

export type Subscription = { address?: string; topic0?: string };

// Interfaces for better testability
export interface DatabaseConnection {
  execute(query: string, params?: any[]): Promise<any>;
}

export interface EntityManager {
  getConnection(): DatabaseConnection;
  transactional<T>(fn: (trx: any) => Promise<T>): Promise<T>;
}

export interface MikroORMInstance {
  em: {
    fork(): EntityManager;
  };
}

export interface RpcClient {
  getBlockNumber(timeout: number): Promise<bigint>;
  getLogs(params: GetLogsParams, timeout: number): Promise<Log[]>;
}

export interface TokenBucketService {
  take(): Promise<void>;
}

export interface CircuitBreakerService {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getOpenRemainingSeconds(): number;
}

export interface MetricsService {
  rpcRequests: Counter;
  rpcErrors: Counter;
  getLogsDuration: Histogram;
  blockNumberDuration: Histogram;
  backlogGauge: Gauge;
  cbOpenSeconds: Gauge;
}

export interface MetricsServerService {
  start(): void;
}

export interface DelayService {
  delay(ms: number): Promise<void>;
}

export interface PathService {
  resolve(...paths: string[]): string;
}

export interface FindRootService {
  findRootSync(cwd: string): { rootDir: string };
}

// Block fetcher for getting current block number
export class BlockFetcher {
  constructor(
    private rpc: RpcClient,
    private bucket: TokenBucketService,
    private circuitBreaker: CircuitBreakerService,
    private metrics: MetricsService
  ) {}

  async getCurrentBlock(): Promise<bigint> {
    await this.bucket.take();
    const t0 = Date.now();
    this.metrics.rpcRequests.inc({ method: 'blockNumber' });
    
    try {
      const head = await this.circuitBreaker.execute(() => this.rpc.getBlockNumber(1000));
      this.metrics.blockNumberDuration.observe({ method: 'blockNumber' }, Date.now() - t0);
      return head;
    } catch (e: unknown) {
      this.metrics.rpcErrors.inc({ method: 'blockNumber' });
      this.metrics.blockNumberDuration.observe({ method: 'blockNumber' }, Date.now() - t0);
      throw e;
    }
  }
}

// Log fetcher for getting logs from RPC
export class LogFetcher {
  constructor(
    private rpc: RpcClient,
    private bucket: TokenBucketService,
    private circuitBreaker: CircuitBreakerService,
    private metrics: MetricsService
  ) {}

  async fetchLogs(filters: GetLogsParams[]): Promise<Log[]> {
    const logsBatches = await Promise.all(
      filters.map(async (filter) => {
        await this.bucket.take();
        const t1 = Date.now();
        this.metrics.rpcRequests.inc({ method: 'getLogs' });
        
        try {
          const res = await this.circuitBreaker.execute(() => this.rpc.getLogs(filter, 15000));
          this.metrics.getLogsDuration.observe({ method: 'getLogs' }, Date.now() - t1);
          return res;
        } catch (e: unknown) {
          this.metrics.rpcErrors.inc({ method: 'getLogs' });
          this.metrics.getLogsDuration.observe({ method: 'getLogs' }, Date.now() - t1);
          throw e;
        }
      })
    );
    return logsBatches.flat();
  }
}

// Cursor manager for handling database cursor operations
export class CursorManager {
  constructor(private connection: DatabaseConnection) {}

  async ensureCursorExists(cursorId: string): Promise<void> {
    await this.connection.execute(
      `INSERT INTO infra.cursors (id, last_processed_block) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [cursorId, '0']
    );
  }

  async getLastProcessedBlock(cursorId: string): Promise<bigint> {
    const rows = (await this.connection.execute(
      `SELECT last_processed_block FROM infra.cursors WHERE id = $1`,
      [cursorId]
    )) as Array<{ last_processed_block: string }>;
    return rows.length > 0 ? BigInt(rows[0].last_processed_block) : 0n;
  }

  async updateCursor(cursorId: string, blockNumber: bigint): Promise<void> {
    await this.connection.execute(
      `INSERT INTO infra.cursors (id, last_processed_block) VALUES ('${cursorId}', '${blockNumber.toString()}') ON CONFLICT (id) DO UPDATE SET last_processed_block = EXCLUDED.last_processed_block`
    );
  }
}

// Batch processor for handling log insertion
export class BatchProcessor {
  constructor(
    private config: IngestConfig,
    private cursorManager: CursorManager
  ) {}

  async processBatch(
    em: EntityManager,
    logs: Log[],
    toBlock: bigint,
    cursorId: string
  ): Promise<void> {
    if (logs.length === 0) {
      // Still bump cursor if empty range
      await this.cursorManager.updateCursor(cursorId, toBlock);
      return;
    }

    await em.transactional(async (trx: any) => {
      const eventsRows = logs.map((log) => buildEventRow(log, this.config.addrShards));
      
      // Insert ingest_events with ON CONFLICT DO NOTHING
      await trx
        .withSchema('infra')
        .table('ingest_events')
        .insert(eventsRows)
        .onConflict('event_id')
        .ignore();

      // Insert ingest_outbox for each event (same ids), also idempotent
      const outboxRows = eventsRows.map((e) => ({ event_id: e.event_id }));
      await trx
        .withSchema('infra')
        .table('ingest_outbox')
        .insert(outboxRows)
        .onConflict('event_id')
        .ignore();

      // Bump cursor to `to`
      await trx
        .withSchema('infra')
        .table('cursors')
        .insert({ id: cursorId, last_processed_block: toBlock.toString() })
        .onConflict('id')
        .merge({ last_processed_block: toBlock.toString() });
    });
  }
}

// Step manager for handling adaptive step sizing
export class StepManager {
  constructor(private config: IngestConfig) {}

  private currentStep = this.config.getLogsStepInit;

  getCurrentStep(): number {
    return this.currentStep;
  }

  widenStep(): void {
    this.currentStep = Math.min(this.currentStep * 2, this.config.getLogsStepMax);
  }

  narrowStep(): void {
    this.currentStep = Math.max(Math.floor(this.currentStep / 2), this.config.getLogsStepMin);
  }

  calculateRange(from: bigint, head: bigint): { from: bigint; to: bigint } {
    const to = head < from + BigInt(this.currentStep) - 1n ? head : from + BigInt(this.currentStep) - 1n;
    return { from, to };
  }
}

// Main ingest loop orchestrator
export class IngestLoop {
  constructor(
    private blockFetcher: BlockFetcher,
    private logFetcher: LogFetcher,
    private cursorManager: CursorManager,
    private batchProcessor: BatchProcessor,
    private stepManager: StepManager,
    private metrics: MetricsService,
    private delayService: DelayService,
    private config: IngestConfig
  ) {}

  async runLoop(
    shardLabel: string,
    subscriptions: Subscription[],
    shouldContinue: () => boolean
  ): Promise<void> {
    const cursorId = `default:${shardLabel}`;
    
    // Ensure cursor exists
    await this.cursorManager.ensureCursorExists(cursorId);

    while (shouldContinue()) {
      try {
        // Get current block
        const head = await this.blockFetcher.getCurrentBlock();
        
        // Get last processed block
        const hwm = await this.cursorManager.getLastProcessedBlock(cursorId);
        
        // Update metrics
        if (head >= hwm) {
          const backlog = Number(head - hwm);
          this.metrics.backlogGauge.set({ shard: shardLabel }, backlog);
        }

        if (head <= hwm) {
          await this.delayService.delay(this.config.pollIntervalMs);
          continue;
        }

        // Calculate range to process
        const from = hwm + 1n;
        const { to } = this.stepManager.calculateRange(from, head);

        // Build filters and fetch logs
        const filters = buildFilters(subscriptions, from, to);
        const logs = await this.logFetcher.fetchLogs(filters);

        // Process batch
        const em = this.getEntityManager(); // This will need to be injected
        await this.batchProcessor.processBatch(em, logs, to, cursorId);

        // Success: widen step
        this.stepManager.widenStep();
      } catch (err) {
        console.error('ingest loop error', err);
        this.stepManager.narrowStep();
        await this.delayService.delay(this.config.pollIntervalMs);
      }
    }
  }

  private getEntityManager(): EntityManager {
    // This will be injected in the main class
    throw new Error('EntityManager not injected');
  }
}

// Refactored IngestDaemon
export class IngestDaemon {
  private orm!: MikroORMInstance;
  private running = false;
  private blockFetcher!: BlockFetcher;
  private logFetcher!: LogFetcher;
  private cursorManager!: CursorManager;
  private batchProcessor!: BatchProcessor;
  private stepManager!: StepManager;
  private ingestLoop!: IngestLoop;
  private metricsServer?: MetricsServerService;

  constructor(
    private config: IngestConfig,
    private dependencies: {
      findRootSync: FindRootService['findRootSync'];
      resolve: PathService['resolve'];
      delay: DelayService['delay'];
    } = {
      findRootSync,
      resolve,
      delay: (ms: number) => new Promise((resolve) => (globalThis as any).setTimeout(resolve, ms)),
    }
  ) {}

  async initOrm(): Promise<void> {
    const monorepoRoot = this.dependencies.findRootSync(process.cwd()).rootDir;
    this.orm = await MikroORM.init({
      driver: pg.PostgreSqlDriver,
      clientUrl: this.config.dbUrl,
      entities: [this.dependencies.resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [this.dependencies.resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      allowGlobalContext: true,
    } as any) as MikroORMInstance;

    // Initialize components
    const rpc = new RpcReadClient(this.config.rpcReadUrl);
    const bucketGetLogs = new TokenBucket(this.config.rpcRpsMaxGetLogs);
    const bucketBlockNumber = new TokenBucket(this.config.rpcRpsMaxBlockNumber);
    const cb = new CircuitBreaker();
    const registry = new MetricsRegistry();
    const metrics = {
      rpcRequests: registry.register(new Counter('rpc_requests_total', 'RPC requests by method')),
      rpcErrors: registry.register(new Counter('rpc_errors_total', 'RPC errors by method')),
      getLogsDuration: registry.register(new Histogram('getlogs_duration_ms', 'eth_getLogs duration ms')),
      blockNumberDuration: registry.register(new Histogram('blocknumber_duration_ms', 'eth_blockNumber duration ms')),
      backlogGauge: registry.register(new Gauge('indexer_backlog', 'Backlog blocks by shard')),
      cbOpenSeconds: registry.register(new Gauge('cb_open_seconds', 'Circuit breaker open seconds by pool')),
    };

    const em = this.orm.em.fork();
    const connection = em.getConnection();

    this.blockFetcher = new BlockFetcher(rpc, bucketBlockNumber, cb, metrics);
    this.logFetcher = new LogFetcher(rpc, bucketGetLogs, cb, metrics);
    this.cursorManager = new CursorManager(connection);
    this.batchProcessor = new BatchProcessor(this.config, this.cursorManager);
    this.stepManager = new StepManager(this.config);
    this.ingestLoop = new IngestLoop(
      this.blockFetcher,
      this.logFetcher,
      this.cursorManager,
      this.batchProcessor,
      this.stepManager,
      metrics,
      { delay: this.dependencies.delay },
      this.config
    );

    // Override the getEntityManager method
    this.ingestLoop['getEntityManager'] = () => this.orm.em.fork();
  }

  async start(shardLabel: string, subscriptions: Subscription[]): Promise<void> {
    if (!this.orm) await this.initOrm();
    this.running = true;

    // Expose metrics/health endpoints
    const registry = new MetricsRegistry();
    this.metricsServer = new MetricsServer(registry);
    this.metricsServer.start();

    await this.ingestLoop.runLoop(shardLabel, subscriptions, () => this.running);
  }

  stop(): void {
    this.running = false;
  }

  // Getters for testing
  get isRunning(): boolean {
    return this.running;
  }

  get blockFetcherInstance(): BlockFetcher {
    return this.blockFetcher;
  }

  get logFetcherInstance(): LogFetcher {
    return this.logFetcher;
  }

  get cursorManagerInstance(): CursorManager {
    return this.cursorManager;
  }

  get batchProcessorInstance(): BatchProcessor {
    return this.batchProcessor;
  }

  get stepManagerInstance(): StepManager {
    return this.stepManager;
  }

  get ingestLoopInstance(): IngestLoop {
    return this.ingestLoop;
  }
}

// Utility functions (unchanged)
export function buildFilters(subs: Subscription[], from: bigint, to: bigint): GetLogsParams[] {
  if (subs.length === 0) {
    return [
      {
        fromBlock: bigIntToHex(from),
        toBlock: bigIntToHex(to),
      },
    ];
  }
  return subs.map((s) => ({
    fromBlock: bigIntToHex(from),
    toBlock: bigIntToHex(to),
    address: s.address as any,
    topics: s.topic0 ? [s.topic0] : undefined,
  }));
}

export function buildEventRow(log: Log, addrShards: number): {
  event_id: string;
  block_number: string;
  block_hash: string;
  address: string;
  topic0: string;
  partition_key: string;
  payload: unknown;
} {
  const blockNumber = BigInt(log.blockNumber);
  const logIndex = BigInt(log.logIndex);
  const txIndex = BigInt(log.transactionIndex);
  const eventId = `${log.blockHash}:${blockNumber}:${txIndex}:${logIndex}`;
  const partitionKey = computePartitionKey(log.address, addrShards);
  return {
    event_id: eventId,
    block_number: blockNumber.toString(),
    block_hash: log.blockHash,
    address: log.address,
    topic0: log.topics?.[0] ?? '0x',
    partition_key: partitionKey,
    payload: log,
  };
}

function computePartitionKey(address: string, shards: number): string {
  const hex = stablePartitionKey(address.toLowerCase());
  if (shards <= 1) return hex;
  const n = Number(BigInt('0x' + hex.slice(0, 8)) % BigInt(shards));
  return `${n}:${hex}`;
}

// Factory function for easier testing
export function createIngestDaemon(
  config: IngestConfig,
  dependencies?: Partial<{
    findRootSync: FindRootService['findRootSync'];
    resolve: PathService['resolve'];
    delay: DelayService['delay'];
  }>
): IngestDaemon {
  return new IngestDaemon(config, {
    findRootSync,
    resolve,
    delay: (ms: number) => new Promise((resolve) => (globalThis as any).setTimeout(resolve, ms)),
    ...dependencies,
  });
}
