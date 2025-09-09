import { describe, it, expect } from 'vitest';
import { buildFilters, buildEventRow } from './ingest.js';
import { stablePartitionKey } from './util/hash.js';

describe('buildFilters', () => {
  it('builds single catch-all filter when no subs', () => {
    const f = buildFilters([], 1n, 10n);
    expect(f).toEqual([
      {
        fromBlock: '0x1',
        toBlock: '0xa',
      },
    ]);
  });

  it('builds filters per subscription', () => {
    const subs = [
      { address: '0xabc', topic0: '0x1' },
      { address: '0xdef' },
    ];
    const f = buildFilters(subs, 2n, 3n);
    expect(f).toEqual([
      { fromBlock: '0x2', toBlock: '0x3', address: '0xabc', topics: ['0x1'] },
      { fromBlock: '0x2', toBlock: '0x3', address: '0xdef', topics: undefined },
    ]);
  });
});

describe('buildEventRow', () => {
  it('derives deterministic event row fields', () => {
    const log = {
      address: '0xAaa',
      blockHash: '0xdead',
      blockNumber: '0x10',
      data: '0x',
      logIndex: '0x2',
      topics: ['0xfeed'],
      transactionHash: '0x',
      transactionIndex: '0x1',
    } as any;
    const row = buildEventRow(log, 4);
    expect(row.block_number).toBe((16n).toString());
    expect(row.topic0).toBe('0xfeed');
    expect(row.address).toBe('0xAaa');
    expect(typeof row.partition_key).toBe('string');
    expect(row.event_id).toContain('0xdead');
  });
});

describe('stablePartitionKey', () => {
  it('is stable for same input and different for different input', () => {
    const a1 = stablePartitionKey('hello');
    const a2 = stablePartitionKey('hello');
    const b = stablePartitionKey('world');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toHaveLength(64);
  });
});

