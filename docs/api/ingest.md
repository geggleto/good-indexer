# @good-indexer/ingest API Documentation

Event ingestion system with adaptive polling and exactly-once delivery for blockchain data.

## Overview

The `@good-indexer/ingest` package provides a robust event ingestion system that polls blockchain data, processes events, and ensures exactly-once delivery. It includes adaptive polling, circuit breakers, rate limiting, and comprehensive metrics.

## Installation

```bash
npm install @good-indexer/ingest
```

## Exports

### Main Classes

#### `IngestDaemon`

Main orchestrator for the ingestion system.

**Constructor:**
```typescript
constructor(
  config: IngestConfig,
  dependencies?: PublisherDependencies
)
```

**Methods:**

##### `start(): Promise<void>`

Starts the ingestion daemon.

**Example:**
```typescript
const daemon = new IngestDaemon(config);
await daemon.start();
```

##### `stop(): Promise<void>`

Stops the ingestion daemon.

**Example:**
```typescript
await daemon.stop();
```

#### `IngestPublisher`

Publishes events to the outbox for downstream processing.

**Constructor:**
```typescript
constructor(
  config: { dbUrl: string; batchSize?: number },
  dependencies: PublisherDependencies
)
```

**Methods:**

##### `start(): Promise<void>`

Starts the publisher.

**Example:**
```typescript
const publisher = new IngestPublisher(config, dependencies);
await publisher.start();
```

##### `stop(): Promise<void>`

Stops the publisher.

**Example:**
```typescript
await publisher.stop();
```

### Core Components

#### `BlockFetcher`

Fetches current block numbers from the blockchain.

**Methods:**

##### `getCurrentBlock(): Promise<bigint>`

Gets the latest block number.

**Returns:**
- `Promise<bigint>`: Current block number

#### `LogFetcher`

Fetches event logs from the blockchain.

**Methods:**

##### `getLogs(fromBlock: bigint, toBlock: bigint): Promise<Log[]>`

Fetches logs for a block range.

**Parameters:**
- `fromBlock` (bigint): Starting block number
- `toBlock` (bigint): Ending block number

**Returns:**
- `Promise<Log[]>`: Array of log entries

#### `CursorManager`

Manages database cursors for tracking progress.

**Methods:**

##### `getLastProcessedBlock(shardId: string): Promise<bigint>`

Gets the last processed block for a shard.

**Parameters:**
- `shardId` (string): Shard identifier

**Returns:**
- `Promise<bigint>`: Last processed block number

##### `updateCursor(shardId: string, blockNumber: bigint): Promise<void>`

Updates the cursor for a shard.

**Parameters:**
- `shardId` (string): Shard identifier
- `blockNumber` (bigint): New block number

#### `BatchProcessor`

Processes batches of events.

**Methods:**

##### `processBatch(events: Log[], entityManager: any): Promise<void>`

Processes a batch of events.

**Parameters:**
- `events` (Log[]): Array of events to process
- `entityManager` (any): MikroORM entity manager

#### `StepManager`

Manages adaptive step sizing for polling.

**Methods:**

##### `calculateRange(from: bigint, head: bigint): { from: bigint; to: bigint }`

Calculates the next block range to process.

**Parameters:**
- `from` (bigint): Starting block
- `head` (bigint): Current head block

**Returns:**
- `{ from: bigint; to: bigint }`: Block range to process

#### `IngestLoop`

Main orchestration loop for ingestion.

**Methods:**

##### `runLoop(): Promise<void>`

Runs the main ingestion loop.

### Configuration

#### `IngestConfig`

Configuration for the ingestion system.

```typescript
interface IngestConfig {
  rpcUrl: string;
  dbUrl: string;
  shardId: string;
  batchSize?: number;
  stepSize?: number;
  maxStepSize?: number;
  minStepSize?: number;
  pollInterval?: number;
  timeout?: number;
  retries?: number;
  circuitBreakerThreshold?: number;
  rateLimitRps?: number;
  metricsPort?: number;
}
```

#### `PublisherDependencies`

Dependencies for the publisher.

```typescript
interface PublisherDependencies {
  findRootSync: FindRootService['findRootSync'];
  resolve: PathService['resolve'];
  delay: DelayService['delay'];
  rpcReadClient?: RpcClient;
  tokenBucketGetLogs?: TokenBucketService;
  tokenBucketBlockNumber?: TokenBucketService;
  circuitBreaker?: CircuitBreakerService;
  metricsRegistry?: MetricsService['MetricsRegistry'];
  metricsCounter?: MetricsService['Counter'];
  metricsHistogram?: MetricsService['Histogram'];
  metricsGauge?: MetricsService['Gauge'];
  metricsServer?: MetricsService['MetricsServer'];
}
```

