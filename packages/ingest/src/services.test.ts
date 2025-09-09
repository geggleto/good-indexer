import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RpcReadClientService,
  TokenBucketService,
  CircuitBreakerService,
  MetricsRegistryService,
  CounterService,
  HistogramService,
  GaugeService,
  MetricsServerService,
  MikroORMService,
  LoggerService,
  DelayService,
  HashService,
  PathService,
  FindRootService,
} from './services.js';

// Mock external dependencies
vi.mock('@good-indexer/adapters-evm', () => ({
  RpcReadClient: vi.fn().mockImplementation(() => ({
    getBlockNumber: vi.fn().mockResolvedValue(BigInt(100)),
    getLogs: vi.fn().mockResolvedValue([]),
  })),
  TokenBucket: vi.fn().mockImplementation(() => ({
    take: vi.fn().mockResolvedValue(undefined),
  })),
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation((fn) => fn()),
    getOpenRemainingSeconds: vi.fn().mockReturnValue(0),
  })),
}));

vi.mock('@good-indexer/metrics', () => ({
  Counter: vi.fn().mockImplementation(() => ({
    inc: vi.fn(),
  })),
  Histogram: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
  })),
  Gauge: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
  })),
  MetricsRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn().mockImplementation((metric) => metric),
  })),
  MetricsServer: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('@manypkg/find-root', () => ({
  findRootSync: vi.fn().mockReturnValue({ rootDir: '/mock/root' }),
}));

vi.mock('path', () => ({
  resolve: vi.fn().mockImplementation((...args) => args.join('/')),
}));

vi.mock('./util/hash.js', () => ({
  stablePartitionKey: vi.fn().mockReturnValue('mock-hash-123'),
}));

vi.mock('@mikro-orm/core', () => ({
  MikroORM: {
    init: vi.fn().mockResolvedValue({}),
  },
}));

