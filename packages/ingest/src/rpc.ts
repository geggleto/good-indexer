import { createPublicClient, http } from 'viem';

export type GetLogsParams = {
  fromBlock: string;
  toBlock: string;
  address?: string | string[];
  topics?: (string | null | (string | null)[])[];
};

export type Log = {
  address: string;
  blockHash: string;
  blockNumber: string;
  data: string;
  logIndex: string;
  topics: string[];
  transactionHash: string;
  transactionIndex: string;
};

export class RpcReadClient {
  private url: string;
  constructor(url: string) {
    this.url = url;
  }

  private makeClient(timeoutMs?: number) {
    return createPublicClient({ transport: http(this.url, timeoutMs ? { timeout: timeoutMs } : {}) });
  }

  async getBlockNumber(timeoutMs: number): Promise<bigint> {
    const client = this.makeClient(timeoutMs);
    const blockNumber = await client.getBlockNumber();
    return blockNumber;
  }

  async getLogs(filter: GetLogsParams, timeoutMs: number): Promise<Log[]> {
    const client = this.makeClient(timeoutMs);
    const logs = (await (client.request as any)({
      method: 'eth_getLogs',
      params: [filter],
    })) as Log[];
    return logs;
  }
}

export function bigIntToHex(value: bigint): string {
  return '0x' + value.toString(16);
}

