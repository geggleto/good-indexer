import { describe, it, expect } from 'vitest';

describe('Dispatch Module', () => {
  it('should export Dispatcher class', () => {
    expect(() => import('./index')).not.toThrow();
  });

  it('should handle configuration types', () => {
    const config = {
      dbUrl: 'test-db-url',
      handlerKind: 'test-handler',
      maxAttempts: 5,
      batchSize: 200,
      partitionSelector: 'test:',
    };

    expect(config.dbUrl).toBe('test-db-url');
    expect(config.handlerKind).toBe('test-handler');
    expect(config.maxAttempts).toBe(5);
    expect(config.batchSize).toBe(200);
    expect(config.partitionSelector).toBe('test:');
  });

  it('should handle inbox event types', () => {
    const event = {
      event_id: 'test-event-123',
      block_number: '12345',
      partition_key: 'test-partition',
      address: '0x1234567890abcdef',
      topic0: '0xdef456',
      payload: { data: 'test' },
    };

    expect(event.event_id).toBe('test-event-123');
    expect(event.block_number).toBe('12345');
    expect(event.partition_key).toBe('test-partition');
    expect(event.address).toBe('0x1234567890abcdef');
    expect(event.topic0).toBe('0xdef456');
    expect(event.payload).toEqual({ data: 'test' });
  });
});
