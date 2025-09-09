type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcResponse<T> = {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

export type GetLogsParams = {
  fromBlock: string; // hex
  toBlock: string; // hex
  address?: string | string[];
  topics?: (string | null | (string | null)[])[];
};

export type Log = {
  address: string;
  blockHash: string;
  blockNumber: string; // hex
  data: string;
  logIndex: string; // hex
  topics: string[];
  transactionHash: string;
  transactionIndex: string; // hex
};

export class RpcReadClient {
  private url: string;
  private nextId = 1;

  constructor(url: string) {
    this.url = url;
  }

  async call<T>(method: string, params: unknown[], timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body: JsonRpcRequest = { jsonrpc: '2.0', id: this.nextId++, method, params };
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`rpc http ${res.status}`);
      const json = (await res.json()) as JsonRpcResponse<T>;
      if (json.error) throw new Error(`rpc error ${json.error.code}: ${json.error.message}`);
      if (json.result === undefined) throw new Error('rpc missing result');
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  }

  getBlockNumber(timeoutMs: number): Promise<string> {
    return this.call<string>('eth_blockNumber', [], timeoutMs);
  }

  getLogs(filter: GetLogsParams, timeoutMs: number): Promise<Log[]> {
    return this.call<Log[]>('eth_getLogs', [filter], timeoutMs);
  }
}

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

export function bigIntToHex(value: bigint): string {
  return '0x' + value.toString(16);
}

