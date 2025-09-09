import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configSchema } from './config.js';

describe('IngestConfig', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when no env vars are set', () => {
    // Clear all relevant env vars
    delete process.env.RPC_READ_URL;
    delete process.env.DB_URL;
    delete process.env.POLL_INTERVAL_MS;
    delete process.env.GETLOGS_STEP_INIT;
    delete process.env.GETLOGS_STEP_MIN;
    delete process.env.GETLOGS_STEP_MAX;
    delete process.env.RPC_RPS_MAX_GETLOGS;
    delete process.env.RPC_RPS_MAX_BLOCKNUMBER;
    delete process.env.ADDR_SHARDS;
    delete process.env.SUBSCRIPTIONS;

    const result = configSchema.safeParse({
      rpcReadUrl: 'https://example.com',
      dbUrl: 'postgresql://localhost:5432/test',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rpcReadUrl).toBe('https://example.com');
      expect(result.data.dbUrl).toBe('postgresql://localhost:5432/test');
      expect(result.data.pollIntervalMs).toBe(300);
      expect(result.data.getLogsStepInit).toBe(1000);
      expect(result.data.getLogsStepMin).toBe(500);
      expect(result.data.getLogsStepMax).toBe(20000);
      expect(result.data.rpcRpsMaxGetLogs).toBe(5);
      expect(result.data.rpcRpsMaxBlockNumber).toBe(10);
      expect(result.data.addrShards).toBe(1);
      expect(result.data.subscriptions).toEqual([]);
    }
  });


  it('should handle invalid subscriptions JSON gracefully', () => {
    process.env.SUBSCRIPTIONS = 'invalid-json';

    const result = configSchema.safeParse({
      rpcReadUrl: 'https://example.com',
      dbUrl: 'postgresql://localhost:5432/test',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscriptions).toEqual([]);
    }
  });

  it('should handle empty subscriptions string', () => {
    process.env.SUBSCRIPTIONS = '';

    const result = configSchema.safeParse({
      rpcReadUrl: 'https://example.com',
      dbUrl: 'postgresql://localhost:5432/test',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscriptions).toEqual([]);
    }
  });

  it('should handle non-array subscriptions JSON', () => {
    process.env.SUBSCRIPTIONS = '{"not": "an array"}';

    const result = configSchema.safeParse({
      rpcReadUrl: 'https://example.com',
      dbUrl: 'postgresql://localhost:5432/test',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscriptions).toEqual([]);
    }
  });

  it('should coerce string numbers to integers', () => {
    const result = configSchema.safeParse({
      rpcReadUrl: 'https://example.com',
      dbUrl: 'postgresql://localhost:5432/test',
      pollIntervalMs: '1000',
      getLogsStepInit: '5000',
      getLogsStepMin: '2000',
      getLogsStepMax: '100000',
      rpcRpsMaxGetLogs: '15',
      rpcRpsMaxBlockNumber: '25',
      addrShards: '8',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pollIntervalMs).toBe(1000);
      expect(result.data.getLogsStepInit).toBe(5000);
      expect(result.data.getLogsStepMin).toBe(2000);
      expect(result.data.getLogsStepMax).toBe(100000);
      expect(result.data.rpcRpsMaxGetLogs).toBe(15);
      expect(result.data.rpcRpsMaxBlockNumber).toBe(25);
      expect(result.data.addrShards).toBe(8);
    }
  });

  it('should validate URL format for rpcReadUrl', () => {
    const result = configSchema.safeParse({
      rpcReadUrl: 'not-a-valid-url',
    });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe('invalid_string');
      expect((result.error.issues[0] as any).validation).toBe('url');
    }
  });

  it('should validate minimum length for dbUrl', () => {
    const result = configSchema.safeParse({
      rpcReadUrl: 'https://example.com',
      dbUrl: '',
    });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe('too_small');
    }
  });

  it('should validate positive numbers', () => {
    const result = configSchema.safeParse({
      pollIntervalMs: -100,
      getLogsStepInit: 0,
      getLogsStepMin: -50,
    });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