### Utility Functions

#### `buildEventRow(log: Log, partitionKey: string): EventRow`

Builds an event row from a log entry.

**Parameters:**
- `log` (Log): Log entry
- `partitionKey` (string): Partition key

**Returns:**
- `EventRow`: Event row object

#### `buildFilters(subscriptions: Subscription[]): GetLogsParams[]`

Builds log filters from subscriptions.

**Parameters:**
- `subscriptions` (Subscription[]): Event subscriptions

**Returns:**
- `GetLogsParams[]`: Array of log filter parameters

#### `stablePartitionKey(input: string): string`

Generates a stable partition key from input.

**Parameters:**
- `input` (string): Input string

**Returns:**
- `string`: Partition key

## Usage Examples

### Basic Ingestion Setup

```typescript
import { IngestDaemon, IngestConfig } from '@good-indexer/ingest';

const config: IngestConfig = {
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-key',
  dbUrl: 'postgresql://user:pass@localhost:5432/indexer',
  shardId: '0',
  batchSize: 100,
  stepSize: 10,
  maxStepSize: 1000,
  minStepSize: 1,
  pollInterval: 1000,
  timeout: 5000,
  retries: 3,
  circuitBreakerThreshold: 5,
  rateLimitRps: 10,
  metricsPort: 9090
};

const daemon = new IngestDaemon(config);
await daemon.start();
```

### Publisher Setup

```typescript
import { IngestPublisher } from '@good-indexer/ingest';

const publisher = new IngestPublisher(
  { dbUrl: 'postgresql://...', batchSize: 50 },
  {
    findRootSync: (cwd) => '/path/to/root',
    resolve: (...paths) => paths.join('/'),
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
  }
);

await publisher.start();
```

### Custom Dependencies

```typescript
import { 
  IngestDaemon, 
  createIngestDaemon,
  IngestConfig 
} from '@good-indexer/ingest';

const config: IngestConfig = {
  // ... config
};

const daemon = createIngestDaemon(config, {
  findRootSync: (cwd) => '/custom/root',
  resolve: (...paths) => paths.join('/'),
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  rpcReadClient: customRpcClient,
  tokenBucketGetLogs: customTokenBucket,
  circuitBreaker: customCircuitBreaker,
  metricsRegistry: customMetricsRegistry
});

await daemon.start();
```

### Event Processing

```typescript
import { 
  BlockFetcher, 
  LogFetcher, 
  BatchProcessor 
} from '@good-indexer/ingest';

// Fetch current block
const blockFetcher = new BlockFetcher(rpcClient, tokenBucket, circuitBreaker);
const currentBlock = await blockFetcher.getCurrentBlock();

// Fetch logs
const logFetcher = new LogFetcher(rpcClient, tokenBucket, circuitBreaker);
const logs = await logFetcher.getLogs(fromBlock, toBlock);

// Process batch
const processor = new BatchProcessor();
await processor.processBatch(logs, entityManager);
```

## Error Handling

The package includes comprehensive error handling:

- **Circuit Breaker**: Prevents cascading failures
- **Rate Limiting**: Prevents overwhelming RPC endpoints
- **Retry Logic**: Automatic retries with exponential backoff
- **Timeout Handling**: Request timeouts to prevent hanging
- **Database Errors**: Transaction rollback on failures

## Metrics

The package exposes comprehensive metrics:

- `events_processed_total`: Total events processed
- `event_processing_duration_seconds`: Processing time
- `batch_size`: Batch sizes
- `rpc_requests_total`: RPC request count
- `rpc_request_duration_seconds`: RPC request time
- `circuit_breaker_state`: Circuit breaker state
- `rate_limit_hits_total`: Rate limit hits

## Configuration

### Environment Variables

- `RPC_URL`: RPC endpoint URL
- `DATABASE_URL`: Database connection string
- `SHARD_ID`: Shard identifier
- `BATCH_SIZE`: Batch size for processing
- `STEP_SIZE`: Initial step size
- `MAX_STEP_SIZE`: Maximum step size
- `MIN_STEP_SIZE`: Minimum step size
- `POLL_INTERVAL`: Polling interval in milliseconds
- `TIMEOUT`: Request timeout in milliseconds
- `RETRIES`: Number of retries
- `CIRCUIT_BREAKER_THRESHOLD`: Circuit breaker threshold
- `RATE_LIMIT_RPS`: Rate limit requests per second
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
