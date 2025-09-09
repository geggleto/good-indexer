import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BlockFetcher,
  LogFetcher,
  CursorManager,
  BatchProcessor,
  StepManager,
  IngestLoop,
  IngestDaemon,
  createIngestDaemon,
  buildFilters,
  buildEventRow,
  type DatabaseConnection,
  type EntityManager,
  type RpcClient,
  type TokenBucketService,
  type CircuitBreakerService,
  type MetricsService,
  type DelayService,
  type IngestConfig,
} from './ingest.js';

describe('BlockFetcher', () => {
  let mockRpc: RpcClient;
  let mockBucket: TokenBucketService;
  let mockCircuitBreaker: CircuitBreakerService;
  let mockMetrics: MetricsService;
  let blockFetcher: BlockFetcher;

  beforeEach(() => {
    mockRpc = {
      getBlockNumber: vi.fn().mockResolvedValue(12345n),
    };
    mockBucket = {
      take: vi.fn().mockResolvedValue(undefined),
    };
    mockCircuitBreaker = {
      execute: vi.fn().mockImplementation((fn) => fn()),
      getOpenRemainingSeconds: vi.fn().mockReturnValue(0),
    };
    mockMetrics = {
      rpcRequests: { inc: vi.fn() } as any,
      rpcErrors: { inc: vi.fn() } as any,
      getLogsDuration: { observe: vi.fn() } as any,
      blockNumberDuration: { observe: vi.fn() } as any,
      backlogGauge: { set: vi.fn() } as any,
      cbOpenSeconds: { set: vi.fn() } as any,
    };
    blockFetcher = new BlockFetcher(mockRpc, mockBucket, mockCircuitBreaker, mockMetrics);
  });

  describe('getCurrentBlock', () => {
    it('should fetch block number successfully', async () => {
      const result = await blockFetcher.getCurrentBlock();

      expect(mockBucket.take).toHaveBeenCalled();
      expect(mockMetrics.rpcRequests.inc).toHaveBeenCalledWith({ method: 'blockNumber' });
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
      expect(mockRpc.getBlockNumber).toHaveBeenCalledWith(1000);
      expect(mockMetrics.blockNumberDuration.observe).toHaveBeenCalledWith(
        { method: 'blockNumber' },
        expect.any(Number)
      );
      expect(result).toBe(12345n);
    });

    it('should handle RPC errors', async () => {
      const error = new Error('RPC failed');
      mockCircuitBreaker.execute.mockRejectedValueOnce(error);

      await expect(blockFetcher.getCurrentBlock()).rejects.toThrow('RPC failed');

      expect(mockMetrics.rpcErrors.inc).toHaveBeenCalledWith({ method: 'blockNumber' });
      expect(mockMetrics.blockNumberDuration.observe).toHaveBeenCalledWith(
        { method: 'blockNumber' },
        expect.any(Number)
      );
    });
  });
});

