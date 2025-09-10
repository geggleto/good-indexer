# @good-indexer/adapters-evm API Documentation

EVM RPC adapters with circuit breakers and rate limiting for resilient blockchain interactions.

## Overview

The `@good-indexer/adapters-evm` package provides robust RPC client adapters for Ethereum Virtual Machine (EVM) compatible blockchains. It includes circuit breakers, rate limiting, and retry mechanisms to ensure reliable data fetching.

## Installation

```bash
npm install @good-indexer/adapters-evm
```

## Exports

### RPC Client

#### `RpcReadClient`

A resilient RPC client for reading blockchain data with built-in circuit breaker and rate limiting.

**Constructor:**
```typescript
constructor(
  rpcUrl: string,
  options?: {
    timeout?: number;
    retries?: number;
    circuitBreakerThreshold?: number;
    rateLimitRps?: number;
  }
)
```

**Methods:**

##### `getBlockNumber(timeout?: number): Promise<bigint>`

Fetches the latest block number from the blockchain.

**Parameters:**
- `timeout` (number, optional): Request timeout in milliseconds

**Returns:**
- `Promise<bigint>`: The latest block number

**Example:**
```typescript
const client = new RpcReadClient('https://eth-mainnet.g.alchemy.com/v2/your-key');
const blockNumber = await client.getBlockNumber();
console.log(`Latest block: ${blockNumber}`);
```

##### `getLogs(params: GetLogsParams, timeout?: number): Promise<Log[]>`

Fetches event logs from the blockchain.

**Parameters:**
- `params` (GetLogsParams): Log filtering parameters
- `timeout` (number, optional): Request timeout in milliseconds

**Returns:**
- `Promise<Log[]>`: Array of matching log entries

**Example:**
```typescript
const logs = await client.getLogs({
  fromBlock: '0x1000',
  toBlock: '0x2000',
  address: '0x...',
  topics: ['0x...']
});
```

### Circuit Breaker

#### `CircuitBreaker`

Implements the circuit breaker pattern to prevent cascading failures.

**Constructor:**
```typescript
constructor(
  threshold: number,
  timeout: number,
  resetTimeout: number
)
```

**Methods:**

##### `execute<T>(fn: () => Promise<T>): Promise<T>`

Executes a function with circuit breaker protection.

**Parameters:**
- `fn` (() => Promise<T>): Function to execute

**Returns:**
- `Promise<T>`: Result of the function execution

### Rate Limiting

#### `TokenBucket`

Implements token bucket rate limiting algorithm.

**Constructor:**
```typescript
constructor(
  capacity: number,
  refillRate: number
)
```

**Methods:**

##### `take(tokens: number): Promise<boolean>`

Attempts to consume tokens from the bucket.

**Parameters:**
- `tokens` (number): Number of tokens to consume

**Returns:**
- `Promise<boolean>`: True if tokens were available, false otherwise

## Types

### `GetLogsParams`

Parameters for filtering event logs.

```typescript
interface GetLogsParams {
  fromBlock?: string | number;
  toBlock?: string | number;
  address?: string | string[];
  topics?: (string | string[])[];
}
```

### `Log`

Event log entry structure.

```typescript
interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
}
```

## Usage Examples

### Basic RPC Client

```typescript
import { RpcReadClient } from '@good-indexer/adapters-evm';

const client = new RpcReadClient('https://eth-mainnet.g.alchemy.com/v2/your-key', {
  timeout: 5000,
  retries: 3,
  circuitBreakerThreshold: 5,
  rateLimitRps: 10
});

// Get latest block
const blockNumber = await client.getBlockNumber();

// Get logs for a specific contract
const logs = await client.getLogs({
  fromBlock: '0x1000',
  toBlock: 'latest',
  address: '0x...',
  topics: ['0x...']
});
```

### Circuit Breaker Usage

```typescript
import { CircuitBreaker } from '@good-indexer/adapters-evm';

const circuitBreaker = new CircuitBreaker(5, 1000, 5000);

try {
  const result = await circuitBreaker.execute(async () => {
    // Your RPC call here
    return await client.getBlockNumber();
  });
} catch (error) {
  console.error('Circuit breaker opened:', error);
}
```

### Rate Limiting

```typescript
import { TokenBucket } from '@good-indexer/adapters-evm';

const rateLimiter = new TokenBucket(10, 1); // 10 tokens, refill 1 per second

const canProceed = await rateLimiter.take(1);
if (canProceed) {
  // Make RPC call
} else {
  // Wait or skip
}
```

## Error Handling

The package includes comprehensive error handling:

- **Circuit Breaker Errors**: When the circuit is open
- **Rate Limit Errors**: When rate limits are exceeded
- **Timeout Errors**: When requests exceed the timeout
- **RPC Errors**: Standard RPC error responses

## Configuration

### Environment Variables

- `RPC_URL`: Default RPC endpoint URL
- `RPC_TIMEOUT`: Default timeout in milliseconds
- `RPC_RETRIES`: Default number of retries
- `CIRCUIT_BREAKER_THRESHOLD`: Circuit breaker failure threshold
- `RATE_LIMIT_RPS`: Rate limit requests per second

## Dependencies

- `viem`: Ethereum library for RPC calls
- `@good-indexer/metrics`: Metrics collection

## Version

Current version: 1.0.0

## License

MIT
