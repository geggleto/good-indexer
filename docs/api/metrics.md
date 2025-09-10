# @good-indexer/metrics API Documentation

Metrics collection and observability for the good-indexer system.

## Overview

The `@good-indexer/metrics` package provides comprehensive metrics collection, aggregation, and exposure capabilities. It includes counters, histograms, gauges, and a metrics server for monitoring system performance and health.

## Installation

```bash
npm install @good-indexer/metrics
```

## Exports

### Metrics Registry

#### `MetricsRegistry`

Central registry for managing all metrics in the system.

**Constructor:**
```typescript
constructor()
```

**Methods:**

##### `createCounter(name: string, help: string): Counter`

Creates a new counter metric.

**Parameters:**
- `name` (string): Metric name
- `help` (string): Help description

**Returns:**
- `Counter`: Counter instance

**Example:**
```typescript
const registry = new MetricsRegistry();
const counter = registry.createCounter('events_processed_total', 'Total number of events processed');
```

##### `createHistogram(name: string, help: string): Histogram`

Creates a new histogram metric.

**Parameters:**
- `name` (string): Metric name
- `help` (string): Help description

**Returns:**
- `Histogram`: Histogram instance

**Example:**
```typescript
const histogram = registry.createHistogram('event_processing_duration_seconds', 'Time spent processing events');
```

##### `createGauge(name: string, help: string): Gauge`

Creates a new gauge metric.

**Parameters:**
- `name` (string): Metric name
- `help` (string): Help description

**Returns:**
- `Gauge`: Gauge instance

**Example:**
```typescript
const gauge = registry.createGauge('active_connections', 'Number of active connections');
```

### Counter

#### `Counter`

Tracks cumulative values that only increase.

**Methods:**

##### `inc(labels?: Record<string, string>): void`

Increments the counter by 1.

**Parameters:**
- `labels` (Record<string, string>, optional): Label values

**Example:**
```typescript
counter.inc({ status: 'success' });
counter.inc({ status: 'error' });
```

### Histogram

#### `Histogram`

Tracks distribution of values over time.

**Methods:**

##### `observe(value: number, labels?: Record<string, string>): void`

Records a value in the histogram.

**Parameters:**
- `value` (number): Value to record
- `labels` (Record<string, string>, optional): Label values

**Example:**
```typescript
histogram.observe(0.5, { operation: 'fetch_logs' });
histogram.observe(1.2, { operation: 'process_batch' });
```

### Gauge

#### `Gauge`

Tracks values that can go up or down.

**Methods:**

##### `set(value: number, labels?: Record<string, string>): void`

Sets the gauge to a specific value.

**Parameters:**
- `value` (number): Value to set
- `labels` (Record<string, string>, optional): Label values

**Example:**
```typescript
gauge.set(42, { shard: '0' });
gauge.set(0, { shard: '1' });
```

### Metrics Server

#### `MetricsServer`

HTTP server for exposing metrics in Prometheus format.

**Constructor:**
```typescript
constructor(registry: MetricsRegistry)
```

**Methods:**

##### `start(port: number): void`

Starts the metrics server.

**Parameters:**
- `port` (number): Port to listen on

**Example:**
```typescript
const server = new MetricsServer(registry);
server.start(9090);
```

##### `stop(): void`

Stops the metrics server.

**Example:**
```typescript
server.stop();
```

## Usage Examples

### Basic Metrics Setup

```typescript
import { 
  MetricsRegistry, 
  MetricsServer,
  Counter,
  Histogram,
  Gauge 
} from '@good-indexer/metrics';

// Create registry
const registry = new MetricsRegistry();

// Create metrics
const eventsProcessed = registry.createCounter(
  'events_processed_total',
  'Total number of events processed'
);

const processingTime = registry.createHistogram(
  'event_processing_duration_seconds',
  'Time spent processing events'
);

const activeConnections = registry.createGauge(
  'active_connections',
  'Number of active connections'
);

// Start metrics server
const server = new MetricsServer(registry);
server.start(9090);
```

### Event Processing Metrics

```typescript
// Track event processing
const startTime = Date.now();
try {
  await processEvent(event);
  eventsProcessed.inc({ status: 'success' });
} catch (error) {
  eventsProcessed.inc({ status: 'error' });
} finally {
  const duration = (Date.now() - startTime) / 1000;
  processingTime.observe(duration, { operation: 'process_event' });
}
```

### Connection Monitoring

```typescript
// Track active connections
let connectionCount = 0;

// On new connection
connectionCount++;
activeConnections.set(connectionCount, { shard: '0' });

// On connection close
connectionCount--;
activeConnections.set(connectionCount, { shard: '0' });
```

### Batch Processing Metrics

```typescript
const batchSize = registry.createHistogram(
  'batch_size',
  'Number of events in each batch'
);

const batchProcessingTime = registry.createHistogram(
  'batch_processing_duration_seconds',
  'Time spent processing batches'
);

// Process batch
const startTime = Date.now();
const events = await fetchEvents();
batchSize.observe(events.length, { shard: '0' });

await processBatch(events);

const duration = (Date.now() - startTime) / 1000;
batchProcessingTime.observe(duration, { shard: '0' });
```

## Prometheus Integration

The metrics server exposes data in Prometheus format at `/metrics`:

```bash
# Example metrics output
# HELP events_processed_total Total number of events processed
# TYPE events_processed_total counter
events_processed_total{status="success"} 1000
events_processed_total{status="error"} 50

# HELP event_processing_duration_seconds Time spent processing events
# TYPE event_processing_duration_seconds histogram
event_processing_duration_seconds_bucket{le="0.1"} 100
event_processing_duration_seconds_bucket{le="0.5"} 500
event_processing_duration_seconds_bucket{le="1.0"} 800
event_processing_duration_seconds_bucket{le="+Inf"} 1000
event_processing_duration_seconds_sum 500.0
event_processing_duration_seconds_count 1000

# HELP active_connections Number of active connections
# TYPE active_connections gauge
active_connections{shard="0"} 42
```

## Configuration

### Environment Variables

- `METRICS_PORT`: Port for metrics server (default: 9090)
- `METRICS_ENABLED`: Enable metrics collection (default: true)

## Dependencies

- Node.js HTTP module for metrics server
- TypeScript for type definitions

## Version

Current version: 1.0.0

## License

MIT