describe('LogFetcher', () => {
  let mockRpc: RpcClient;
  let mockBucket: TokenBucketService;
  let mockCircuitBreaker: CircuitBreakerService;
  let mockMetrics: MetricsService;
  let logFetcher: LogFetcher;

  beforeEach(() => {
    mockRpc = {
      getLogs: vi.fn().mockResolvedValue([]),
    };
    mockBucket = {
      take: vi.fn().mockResolvedValue(undefined),
    };
    mockCircuitBreaker = {
      execute: vi.fn().mockImplementation((fn) => fn()),
      getOpenRemainingSeconds: vi.fn().mockReturnValue(0),
    };
    mockMetrics = {
      rpcRequests: { inc: vi.fn() } as any,
      rpcErrors: { inc: vi.fn() } as any,
      getLogsDuration: { observe: vi.fn() } as any,
      blockNumberDuration: { observe: vi.fn() } as any,
      backlogGauge: { set: vi.fn() } as any,
      cbOpenSeconds: { set: vi.fn() } as any,
    };
    logFetcher = new LogFetcher(mockRpc, mockBucket, mockCircuitBreaker, mockMetrics);
  });

  describe('fetchLogs', () => {
    it('should fetch logs successfully', async () => {
      const mockLogs = [{ blockNumber: '0x1', logIndex: '0x0', transactionIndex: '0x0', blockHash: '0x123', address: '0xabc', topics: ['0xdef'] }];
      mockRpc.getLogs.mockResolvedValue(mockLogs);
      
      const filters = [
        { fromBlock: '0x1', toBlock: '0x2' },
        { fromBlock: '0x3', toBlock: '0x4' },
      ];

      const result = await logFetcher.fetchLogs(filters);

      expect(mockBucket.take).toHaveBeenCalledTimes(2);
      expect(mockMetrics.rpcRequests.inc).toHaveBeenCalledTimes(2);
      expect(mockRpc.getLogs).toHaveBeenCalledTimes(2);
      expect(mockMetrics.getLogsDuration.observe).toHaveBeenCalledTimes(2);
      expect(result).toEqual([...mockLogs, ...mockLogs]);
    });

    it('should handle RPC errors', async () => {
      const error = new Error('RPC failed');
      mockCircuitBreaker.execute.mockRejectedValueOnce(error);

      const filters = [{ fromBlock: '0x1', toBlock: '0x2' }];

      await expect(logFetcher.fetchLogs(filters)).rejects.toThrow('RPC failed');

      expect(mockMetrics.rpcErrors.inc).toHaveBeenCalledWith({ method: 'getLogs' });
      expect(mockMetrics.getLogsDuration.observe).toHaveBeenCalledWith(
        { method: 'getLogs' },
        expect.any(Number)
      );
    });
  });
});

