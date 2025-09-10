# Getting Started with Good Indexer

Welcome to Good Indexer! This guide will help you get up and running with a production-ready blockchain indexing system in minutes.

## What is Good Indexer?

Good Indexer is a robust, production-ready blockchain indexing system that provides:

- **Exactly-once event processing** using inbox/outbox patterns
- **Adaptive polling** that adjusts to blockchain activity
- **Circuit breakers and rate limiting** for resilient RPC interactions
- **Comprehensive observability** with metrics and logging
- **High test coverage** (96%+) for reliability
- **Modular architecture** for easy customization

## Quick Start

### Prerequisites

- Node.js 22+ 
- PostgreSQL 12+
- npm or pnpm

### 1. Install the CLI

```bash
npm install -g @good-indexer/cli
```

### 2. Initialize a Project

```bash
# Create a new project directory
mkdir my-indexer
cd my-indexer

# Initialize configuration
gx config init
```

### 3. Set Up Database

```bash
# Run database migrations
gx db migrate
```

### 4. Start the System

```bash
# Start all services
gx start all
```

### 5. Verify Everything is Working

```bash
# Check service status
gx status

# View logs
gx logs ingest --follow

# Check metrics
gx metrics
```

## Architecture Overview

Good Indexer follows a modular, event-driven architecture:

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

### Components

- **Ingest**: Polls blockchain for events and stores them
- **Dispatch**: Processes events through handlers (inbox pattern)
- **Executor**: Executes on-chain commands (outbox pattern)
- **Storage**: PostgreSQL database with MikroORM entities

## Basic Configuration

The system uses a JSON configuration file. Here's a minimal example:

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "shardId": "0",
        "batchSize": 100
      }
    },
    "dispatch": {
      "enabled": true,
      "config": {
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "batchSize": 50
      }
    },
    "executor": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "privateKey": "0x...",
        "gasLimit": 21000
      }
    }
  }
}
```

## Your First Indexer

Let's create a simple ERC-20 transfer indexer:

### 1. Set Up Event Subscriptions

```typescript
// config/events.ts
export const eventSubscriptions = [
  {
    address: '0xA0b86a33E6441b8c4C8C0C4C0C4C0C4C0C4C0C4C', // ERC-20 contract
    topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer event
  }
];
```

### 2. Create Event Handlers

```typescript
// handlers/transfer.ts
export async function handleTransfer(event: ProcessedEvent) {
  const { from, to, value } = event.payload;
  
  console.log(`Transfer: ${value} tokens from ${from} to ${to}`);
  
  // Update your application state
  await updateBalance(from, -value);
  await updateBalance(to, value);
}
```

### 3. Register Handlers

```typescript
// main.ts
import { Dispatcher } from '@good-indexer/dispatch';
import { handleTransfer } from './handlers/transfer';

const dispatcher = new Dispatcher(config);

// Register the transfer handler
dispatcher.registerHandler('TRANSFER', handleTransfer);

await dispatcher.start();
```

### 4. Start the System

```bash
# Start all services
gx start all
```

## Monitoring Your Indexer

### View Logs

```bash
# View all logs
gx logs ingest --follow

# View specific service logs
gx logs dispatch --follow --level info

# View error logs only
gx logs executor --level error
```

### Check Metrics

```bash
# View metrics
gx metrics

# Watch metrics in real-time
gx metrics --watch
```

### Health Checks

```bash
# Check system health
gx health

# Check specific service
gx status
```

## Common Use Cases

### 1. ERC-20 Token Indexing

Index all transfers for a specific token:

```typescript
const subscriptions = [
  {
    address: '0x...', // Token contract
    topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']
  }
];
```

### 2. NFT Indexing

Index NFT transfers and metadata:

```typescript
const subscriptions = [
  {
    address: '0x...', // NFT contract
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'  // Approval
    ]
  }
];
```

### 3. DeFi Protocol Indexing

Index complex DeFi events:

```typescript
const subscriptions = [
  {
    address: '0x...', // Uniswap V2 Router
    topics: [
      '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', // Swap
      '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f'  // Mint
    ]
  }
];
```

## Development Workflow

### 1. Local Development

```bash
# Start only ingestion for development
gx start ingest --config ./dev-config.json

# Monitor logs
gx logs ingest --follow --level debug

# Restart after changes
gx restart ingest
```

### 2. Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test
pnpm test packages/ingest
```

### 3. Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @good-indexer/ingest build
```

## Production Deployment

### 1. Environment Setup

```bash
# Set production environment variables
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
export PRIVATE_KEY=0x...
```

### 2. Start Services

```bash
# Start as daemon
gx start all --daemon

# Check status
gx status

# Monitor health
gx health
```

### 3. Monitoring

```bash
# Set up monitoring
gx metrics --port 9090

# View logs
gx logs all --follow
```

## Next Steps

Now that you have a basic understanding of Good Indexer:

1. **Read the [Installation Guide](./installation.md)** for detailed setup instructions
2. **Check the [Configuration Guide](./configuration.md)** for advanced configuration options
3. **Explore the [API Documentation](../api/README.md)** for detailed API reference
4. **See the [Examples](../examples/)** for more complex use cases
5. **Read the [Deployment Guide](./deployment.md)** for production deployment

## Getting Help

- **Documentation**: [Full documentation](https://github.com/glenneggleton/good-indexer#readme)
- **API Reference**: [API Documentation](../api/README.md)
- **Examples**: [Example implementations](../examples/)
- **Issues**: [Report bugs and request features](https://github.com/glenneggleton/good-indexer/issues)

## What's Next?

- Learn about [advanced configuration](./configuration.md)
- Set up [production deployment](./deployment.md)
- Explore [monitoring and observability](./troubleshooting.md)
- Build [custom event handlers](../examples/)