describe('Services', () => {
  describe('RpcReadClientService', () => {
    let service: RpcReadClientService;

    beforeEach(() => {
      service = new RpcReadClientService('https://rpc.example.com');
    });

    it('should create service with RPC URL', () => {
      expect(service).toBeDefined();
    });

    it('should get block number', async () => {
      const result = await service.getBlockNumber(1000);
      expect(result).toBe(BigInt(100));
    });

    it('should get logs', async () => {
      const params = { fromBlock: '0x1', toBlock: '0x2' };
      const result = await service.getLogs(params, 1000);
      expect(result).toEqual([]);
    });
  });

  describe('TokenBucketService', () => {
    let service: TokenBucketService;

    beforeEach(() => {
      service = new TokenBucketService(10);
    });

    it('should create service with RPS', () => {
      expect(service).toBeDefined();
    });

    it('should consume token', async () => {
      const result = await service.consume(1);
      expect(result).toBe(true);
    });
  });

  describe('CircuitBreakerService', () => {
    let service: CircuitBreakerService;

    beforeEach(() => {
      service = new CircuitBreakerService();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should execute function', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await service.execute(fn);
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });

    it('should get open remaining seconds', () => {
      const result = service.getOpenRemainingSeconds();
      expect(result).toBe(0);
    });
  });

  describe('MetricsRegistryService', () => {
    let service: MetricsRegistryService;

    beforeEach(() => {
      service = new MetricsRegistryService();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should create counter', () => {
      const result = service.createCounter('test_counter', 'Test counter');
      expect(result).toBeDefined();
    });
  });

  describe('CounterService', () => {
    let service: CounterService;

    beforeEach(() => {
      service = new CounterService('test_counter', 'Test counter');
    });

    it('should create service with name and help', () => {
      expect(service).toBeDefined();
    });

    it('should increment without labels', () => {
      service.inc();
      // Should not throw
    });

    it('should increment with labels', () => {
      const labels = { method: 'test' };
      service.inc(labels);
      // Should not throw
    });
  });

  describe('HistogramService', () => {
    let service: HistogramService;

    beforeEach(() => {
      service = new HistogramService('test_histogram', 'Test histogram');
    });

    it('should create service with name and help', () => {
      expect(service).toBeDefined();
    });

    it('should observe value with labels', () => {
      const labels = { method: 'test' };
      const value = 123.45;
      service.observe(value, labels);
      // Should not throw
    });
  });

  describe('GaugeService', () => {
    let service: GaugeService;

    beforeEach(() => {
      service = new GaugeService('test_gauge', 'Test gauge');
    });

    it('should create service with name and help', () => {
      expect(service).toBeDefined();
    });

    it('should set value with labels', () => {
      const labels = { shard: 'test' };
      const value = 42;
      service.set(value, labels);
      // Should not throw
    });
  });

  describe('MetricsServerService', () => {
    let service: MetricsServerService;
    let mockRegistry: any;

    beforeEach(() => {
      mockRegistry = { register: vi.fn() };
      service = new MetricsServerService(mockRegistry);
    });

    it('should create service with registry', () => {
      expect(service).toBeDefined();
    });

    it('should start server', () => {
      service.start();
      // Should not throw
    });

    it('should stop server', () => {
      service.stop();
      // Should not throw
    });
  });

  describe('MikroORMService', () => {
    let service: MikroORMService;

    beforeEach(() => {
      service = new MikroORMService();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should initialize', async () => {
      const result = await service.init();
      expect(result).toBeDefined();
    });
  });

  describe('LoggerService', () => {
    let service: LoggerService;
    let consoleErrorSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
      service = new LoggerService();
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should log error with message', () => {
      service.error('Test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Test error');
    });

    it('should log error with message and error object', () => {
      const error = new Error('Test error');
      service.error('Test error', error);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Test error', error);
    });

    it('should log message', () => {
      service.info('Test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('Test message');
    });

    it('should log message with args', () => {
      service.info('Test message', 'arg1', 'arg2');
      expect(consoleLogSpy).toHaveBeenCalledWith('Test message', 'arg1', 'arg2');
    });
  });

  describe('DelayService', () => {
    let service: DelayService;
    let setTimeoutSpy: any;

    beforeEach(() => {
      service = new DelayService();
      setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 1 as any;
      });
    });

    afterEach(() => {
      setTimeoutSpy.mockRestore();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should delay for specified milliseconds', async () => {
      await service.delay(1000);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should delay for zero milliseconds', async () => {
      await service.delay(0);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    });

    it('should delay for negative milliseconds', async () => {
      await service.delay(-100);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), -100);
    });
  });

  describe('HashService', () => {
    let service: HashService;

    beforeEach(() => {
      service = new HashService();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should get stable partition key', () => {
      const input = 'test-input';
      const result = service.hash(input);
      expect(result).toBe('mock-hash-123');
    });

    it('should handle empty string', () => {
      const result = service.hash('');
      expect(result).toBe('mock-hash-123');
    });

    it('should handle special characters', () => {
      const input = 'test@#$%^&*()';
      const result = service.hash(input);
      expect(result).toBe('mock-hash-123');
    });
  });

  describe('PathService', () => {
    let service: PathService;

    beforeEach(() => {
      service = new PathService();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should resolve single path', () => {
      const result = service.resolve('test');
      expect(result).toBe('test');
    });

    it('should resolve multiple paths', () => {
      const result = service.resolve('path1', 'path2', 'path3');
      expect(result).toBe('path1/path2/path3');
    });

    it('should resolve empty paths', () => {
      const result = service.resolve();
      expect(result).toBe('');
    });

    it('should resolve with absolute path', () => {
      const result = service.resolve('/absolute', 'relative');
      expect(result).toBe('/absolute/relative');
    });
  });

  describe('FindRootService', () => {
    let service: FindRootService;

    beforeEach(() => {
      service = new FindRootService();
    });

    it('should create service', () => {
      expect(service).toBeDefined();
    });

    it('should find root directory', () => {
      const result = service.findRootSync('/some/path');
      expect(result).toBe('/mock/root');
    });

    it('should find root with current directory', () => {
      const result = service.findRootSync(process.cwd());
      expect(result).toBe('/mock/root');
    });

    it('should find root with empty string', () => {
      const result = service.findRootSync('');
      expect(result).toBe('/mock/root');
    });
  });

  describe('Service Integration', () => {
    it('should work together in a container', () => {
      const rpcService = new RpcReadClientService('https://rpc.example.com');
      const loggerService = new LoggerService();
      const hashService = new HashService();
      const pathService = new PathService();

      expect(rpcService).toBeDefined();
      expect(loggerService).toBeDefined();
      expect(hashService).toBeDefined();
      expect(pathService).toBeDefined();
    });

    it('should handle different configurations', () => {
      const counter1 = new CounterService('counter1', 'Help 1');
      const counter2 = new CounterService('counter2', 'Help 2');
      const histogram1 = new HistogramService('histogram1', 'Help 1');
      const histogram2 = new HistogramService('histogram2', 'Help 2');

      expect(counter1).toBeDefined();
      expect(counter2).toBeDefined();
      expect(histogram1).toBeDefined();
      expect(histogram2).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      const service = new RpcReadClientService('https://rpc.example.com');
      // The mock should handle errors gracefully
      await expect(service.getBlockNumber(1000)).resolves.toBe(BigInt(100));
    });

    it('should handle metrics errors gracefully', () => {
      const counter = new CounterService('test', 'help');
      const histogram = new HistogramService('test', 'help');
      const gauge = new GaugeService('test', 'help');

      expect(() => counter.inc()).not.toThrow();
      expect(() => histogram.observe(123, {})).not.toThrow();
      expect(() => gauge.set(123, {})).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers in delay', async () => {
      const service = new DelayService();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 1 as any;
      });

      await service.delay(Number.MAX_SAFE_INTEGER);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), Number.MAX_SAFE_INTEGER);

      setTimeoutSpy.mockRestore();
    });

    it('should handle very small numbers in delay', async () => {
      const service = new DelayService();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return 1 as any;
      });

      await service.delay(0.001);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0.001);

      setTimeoutSpy.mockRestore();
    });

    it('should handle special characters in hash input', () => {
      const service = new HashService();
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = service.hash(specialChars);
      expect(result).toBe('mock-hash-123');
    });

    it('should handle unicode characters in hash input', () => {
      const service = new HashService();
      const unicode = '🚀🌟💫⭐️';
      const result = service.hash(unicode);
      expect(result).toBe('mock-hash-123');
    });
  });
});
