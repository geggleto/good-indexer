# @good-indexer/dispatch API Documentation

Event dispatching system with inbox pattern for exactly-once processing.

## Overview

The `@good-indexer/dispatch` package provides event dispatching capabilities using the inbox pattern to ensure exactly-once processing. It consumes events from the outbox, processes them through handlers, and manages idempotency.

## Installation

```bash
npm install @good-indexer/dispatch
```

## Exports

### Main Classes

#### `Dispatcher`

Main dispatcher for processing events from the outbox.

**Constructor:**
```typescript
constructor(
  config: DispatcherConfig,
  dependencies?: DispatcherDependencies
)
```

**Methods:**

##### `start(): Promise<void>`

Starts the dispatcher.

**Example:**
```typescript
const dispatcher = new Dispatcher(config);
await dispatcher.start();
```

##### `stop(): Promise<void>`

Stops the dispatcher.

**Example:**
```typescript
await dispatcher.stop();
```

##### `registerHandler(kind: string, handler: EventHandler): void`

Registers an event handler for a specific event kind.

**Parameters:**
- `kind` (string): Event kind identifier
- `handler` (EventHandler): Handler function

**Example:**
```typescript
dispatcher.registerHandler('TRANSFER', async (event) => {
  // Handle transfer event
  console.log('Processing transfer:', event);
});
```

### Configuration

#### `DispatcherConfig`

Configuration for the dispatcher.

```typescript
interface DispatcherConfig {
  dbUrl: string;
  batchSize?: number;
  pollInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}
```

#### `DispatcherDependencies`

Dependencies for the dispatcher.

```typescript
interface DispatcherDependencies {
  findRootSync: FindRootService['findRootSync'];
  resolve: PathService['resolve'];
  delay: DelayService['delay'];
  metricsRegistry?: MetricsService['MetricsRegistry'];
  metricsCounter?: MetricsService['Counter'];
  metricsHistogram?: MetricsService['Histogram'];
  metricsGauge?: MetricsService['Gauge'];
  metricsServer?: MetricsService['MetricsServer'];
}
```

### Event Handlers

#### `EventHandler`

Function type for event handlers.

```typescript
type EventHandler = (event: ProcessedEvent) => Promise<void>;
```

#### `ProcessedEvent`

Structure of a processed event.

```typescript
interface ProcessedEvent {
  eventId: string;
  kind: string;
  payload: unknown;
  blockNumber: string;
  partitionKey: string;
  createdAt: Date;
}
```

## Usage Examples

### Basic Dispatcher Setup

```typescript
import { Dispatcher, DispatcherConfig } from '@good-indexer/dispatch';

const config: DispatcherConfig = {
  dbUrl: 'postgresql://user:pass@localhost:5432/indexer',
  batchSize: 50,
  pollInterval: 1000,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 5000
};

const dispatcher = new Dispatcher(config);
await dispatcher.start();
```

### Registering Event Handlers

```typescript
import { Dispatcher } from '@good-indexer/dispatch';

const dispatcher = new Dispatcher(config);

// Register transfer handler
dispatcher.registerHandler('TRANSFER', async (event) => {
  console.log('Processing transfer:', event);
  
  // Process the transfer
  await processTransfer(event.payload);
  
  // Update domain state
  await updateBalance(event.payload.from, -event.payload.amount);
  await updateBalance(event.payload.to, event.payload.amount);
});

// Register approval handler
dispatcher.registerHandler('APPROVAL', async (event) => {
  console.log('Processing approval:', event);
  
  // Process the approval
  await processApproval(event.payload);
});

// Register mint handler
dispatcher.registerHandler('MINT', async (event) => {
  console.log('Processing mint:', event);
  
  // Process the mint
  await processMint(event.payload);
});
```

### Custom Dependencies

```typescript
import { 
  Dispatcher, 
  createDispatcher,
  DispatcherConfig 
} from '@good-indexer/dispatch';

const config: DispatcherConfig = {
  // ... config
};

const dispatcher = createDispatcher(config, {
  findRootSync: (cwd) => '/custom/root',
  resolve: (...paths) => paths.join('/'),
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  metricsRegistry: customMetricsRegistry,
  metricsCounter: customCounter,
  metricsHistogram: customHistogram,
  metricsGauge: customGauge,
  metricsServer: customMetricsServer
});

await dispatcher.start();
```

### Error Handling

```typescript
import { Dispatcher } from '@good-indexer/dispatch';

const dispatcher = new Dispatcher(config);

// Register handler with error handling
dispatcher.registerHandler('TRANSFER', async (event) => {
  try {
    await processTransfer(event.payload);
  } catch (error) {
    console.error('Transfer processing failed:', error);
    
    // The dispatcher will automatically retry based on configuration
    throw error;
  }
});
```

### Batch Processing

```typescript
import { Dispatcher } from '@good-indexer/dispatch';

const dispatcher = new Dispatcher({
  ...config,
  batchSize: 100, // Process up to 100 events at once
  pollInterval: 500 // Poll every 500ms
});

// The dispatcher automatically handles batching
await dispatcher.start();
```

## Inbox Pattern

The dispatcher implements the inbox pattern to ensure exactly-once processing:

1. **Event Consumption**: Reads events from the outbox
2. **Inbox Entry**: Creates an inbox entry for each event
3. **Handler Execution**: Executes the appropriate handler
4. **Status Tracking**: Updates processing status
5. **Retry Logic**: Retries failed events based on configuration

### Inbox States

- `PENDING`: Event is waiting to be processed
- `PROCESSING`: Event is currently being processed
- `COMPLETED`: Event was successfully processed
- `FAILED`: Event processing failed after max retries

## Metrics

The package exposes comprehensive metrics:

- `events_dispatched_total`: Total events dispatched
- `event_dispatch_duration_seconds`: Dispatch time
- `handler_execution_duration_seconds`: Handler execution time
- `inbox_entries_total`: Total inbox entries
- `inbox_retries_total`: Total retries
- `handler_errors_total`: Handler errors

## Configuration

### Environment Variables

- `DATABASE_URL`: Database connection string
- `BATCH_SIZE`: Batch size for processing
- `POLL_INTERVAL`: Polling interval in milliseconds
- `MAX_RETRIES`: Maximum number of retries
- `RETRY_DELAY`: Delay between retries in milliseconds
- `TIMEOUT`: Handler timeout in milliseconds
- `METRICS_PORT`: Metrics server port

## Dependencies

- `@good-indexer/core`: Core types and utilities
- `@good-indexer/storage-postgres`: Database entities
- `@good-indexer/metrics`: Metrics collection
- `@mikro-orm/core`: ORM functionality
- `zod`: Schema validation

## Version

Current version: 1.0.0

## License

MIT
