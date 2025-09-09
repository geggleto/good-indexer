import { describe, it, expect, vi } from 'vitest';
import { vi } from 'vitest';
vi.mock('viem', () => {
  return {
    createPublicClient: vi.fn(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(123n),
      request: vi.fn().mockResolvedValue([]),
    })),
    http: vi.fn(() => ({})),
  } as any;
});
import { RpcReadClient, bigIntToHex } from './rpc.js';

describe('rpc helpers', () => {
  it('bigIntToHex converts correctly', () => {
    expect(bigIntToHex(0n)).toBe('0x0');
    expect(bigIntToHex(15n)).toBe('0xF'.toLowerCase());
    expect(bigIntToHex(255n)).toBe('0xff');
  });

  it('RpcReadClient forwards getBlockNumber', async () => {
    const client = new RpcReadClient('https://example');
    const n = await client.getBlockNumber(1000);
    expect(n).toBe(123n);
    // ensure factory was called
    const mod = await import('viem');
    expect((mod as any).createPublicClient).toHaveBeenCalled();
  });

  it('RpcReadClient forwards getLogs', async () => {
    const mod = await import('viem');
    (mod as any).createPublicClient.mockReturnValueOnce({
      getBlockNumber: vi.fn(),
      request: vi.fn().mockResolvedValue([
        { address: '0x', blockHash: '0x', blockNumber: '0x1', data: '0x', logIndex: '0x0', topics: [], transactionHash: '0x', transactionIndex: '0x0' },
      ]),
    });
    const client = new RpcReadClient('https://example');
    const res = await client.getLogs({ fromBlock: '0x1', toBlock: '0x2' }, 5000);
    expect(Array.isArray(res)).toBe(true);
    expect((mod as any).createPublicClient).toHaveBeenCalled();
  });
});

