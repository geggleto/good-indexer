# @good-indexer/storage-postgres API Documentation

PostgreSQL storage layer with MikroORM entities for the good-indexer system.

## Overview

The `@good-indexer/storage-postgres` package provides database entities and utilities for storing blockchain data, event logs, and system state. It uses MikroORM for object-relational mapping and PostgreSQL as the underlying database.

## Installation

```bash
npm install @good-indexer/storage-postgres
```

## Exports

### Entities

#### `DomainOutboxEntity`

Represents the domain outbox pattern for storing on-chain commands.

**Properties:**
- `commandKey` (string): Unique identifier for the command
- `kind` (string): Type of command
- `payload` (unknown): Command payload data
- `publishedAt` (Date, optional): When the command was published
- `txHash` (string, optional): Transaction hash if executed

**Example:**
```typescript
import { DomainOutboxEntity } from '@good-indexer/storage-postgres';

const command = new DomainOutboxEntity();
command.commandKey = 'cmd_123';
command.kind = 'TRANSFER';
command.payload = { from: '0x...', to: '0x...', amount: '1000' };
```

#### `InfraCursorEntity`

Tracks the last processed block for each shard.

**Properties:**
- `id` (string): Shard identifier
- `lastProcessedBlock` (string): Last processed block number

**Example:**
```typescript
import { InfraCursorEntity } from '@good-indexer/storage-postgres';

const cursor = new InfraCursorEntity();
cursor.id = 'shard_0';
cursor.lastProcessedBlock = '0x1000';
```

#### `InfraIngestEventEntity`

Stores ingested blockchain events.

**Properties:**
- `eventId` (string): Unique event identifier
- `blockNumber` (string): Block number where event occurred
- `blockHash` (string): Block hash
- `address` (string): Contract address
- `topic0` (string): First topic (event signature)
- `partitionKey` (string): Partition key for sharding
- `payload` (unknown): Event data
- `createdAt` (Date): When the event was created

**Example:**
```typescript
import { InfraIngestEventEntity } from '@good-indexer/storage-postgres';

const event = new InfraIngestEventEntity();
event.eventId = 'evt_123';
event.blockNumber = '0x1000';
event.address = '0x...';
event.topic0 = '0x...';
event.payload = { value: '1000' };
```

#### `InfraIngestOutboxEntity`

Implements the outbox pattern for event publishing.

**Properties:**
- `eventId` (string): Event identifier
- `publishedAt` (Date, optional): When the event was published

**Example:**
```typescript
import { InfraIngestOutboxEntity } from '@good-indexer/storage-postgres';

const outbox = new InfraIngestOutboxEntity();
outbox.eventId = 'evt_123';
outbox.publishedAt = new Date();
```

#### `InfraInboxEntity`

Implements the inbox pattern for event processing.

**Properties:**
- `eventId` (string): Event identifier
- `handlerKind` (string): Handler type
- `status` (InboxStatus): Processing status
- `attempts` (number): Number of processing attempts
- `lastError` (string, optional): Last error message
- `blockNumber` (string): Block number
- `partitionKey` (string): Partition key
- `firstSeenAt` (Date): When first seen
- `lastAttemptAt` (Date, optional): Last attempt timestamp

**Example:**
```typescript
import { InfraInboxEntity } from '@good-indexer/storage-postgres';

const inbox = new InfraInboxEntity();
inbox.eventId = 'evt_123';
inbox.handlerKind = 'TRANSFER_HANDLER';
inbox.status = 'PENDING';
inbox.attempts = 0;
```

### Types

#### `InboxStatus`

Enumeration of inbox processing statuses.

```typescript
type InboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
```

## Database Schema

### Tables

#### `domain.domain_outbox`
- `command_key` (text, primary key)
- `kind` (text)
- `payload` (json)
- `published_at` (timestamptz, nullable)
- `tx_hash` (text, nullable)

#### `infra.cursors`
- `id` (text, primary key)
- `last_processed_block` (bigint)

#### `infra.ingest_events`
- `event_id` (text, primary key)
- `block_number` (bigint)
- `block_hash` (text)
- `address` (text)
- `topic0` (text)
- `partition_key` (text)
- `payload` (json)
- `created_at` (timestamptz)

#### `infra.ingest_outbox`
- `event_id` (text, primary key)
- `published_at` (timestamptz, nullable)

#### `infra.inbox`
- `event_id` (text, primary key)
- `handler_kind` (text, primary key)
- `status` (infra.inbox_status)
- `attempts` (int)
- `last_error` (text, nullable)
- `block_number` (bigint)
- `partition_key` (text)
- `first_seen_at` (timestamptz)
- `last_attempt_at` (timestamptz, nullable)

### Indexes

- `ix_domain_outbox_published_nulls_first`: On `published_at ASC NULLS FIRST`
- `ix_ingest_events_address_topic_block`: On `(address, topic0, block_number)`
- `ix_ingest_events_block`: On `block_number`
- `ix_ingest_events_partition_key_block`: On `(partition_key, block_number)`
- `ix_ingest_outbox_published_nulls_first`: On `published_at ASC NULLS FIRST`
- `ix_inbox_status_partition`: On `(status, partition_key)`
- `ix_inbox_block_number`: On `block_number`

## Usage Examples

### Basic Entity Usage

```typescript
import { 
  DomainOutboxEntity, 
  InfraIngestEventEntity,
  InfraInboxEntity 
} from '@good-indexer/storage-postgres';

// Create a domain command
const command = new DomainOutboxEntity();
command.commandKey = 'transfer_123';
command.kind = 'TRANSFER';
command.payload = {
  from: '0x...',
  to: '0x...',
  amount: '1000',
  token: '0x...'
};

// Create an ingest event
const event = new InfraIngestEventEntity();
event.eventId = 'evt_123';
event.blockNumber = '0x1000';
event.address = '0x...';
event.topic0 = '0x...';
event.payload = { value: '1000' };

// Create an inbox entry
const inbox = new InfraInboxEntity();
inbox.eventId = 'evt_123';
inbox.handlerKind = 'TRANSFER_HANDLER';
inbox.status = 'PENDING';
inbox.attempts = 0;
```

### MikroORM Integration

```typescript
import { MikroORM } from '@mikro-orm/core';
import { 
  DomainOutboxEntity,
  InfraIngestEventEntity,
  InfraInboxEntity 
} from '@good-indexer/storage-postgres';

// Initialize MikroORM
const orm = await MikroORM.init({
  entities: [
    DomainOutboxEntity,
    InfraIngestEventEntity,
    InfraInboxEntity
  ],
  // ... other config
});

// Use entities
const em = orm.em.fork();
const command = new DomainOutboxEntity();
// ... set properties
await em.persistAndFlush(command);
```

## Migrations

The package includes database migrations for setting up the required schema:

- `0001_init_infra.sql`: Initial infrastructure schema
- `0001.init.ts`: TypeScript migration file

## Configuration

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

## Dependencies

- `@mikro-orm/core`: ORM core functionality
- `@mikro-orm/postgresql`: PostgreSQL driver
- `@mikro-orm/migrations`: Migration support

## Version

Current version: 1.0.0

## License

MIT
