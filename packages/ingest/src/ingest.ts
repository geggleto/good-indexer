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
// local delay util to avoid timers/promises typing in some environments

export type Subscription = { address?: string; topic0?: string };

export class IngestDaemon {
  private config: IngestConfig;
  private rpc: RpcReadClient;
  private orm!: MikroORM;
  private running = false;
  private bucketGetLogs: TokenBucket;
  private bucketBlockNumber: TokenBucket;
  private cb: CircuitBreaker;
  private registry: MetricsRegistry;
  private metrics: {
    rpcRequests: Counter;
    rpcErrors: Counter;
    getLogsDuration: Histogram;
    blockNumberDuration: Histogram;
    backlogGauge: Gauge;
    cbOpenSeconds: Gauge;
  };
  private metricsServer?: MetricsServer;

  constructor(config: IngestConfig) {
    this.config = config;
    this.rpc = new RpcReadClient(config.rpcReadUrl);
    this.bucketGetLogs = new TokenBucket(config.rpcRpsMaxGetLogs);
    this.bucketBlockNumber = new TokenBucket(config.rpcRpsMaxBlockNumber);
    this.cb = new CircuitBreaker();
    this.registry = new MetricsRegistry();
    this.metrics = {
      rpcRequests: this.registry.register(new Counter('rpc_requests_total', 'RPC requests by method')),
      rpcErrors: this.registry.register(new Counter('rpc_errors_total', 'RPC errors by method')),
      getLogsDuration: this.registry.register(new Histogram('getlogs_duration_ms', 'eth_getLogs duration ms')),
      blockNumberDuration: this.registry.register(new Histogram('blocknumber_duration_ms', 'eth_blockNumber duration ms')),
      backlogGauge: this.registry.register(new Gauge('indexer_backlog', 'Backlog blocks by shard')),
      cbOpenSeconds: this.registry.register(new Gauge('cb_open_seconds', 'Circuit breaker open seconds by pool')),
    };
  }

  async initOrm(): Promise<void> {
    const monorepoRoot = findRootSync(process.cwd()).rootDir;
    this.orm = await MikroORM.init({
      extensions: [pg.PostgreSqlDriver],
      clientUrl: this.config.dbUrl,
      entities: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      allowGlobalContext: true,
    } as any);
  }

  async start(shardLabel: string, subscriptions: Subscription[]): Promise<void> {
    if (!this.orm) await this.initOrm();
    this.running = true;
    const em = this.orm.em.fork();
    const conn = em.getConnection();
    const cursorId = `default:${shardLabel}`;

    // Expose metrics/health endpoints
    this.metricsServer = new MetricsServer(this.registry);
    this.metricsServer.start();

    // Ensure cursor row exists (idempotent)
    await conn.execute(
      `INSERT INTO infra.cursors (id, last_processed_block) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [cursorId, '0']
    );

    let step = this.config.getLogsStepInit;
    while (this.running) {
      try {
        await this.bucketBlockNumber.take();
        const t0 = Date.now();
        this.metrics.rpcRequests.inc({ method: 'blockNumber' });
        const head = await this.cb.execute(() => this.rpc.getBlockNumber(1000)).catch((e: unknown) => {
          this.metrics.rpcErrors.inc({ method: 'blockNumber' });
          this.metrics.blockNumberDuration.observe({ method: 'blockNumber' }, Date.now() - t0);
          throw e;
        });
        this.metrics.blockNumberDuration.observe({ method: 'blockNumber' }, Date.now() - t0);

        const rows = (await conn.execute(
          `SELECT last_processed_block FROM infra.cursors WHERE id = $1`,
          [cursorId]
        )) as Array<{ last_processed_block: string }>;
        const hwm = rows.length > 0 ? BigInt(rows[0].last_processed_block) : 0n;
        if (head >= hwm) {
          const backlog = Number(head - hwm);
          this.metrics.backlogGauge.set({ shard: shardLabel }, backlog);
        }
        // Update CB open seconds gauge for read pool
        this.metrics.cbOpenSeconds.set({ pool: 'read' }, this.cb.getOpenRemainingSeconds());

        if (head <= hwm) {
          await delay(this.config.pollIntervalMs);
          continue;
        }

        const from = hwm + 1n;
        const to = head < from + BigInt(step) - 1n ? head : from + BigInt(step) - 1n;

        const filters = buildFilters(subscriptions, from, to);
        const logsBatches = await Promise.all(
          filters.map(async (filter) => {
            await this.bucketGetLogs.take();
            const t1 = Date.now();
            this.metrics.rpcRequests.inc({ method: 'getLogs' });
            const res = await this.cb.execute(() => this.rpc.getLogs(filter, 15000)).catch((e: unknown) => {
              this.metrics.rpcErrors.inc({ method: 'getLogs' });
              this.metrics.getLogsDuration.observe({ method: 'getLogs' }, Date.now() - t1);
              throw e;
            });
            this.metrics.getLogsDuration.observe({ method: 'getLogs' }, Date.now() - t1);
            return res;
          })
        );
        const logs = logsBatches.flat();

        await this.insertBatch(em, logs, to, cursorId);

        // success: widen
        step = Math.min(step * 2, this.config.getLogsStepMax);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('ingest loop error', err);
        step = Math.max(Math.floor(step / 2), this.config.getLogsStepMin);
        await delay(this.config.pollIntervalMs);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  private async insertBatch(em: ReturnType<MikroORM['em']['fork']>, logs: Log[], to: bigint, cursorId: string): Promise<void> {
    if (logs.length === 0) {
      // Still bump cursor if empty range
      await em.getConnection().execute(this.buildCursorSql(cursorId, to));
      return;
    }

    // const knex = (em.getConnection() as any).getKnex();
    await em.getConnection().transactional(async (trx: any) => {
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
        .insert({ id: cursorId, last_processed_block: to.toString() })
        .onConflict('id')
        .merge({ last_processed_block: to.toString() });
    });
  }

  private buildCursorSql(id: string, to: bigint): string {
    return `INSERT INTO infra.cursors (id, last_processed_block) VALUES ('${id}', '${to.toString()}') ON CONFLICT (id) DO UPDATE SET last_processed_block = EXCLUDED.last_processed_block`;
  }
}

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
    topic0: log.topics[0] ?? '0x',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => (globalThis as any).setTimeout(resolve, ms));
}