describe('CursorManager', () => {
  let mockConnection: DatabaseConnection;
  let cursorManager: CursorManager;

  beforeEach(() => {
    mockConnection = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    cursorManager = new CursorManager(mockConnection);
  });

  describe('ensureCursorExists', () => {
    it('should insert cursor if not exists', async () => {
      await cursorManager.ensureCursorExists('test-cursor');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        `INSERT INTO infra.cursors (id, last_processed_block) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        ['test-cursor', '0']
      );
    });
  });

  describe('getLastProcessedBlock', () => {
    it('should return last processed block', async () => {
      mockConnection.execute.mockResolvedValueOnce([
        { last_processed_block: '12345' }
      ]);

      const result = await cursorManager.getLastProcessedBlock('test-cursor');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        `SELECT last_processed_block FROM infra.cursors WHERE id = $1`,
        ['test-cursor']
      );
      expect(result).toBe(12345n);
    });

    it('should return 0 if no cursor found', async () => {
      mockConnection.execute.mockResolvedValueOnce([]);

      const result = await cursorManager.getLastProcessedBlock('test-cursor');

      expect(result).toBe(0n);
    });
  });

  describe('updateCursor', () => {
    it('should update cursor with new block number', async () => {
      await cursorManager.updateCursor('test-cursor', 12345n);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        `INSERT INTO infra.cursors (id, last_processed_block) VALUES ('test-cursor', '12345') ON CONFLICT (id) DO UPDATE SET last_processed_block = EXCLUDED.last_processed_block`
      );
    });
  });
});

describe('BatchProcessor', () => {
  let mockConfig: IngestConfig;
  let mockCursorManager: CursorManager;
  let mockEntityManager: EntityManager;
  let batchProcessor: BatchProcessor;

  beforeEach(() => {
    mockConfig = {
      addrShards: 4,
    } as IngestConfig;
    mockCursorManager = {
      updateCursor: vi.fn().mockResolvedValue(undefined),
    } as any;
    mockEntityManager = {
      transactional: vi.fn().mockImplementation((fn) => fn({
        withSchema: vi.fn().mockReturnThis(),
        table: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        onConflict: vi.fn().mockReturnThis(),
        ignore: vi.fn().mockResolvedValue(undefined),
        merge: vi.fn().mockResolvedValue(undefined),
      })),
    } as any;
    batchProcessor = new BatchProcessor(mockConfig, mockCursorManager);
  });

  describe('processBatch', () => {
    it('should process empty batch by updating cursor', async () => {
      await batchProcessor.processBatch(mockEntityManager, [], 12345n, 'test-cursor');

      expect(mockCursorManager.updateCursor).toHaveBeenCalledWith('test-cursor', 12345n);
      expect(mockEntityManager.transactional).not.toHaveBeenCalled();
    });

    it('should process batch with logs', async () => {
      const mockLogs = [
        { blockNumber: '0x1', logIndex: '0x0', transactionIndex: '0x0', blockHash: '0x123', address: '0xabc', topics: ['0xdef'] }
      ];

      await batchProcessor.processBatch(mockEntityManager, mockLogs, 12345n, 'test-cursor');

      expect(mockEntityManager.transactional).toHaveBeenCalled();
      expect(mockCursorManager.updateCursor).not.toHaveBeenCalled();
    });
  });
});

describe('StepManager', () => {
  let mockConfig: IngestConfig;
  let stepManager: StepManager;

  beforeEach(() => {
    mockConfig = {
      getLogsStepInit: 100,
      getLogsStepMin: 10,
      getLogsStepMax: 1000,
    } as IngestConfig;
    stepManager = new StepManager(mockConfig);
  });

  describe('step management', () => {
    it('should start with initial step', () => {
      expect(stepManager.getCurrentStep()).toBe(100);
    });

    it('should widen step on success', () => {
      stepManager.widenStep();
      expect(stepManager.getCurrentStep()).toBe(200);
      
      stepManager.widenStep();
      expect(stepManager.getCurrentStep()).toBe(400);
    });

    it('should not exceed max step', () => {
      stepManager.widenStep(); // 200
      stepManager.widenStep(); // 400
      stepManager.widenStep(); // 800
      stepManager.widenStep(); // 1000 (max)
      stepManager.widenStep(); // still 1000
      expect(stepManager.getCurrentStep()).toBe(1000);
    });

    it('should narrow step on error', () => {
      stepManager.widenStep(); // 200
      stepManager.narrowStep();
      expect(stepManager.getCurrentStep()).toBe(100);
      
      stepManager.narrowStep();
      expect(stepManager.getCurrentStep()).toBe(50);
    });

    it('should not go below min step', () => {
      stepManager.narrowStep(); // 50
      stepManager.narrowStep(); // 25
      stepManager.narrowStep(); // 12
      stepManager.narrowStep(); // 10 (min)
      stepManager.narrowStep(); // still 10
      expect(stepManager.getCurrentStep()).toBe(10);
    });
  });

  describe('calculateRange', () => {
    it('should calculate range within step limit', () => {
      const result = stepManager.calculateRange(100n, 250n);
      expect(result).toEqual({ from: 100n, to: 199n });
    });

    it('should limit range to head block', () => {
      const result = stepManager.calculateRange(100n, 120n);
      expect(result).toEqual({ from: 100n, to: 120n });
    });
  });
});

describe('IngestLoop', () => {
  let mockBlockFetcher: BlockFetcher;
  let mockLogFetcher: LogFetcher;
  let mockCursorManager: CursorManager;
  let mockBatchProcessor: BatchProcessor;
  let mockStepManager: StepManager;
  let mockMetrics: MetricsService;
  let mockDelayService: DelayService;
  let mockConfig: IngestConfig;
  let ingestLoop: IngestLoop;

  beforeEach(() => {
    mockBlockFetcher = {
      getCurrentBlock: vi.fn().mockResolvedValue(1000n),
    } as any;
    mockLogFetcher = {
      fetchLogs: vi.fn().mockResolvedValue([]),
    } as any;
    mockCursorManager = {
      ensureCursorExists: vi.fn().mockResolvedValue(undefined),
      getLastProcessedBlock: vi.fn().mockResolvedValue(500n),
    } as any;
    mockBatchProcessor = {
      processBatch: vi.fn().mockResolvedValue(undefined),
    } as any;
    mockStepManager = {
      calculateRange: vi.fn().mockReturnValue({ from: 501n, to: 600n }),
      widenStep: vi.fn(),
      narrowStep: vi.fn(),
    } as any;
    mockMetrics = {
      backlogGauge: { set: vi.fn() } as any,
    } as any;
    mockDelayService = {
      delay: vi.fn().mockResolvedValue(undefined),
    } as any;
    mockConfig = {
      pollIntervalMs: 1000,
    } as IngestConfig;

    ingestLoop = new IngestLoop(
      mockBlockFetcher,
      mockLogFetcher,
      mockCursorManager,
      mockBatchProcessor,
      mockStepManager,
      mockMetrics,
      mockDelayService,
      mockConfig
    );
  });

  describe('runLoop', () => {
    it('should run complete ingest cycle', async () => {
      // Mock the getEntityManager method
      const mockEntityManager = {
        getConnection: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([]),
        }),
        transactional: vi.fn().mockImplementation((fn) => fn({})),
      };
      ingestLoop['getEntityManager'] = vi.fn().mockReturnValue(mockEntityManager);

      let callCount = 0;
      const shouldContinue = () => {
        callCount++;
        return callCount < 2; // Stop after 1 iteration
      };

      await ingestLoop.runLoop('test-shard', [], shouldContinue);

      expect(mockCursorManager.ensureCursorExists).toHaveBeenCalledWith('default:test-shard');
      expect(mockBlockFetcher.getCurrentBlock).toHaveBeenCalled();
      expect(mockCursorManager.getLastProcessedBlock).toHaveBeenCalledWith('default:test-shard');
      expect(mockLogFetcher.fetchLogs).toHaveBeenCalled();
      expect(mockBatchProcessor.processBatch).toHaveBeenCalled();
      expect(mockStepManager.widenStep).toHaveBeenCalled();
    });

    it('should delay when no new blocks', async () => {
      mockBlockFetcher.getCurrentBlock.mockResolvedValueOnce(500n); // Same as hwm
      mockCursorManager.getLastProcessedBlock.mockResolvedValueOnce(500n);

      let callCount = 0;
      const shouldContinue = () => {
        callCount++;
        return callCount < 2; // Stop after 1 iteration
      };

      await ingestLoop.runLoop('test-shard', [], shouldContinue);

      expect(mockDelayService.delay).toHaveBeenCalledWith(1000);
      expect(mockLogFetcher.fetchLogs).not.toHaveBeenCalled();
    });

    it('should handle errors and narrow step', async () => {
      mockBlockFetcher.getCurrentBlock.mockRejectedValueOnce(new Error('RPC failed'));

      let callCount = 0;
      const shouldContinue = () => {
        callCount++;
        return callCount < 2; // Stop after 1 iteration
      };

      await ingestLoop.runLoop('test-shard', [], shouldContinue);

      expect(mockStepManager.narrowStep).toHaveBeenCalled();
      expect(mockDelayService.delay).toHaveBeenCalledWith(1000);
    });
  });
});

describe('IngestDaemon', () => {
  let mockConfig: IngestConfig;
  let mockDependencies: any;
  let daemon: IngestDaemon;

  beforeEach(() => {
    mockConfig = {
      dbUrl: 'postgresql://localhost:5432/test',
      rpcReadUrl: 'http://localhost:8545',
      rpcRpsMaxGetLogs: 10,
      rpcRpsMaxBlockNumber: 5,
      addrShards: 4,
      getLogsStepInit: 100,
      getLogsStepMin: 10,
      getLogsStepMax: 1000,
      pollIntervalMs: 1000,
    } as IngestConfig;

    mockDependencies = {
      findRootSync: vi.fn().mockReturnValue({ rootDir: '/mock/root' }),
      resolve: vi.fn().mockImplementation((...args) => args.join('/')),
      delay: vi.fn().mockResolvedValue(undefined),
    };

    daemon = new IngestDaemon(mockConfig, mockDependencies);
  });

  describe('Constructor', () => {
    it('should create daemon with config', () => {
      expect(daemon).toBeDefined();
      expect(daemon.isRunning).toBe(false);
    });
  });

  describe('initOrm', () => {
    it('should initialize ORM with correct configuration', async () => {
      const mockOrm = {
        em: {
          fork: vi.fn().mockReturnValue({
            getConnection: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([]),
            }),
            transactional: vi.fn().mockImplementation((fn) => fn({})),
          }),
        },
      };

      // Mock MikroORM.init
      const originalMikroORM = await import('@mikro-orm/core');
      const mockInit = vi.fn().mockResolvedValue(mockOrm);
      vi.spyOn(originalMikroORM.MikroORM, 'init').mockImplementation(mockInit);

      // Mock RpcReadClient to avoid real network calls
      const originalRpcReadClient = await import('@good-indexer/adapters-evm');
      const mockRpcReadClient = vi.fn().mockImplementation(() => ({
        getBlockNumber: vi.fn().mockResolvedValue(1000n),
        getLogs: vi.fn().mockResolvedValue([]),
      }));
      vi.spyOn(originalRpcReadClient, 'RpcReadClient').mockImplementation(mockRpcReadClient as any);

      await daemon.initOrm();

      expect(mockDependencies.findRootSync).toHaveBeenCalledWith(process.cwd());
      expect(mockInit).toHaveBeenCalledWith({
        driver: expect.anything(),
        clientUrl: 'postgresql://localhost:5432/test',
        entities: ['/mock/root/packages/storage-postgres/src/entities'],
        entitiesTs: ['/mock/root/packages/storage-postgres/src/entities'],
        allowGlobalContext: true,
      });
    });
  });

  describe('stop', () => {
    it('should set running to false', () => {
      daemon.stop();
      expect(daemon.isRunning).toBe(false);
    });
  });
});

describe('createIngestDaemon', () => {
  it('should create daemon with factory function', () => {
    const config = { dbUrl: 'postgresql://localhost:5432/test' } as IngestConfig;
    const daemon = createIngestDaemon(config);
    expect(daemon).toBeDefined();
  });

  it('should create daemon with custom dependencies', () => {
    const config = { dbUrl: 'postgresql://localhost:5432/test' } as IngestConfig;
    const dependencies = {
      delay: vi.fn().mockResolvedValue(undefined),
    };
    const daemon = createIngestDaemon(config, dependencies);
    expect(daemon).toBeDefined();
  });
});

describe('Utility Functions', () => {
  describe('buildFilters', () => {
    it('should build filters for empty subscriptions', () => {
      const result = buildFilters([], 100n, 200n);
      expect(result).toEqual([
        {
          fromBlock: '0x64',
          toBlock: '0xc8',
        },
      ]);
    });

    it('should build filters for subscriptions', () => {
      const subscriptions = [
        { address: '0xabc', topic0: '0xdef' },
        { address: '0x123' },
      ];
      const result = buildFilters(subscriptions, 100n, 200n);
      expect(result).toEqual([
        {
          fromBlock: '0x64',
          toBlock: '0xc8',
          address: '0xabc',
          topics: ['0xdef'],
        },
        {
          fromBlock: '0x64',
          toBlock: '0xc8',
          address: '0x123',
          topics: undefined,
        },
      ]);
    });
  });

  describe('buildEventRow', () => {
    it('should build event row from log', () => {
      const log = {
        blockNumber: '0x1',
        logIndex: '0x0',
        transactionIndex: '0x0',
        blockHash: '0x123',
        address: '0xabc',
        topics: ['0xdef'],
      };
      const result = buildEventRow(log, 4);
      
      expect(result).toEqual({
        event_id: '0x123:1:0:0',
        block_number: '1',
        block_hash: '0x123',
        address: '0xabc',
        topic0: '0xdef',
        partition_key: expect.any(String),
        payload: log,
      });
    });

    it('should handle undefined topics', () => {
      const log = {
        blockNumber: '0x1',
        logIndex: '0x0',
        transactionIndex: '0x0',
        blockHash: '0x123',
        address: '0xabc',
        topics: undefined,
      };
      const result = buildEventRow(log, 4);
      
      expect(result.topic0).toBe('0x');
    });
  });
});
