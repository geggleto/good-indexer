# Good Indexer API Documentation

Comprehensive API documentation for all packages in the good-indexer system.

## Overview

The good-indexer system is a robust, production-ready blockchain indexing solution that provides exactly-once event processing, adaptive polling, and comprehensive observability. This documentation covers all public APIs across the monorepo packages.

## Packages

### Core Packages

#### [@good-indexer/core](./core.md)
Core types and runtime utilities for the good-indexer system.
- HTTP server functionality
- Shared type definitions
- Runtime utilities

#### [@good-indexer/adapters-evm](./adapters-evm.md)
EVM RPC adapters with circuit breakers and rate limiting.
- Resilient RPC client
- Circuit breaker pattern
- Token bucket rate limiting
- Automatic retries

#### [@good-indexer/storage-postgres](./storage-postgres.md)
PostgreSQL storage layer with MikroORM entities.
- Domain outbox entities
- Infrastructure entities
- Database migrations
- ORM integration

#### [@good-indexer/metrics](./metrics.md)
Metrics collection and observability.
- Prometheus-compatible metrics
- Counters, histograms, and gauges
- Metrics server
- Comprehensive monitoring

### Business Logic Packages

#### [@good-indexer/ingest](./ingest.md)
Event ingestion system with adaptive polling.
- Adaptive block polling
- Event log fetching
- Batch processing
- Exactly-once delivery
- Comprehensive error handling

#### [@good-indexer/dispatch](./dispatch.md)
Event dispatching system with inbox pattern.
- Inbox pattern implementation
- Event handler registration
- Idempotent processing
- Retry logic

#### [@good-indexer/executor-evm](./executor-evm.md)
EVM transaction executor for on-chain operations.
- Command execution
- Transaction management
- Gas optimization
- Status tracking

### Tooling Packages

#### [@good-indexer/cli](./cli.md)
Command line interface for system management.
- Service management
- Configuration management
- Database operations
- Monitoring and logging

## Quick Start

### Installation

```bash
# Install all packages
npm install @good-indexer/core @good-indexer/adapters-evm @good-indexer/storage-postgres @good-indexer/metrics @good-indexer/ingest @good-indexer/dispatch @good-indexer/executor-evm @good-indexer/cli

# Or install CLI globally
npm install -g @good-indexer/cli
```

### Basic Usage

```typescript
import { IngestDaemon } from '@good-indexer/ingest';
import { Dispatcher } from '@good-indexer/dispatch';
import { EvmExecutor } from '@good-indexer/executor-evm';

// Configure ingestion
const ingestConfig = {
  rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-key',
  dbUrl: 'postgresql://user:pass@localhost:5432/indexer',
  shardId: '0',
  batchSize: 100
};

// Start services
const daemon = new IngestDaemon(ingestConfig);
await daemon.start();

const dispatcher = new Dispatcher(dispatcherConfig);
await dispatcher.start();

const executor = new EvmExecutor(executorConfig);
await executor.start();
```

### CLI Usage

```bash
# Initialize configuration
gx config init

# Run database migrations
gx db migrate

# Start all services
gx start all

# Check status
gx status

# View logs
gx logs ingest --follow
```

## Architecture

The good-indexer system follows a modular, event-driven architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ingest        │    │   Dispatch      │    │   Executor      │
│   (Polling)     │───▶│   (Inbox)       │───▶│   (On-chain)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Storage       │    │   Storage       │    │   Storage       │
│   (Events)      │    │   (Inbox)       │    │   (Outbox)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Features

### Exactly-Once Processing
- Inbox pattern for idempotent event processing
- Outbox pattern for reliable command execution
- Comprehensive error handling and retry logic

### Adaptive Polling
- Dynamic step sizing based on blockchain activity
- Circuit breakers to prevent cascading failures
- Rate limiting to respect RPC endpoint limits

### Observability
- Comprehensive metrics collection
- Prometheus-compatible metrics export
- Structured logging with configurable levels
- Health checks and status monitoring

### Production Ready
- High test coverage (96%+)
- Comprehensive error handling
- Graceful shutdown and restart
- Configuration management
- Database migrations

## Configuration

All packages support configuration through:
- Environment variables
- Configuration files (JSON)
- CLI options
- Programmatic configuration

See individual package documentation for specific configuration options.

## Error Handling

The system includes comprehensive error handling:
- Circuit breakers for RPC calls
- Rate limiting for API requests
- Automatic retries with exponential backoff
- Graceful degradation
- Detailed error logging

## Monitoring

Built-in monitoring capabilities:
- Prometheus metrics export
- Health check endpoints
- Service status monitoring
- Performance metrics
- Error tracking

## Contributing

See the main [README](../README.md) for contribution guidelines.

## License

MIT

## Support

- GitHub Issues: [Report bugs and request features](https://github.com/glenneggleton/good-indexer/issues)
- Documentation: [Full documentation](https://github.com/glenneggleton/good-indexer#readme)
- Examples: [Example implementations](https://github.com/glenneggleton/good-indexer/tree/main/examples)
