# @good-indexer/executor-evm API Documentation

EVM transaction executor for on-chain operations.

## Overview

The `@good-indexer/executor-evm` package provides transaction execution capabilities for EVM-compatible blockchains. It reads commands from the domain outbox, executes them as transactions, and tracks their status.

## Installation

```bash
npm install @good-indexer/executor-evm
```

## Exports

### Main Classes

#### `EvmExecutor`

Main executor for EVM transactions.

**Constructor:**
```typescript
constructor(
  config: ExecutorConfig,
  dependencies?: ExecutorDependencies
)
```

**Methods:**

##### `start(): Promise<void>`

Starts the executor.

**Example:**
```typescript
const executor = new EvmExecutor(config);
await executor.start();
```

##### `stop(): Promise<void>`

Stops the executor.

**Example:**
```typescript
await executor.stop();
```

##### `executeCommand(command: DomainCommand): Promise<string>`

Executes a single domain command.

**Parameters:**
- `command` (DomainCommand): Command to execute

**Returns:**
- `Promise<string>`: Transaction hash

**Example:**
```typescript
const txHash = await executor.executeCommand({
  commandKey: 'cmd_123',
  kind: 'TRANSFER',
  payload: { from: '0x...', to: '0x...', amount: '1000' }
});
```

### Configuration

#### `ExecutorConfig`

Configuration for the executor.

```typescript
interface ExecutorConfig {
  rpcUrl: string;
  dbUrl: string;
  privateKey: string;
  gasLimit?: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  chainId?: number;
  timeout?: number;
  retries?: number;
  pollInterval?: number;
}
```

#### `ExecutorDependencies`

Dependencies for the executor.

```typescript
interface ExecutorDependencies {
  findRootSync: FindRootService['findRootSync'];
  resolve: PathService['resolve'];
  delay: DelayService['delay'];
  rpcWriteClient?: RpcClient;
  tokenBucket?: TokenBucketService;
  circuitBreaker?: CircuitBreakerService;
  metricsRegistry?: MetricsService['MetricsRegistry'];
  metricsCounter?: MetricsService['Counter'];
  metricsHistogram?: MetricsService['Histogram'];
  metricsGauge?: MetricsService['Gauge'];
  metricsServer?: MetricsService['MetricsServer'];
}
```

### Types

#### `DomainCommand`

Structure of a domain command.

```typescript
interface DomainCommand {
  commandKey: string;
  kind: string;
  payload: unknown;
  publishedAt?: Date;
  txHash?: string;
}
```

#### `TransactionResult`

Result of transaction execution.

```typescript
interface TransactionResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: number;
  error?: string;
}
```

## Usage Examples

### Basic Executor Setup

```typescript
import { EvmExecutor, ExecutorConfig } from '@good-indexer/executor-evm';

const config: ExecutorConfig = {
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-key',
  dbUrl: 'postgresql://user:pass@localhost:5432/indexer',
  privateKey: '0x...',
  gasLimit: 21000,
  gasPrice: '20000000000', // 20 gwei
  maxFeePerGas: '20000000000',
  maxPriorityFeePerGas: '2000000000',
  chainId: 1,
  timeout: 30000,
  retries: 3,
  pollInterval: 1000
};

const executor = new EvmExecutor(config);
await executor.start();
```

### Custom Dependencies

```typescript
import { 
  EvmExecutor, 
  createEvmExecutor,
  ExecutorConfig 
} from '@good-indexer/executor-evm';

const config: ExecutorConfig = {
  // ... config
};

const executor = createEvmExecutor(config, {
  findRootSync: (cwd) => '/custom/root',
  resolve: (...paths) => paths.join('/'),
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  rpcWriteClient: customRpcClient,
  tokenBucket: customTokenBucket,
  circuitBreaker: customCircuitBreaker,
  metricsRegistry: customMetricsRegistry
});

await executor.start();
```

### Command Execution

```typescript
import { EvmExecutor } from '@good-indexer/executor-evm';

const executor = new EvmExecutor(config);

// Execute a transfer command
const transferCommand = {
  commandKey: 'transfer_123',
  kind: 'TRANSFER',
  payload: {
    from: '0x...',
    to: '0x...',
    amount: '1000',
    token: '0x...'
  }
};

try {
  const txHash = await executor.executeCommand(transferCommand);
  console.log('Transaction sent:', txHash);
} catch (error) {
  console.error('Transaction failed:', error);
}
```

### Batch Execution

```typescript
import { EvmExecutor } from '@good-indexer/executor-evm';

const executor = new EvmExecutor({
  ...config,
  pollInterval: 500 // Poll every 500ms
});

// The executor automatically processes commands from the outbox
await executor.start();
```

## Command Types

### Transfer Command

```typescript
interface TransferCommand {
  commandKey: string;
  kind: 'TRANSFER';
  payload: {
    from: string;
    to: string;
    amount: string;
    token: string;
  };
}
```

### Approval Command

```typescript
interface ApprovalCommand {
  commandKey: string;
  kind: 'APPROVAL';
  payload: {
    owner: string;
    spender: string;
    amount: string;
    token: string;
  };
}
```

### Mint Command

```typescript
interface MintCommand {
  commandKey: string;
  kind: 'MINT';
  payload: {
    to: string;
    amount: string;
    token: string;
  };
}
```

## Error Handling

The executor includes comprehensive error handling:

- **Gas Estimation**: Automatic gas estimation for transactions
- **Nonce Management**: Automatic nonce tracking and management
- **Retry Logic**: Automatic retries for failed transactions
- **Circuit Breaker**: Prevents cascading failures
- **Rate Limiting**: Prevents overwhelming RPC endpoints

## Metrics

The package exposes comprehensive metrics:

- `commands_executed_total`: Total commands executed
- `command_execution_duration_seconds`: Command execution time
- `transactions_sent_total`: Total transactions sent
- `transaction_confirmation_duration_seconds`: Transaction confirmation time
- `gas_used_total`: Total gas used
- `execution_errors_total`: Execution errors

## Configuration

### Environment Variables

- `RPC_URL`: RPC endpoint URL
- `DATABASE_URL`: Database connection string
- `PRIVATE_KEY`: Private key for signing transactions
- `GAS_LIMIT`: Gas limit for transactions
- `GAS_PRICE`: Gas price in wei
- `MAX_FEE_PER_GAS`: Maximum fee per gas
- `MAX_PRIORITY_FEE_PER_GAS`: Maximum priority fee per gas
- `CHAIN_ID`: Chain ID for the network
- `TIMEOUT`: Request timeout in milliseconds
- `RETRIES`: Number of retries
- `POLL_INTERVAL`: Polling interval in milliseconds
- `METRICS_PORT`: Metrics server port

## Dependencies

- `@good-indexer/core`: Core types and utilities
- `@good-indexer/adapters-evm`: RPC adapters
- `@good-indexer/storage-postgres`: Database entities
- `@good-indexer/metrics`: Metrics collection
- `@mikro-orm/core`: ORM functionality
- `viem`: Ethereum library
- `zod`: Schema validation

## Version

Current version: 1.0.0

## License

MIT
