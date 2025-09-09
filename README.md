# Abstract Chain Indexer

A fast, boring, and correct indexer for Abstract (or any finality-in-seconds EVM chain).
Built to survive flaky RPC providers, restarts, and operator error — without wasting API credits.

⸻

Goals
	•	Process new events within 2 seconds of finality (p95).
	•	Keep backlog ≤ 1 block under normal load.
	•	Zero lost events between RPC and subscribers.
	•	Exactly-once effects in an at-least-once delivery world.
	•	Don’t sponsor your RPC provider’s yacht.

⸻

# Core Concepts

### Height Cursor (HWM)

Tracks the last fully processed block per shard. Restart-safe progress, no time windows.

### Ingest Events

Append-only table of chain logs keyed by eventId = chain:block:tx:logIndex.
Written with ON CONFLICT DO NOTHING so replays are harmless.

### Outbox / Inbox
	•	Ingest Outbox: exactly-once publish from DB to bus/dispatcher.
	•	Inbox: composite-key (eventId, handlerKind) ensures each handler runs side effects at most once.
	•	Domain Outbox: transactional publish for on-chain writes with deterministic command_key.

### RPC Adapter

Circuit breaker, timeouts, and jittered backoff. Separate pools for read (blockNumber, getLogs) and write (sendRawTransaction).

### Partitioning

Consumers are sharded by stable key (e.g., hash of chainId:address) to preserve ordering and spread load.

# Architecture
```mermaid
flowchart LR
  subgraph RPC["RPC Providers"]
    RPCR[Read Pool<br/>(CB + retries + token bucket)]
    RPCW[Write Pool<br/>(CB + retries + token bucket)]
  end

  subgraph Ingest["Ingestion"]
    I[Ingest Daemon<br/>poll blockNumber / getLogs<br/>adaptive ranges]
    EV[(infra.ingest_events)]
    IO[(infra.ingest_outbox)]
    CUR[(infra.cursors)]
  end

  subgraph Dispatch["Dispatch & Domains"]
    BUS[[Bus / Internal Queue<br/>partitioned by partition_key]]
    D[Dispatcher]
    INBOX[(infra.inbox)]
    DOX[(domain.domain_outbox)]
  end

  subgraph Exec["Chain Executor"]
    EX[Executor<br/>reads domain_outbox<br/>sends tx, writes tx_hash]
  end

  RPCR -->|getLogs, blockNumber| I
  I -->|INSERT batch| EV
  I -->|INSERT batch| IO
  I -->|UPDATE| CUR
  IO -->|publish exactly once| BUS
  BUS --> D
  D -->|run handler| INBOX
  D -->|on-chain command (tx needed)| DOX
  EX -->|read pending| DOX
  EX -->|send tx| RPCW
  EX -->|mark tx_hash| DOX
```

# Data Model
```sql
-- =========================
-- Schema setup (optional)
-- =========================
CREATE SCHEMA IF NOT EXISTS infra;
-- CREATE SCHEMA IF NOT EXISTS domain; -- e.g., nft, payments, etc.

-- =========================
-- 1) Durable cursor per shard
-- =========================
CREATE TABLE IF NOT EXISTS infra.cursors (
  id TEXT PRIMARY KEY,                     -- e.g., "erc20:shard-0"
  last_processed_block BIGINT NOT NULL     -- last fully processed block (HWM)
);

-- =========================
-- 2) Immutable ingest store
-- =========================
CREATE TABLE IF NOT EXISTS infra.ingest_events (
  event_id TEXT PRIMARY KEY,               -- chain:block:tx:logIndex
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  address TEXT NOT NULL,
  topic0 TEXT NOT NULL,                    -- first topic (event signature)
  partition_key TEXT NOT NULL,             -- e.g., hash(chainId:address)
  payload JSONB NOT NULL,                  -- raw log as JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes for common lookups/range scans
CREATE INDEX IF NOT EXISTS ix_ingest_events_address_topic_block
  ON infra.ingest_events (address, topic0, block_number);
CREATE INDEX IF NOT EXISTS ix_ingest_events_block
  ON infra.ingest_events (block_number);
CREATE INDEX IF NOT EXISTS ix_ingest_events_partition_key_block
  ON infra.ingest_events (partition_key, block_number);

-- =========================
-- 3) Ingest outbox (exactly-once publish)
-- =========================
CREATE TABLE IF NOT EXISTS infra.ingest_outbox (
  event_id TEXT PRIMARY KEY
    REFERENCES infra.ingest_events(event_id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ
);

-- Publisher will scan NULLs first quickly
CREATE INDEX IF NOT EXISTS ix_ingest_outbox_published_nulls_first
  ON infra.ingest_outbox (published_at ASC NULLS FIRST);

-- =========================
-- 4) Inbox (centralized idempotency per handler)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_status') THEN
    CREATE TYPE infra.inbox_status AS ENUM ('PENDING', 'ACK', 'FAIL', 'DLQ');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS infra.inbox (
  event_id TEXT NOT NULL,                  -- same id as ingest_events.event_id
  handler_kind TEXT NOT NULL,              -- e.g., "Balances.Projector"
  status infra.inbox_status NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  block_number BIGINT NOT NULL,
  partition_key TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, handler_kind)
);

-- Fast filters for workers and replays
CREATE INDEX IF NOT EXISTS ix_inbox_status_partition
  ON infra.inbox (status, partition_key);
CREATE INDEX IF NOT EXISTS ix_inbox_block_number
  ON infra.inbox (block_number);

-- =========================
-- 5) Domain outbox (per bounded context)
--    Deterministic command key for on-chain writes / downstream publish
-- =========================
-- Replace `domain` with your actual schema (e.g., nft)
CREATE TABLE IF NOT EXISTS domain.domain_outbox (
  command_key TEXT PRIMARY KEY,            -- e.g., "mint:collection:recipient:tokenId"
  kind TEXT NOT NULL,                      -- e.g., "MintV1"
  payload JSONB NOT NULL,                  -- command body
  published_at TIMESTAMPTZ,                -- set when executed/published
  tx_hash TEXT                             -- set by executor when tx is sent
);

-- Common query helpers
CREATE INDEX IF NOT EXISTS ix_domain_outbox_published_nulls_first
  ON domain.domain_outbox (published_at ASC NULLS FIRST);
```

# Processing Loop (Ingest)

	1.	Poll eth_blockNumber (timeout ≤ 200 ms).
	2.	If head > HWM, call eth_getLogs for [HWM+1 … min(head, HWM+step)].
	3.	Insert batch into ingest_events and ingest_outbox.
	4.	Update cursors.last_processed_block.
	5.	Adaptive step:
	•	Double on success (up to 20k blocks).
	•	Halve on error/timeout (min 500 blocks).

⸻

# Delivery Guarantees

	•	At-least-once ingest: replays safe via ON CONFLICT DO NOTHING.
	•	Exactly-once handler effects: Inbox ensures (eventId, handlerKind) runs once.
	•	Exactly-once publish: Outbox ensures messages don’t vanish between DB and bus.
	•	Idempotent writes: Domain Outbox uses command_key to prevent duplicate tx.

⸻

# Configurables

	•	POLL_INTERVAL_MS (default 250–350 with jitter)
	•	GETLOGS_STEP_INIT / STEP_MIN / STEP_MAX
	•	RPC_TIMEOUTS per method
	•	RPC_RPS_MAX per method/shard
	•	EXECUTOR_ENABLED (toggle writes)
	•	ADDR_SHARDS (partition count)

⸻

# Observability

Metrics:
	•	rpc_requests_total{method}, rpc_errors_total{method}
	•	head, last_processed_block, backlog
	•	getLogs_duration_ms p50/p95
	•	inbox_attempts_total{status}, dlq_total
	•	domain_outbox_lag
	•	Logs:
	•	Always include eventId, partitionKey, handlerKind.
	•	Alerts:
	•	Backlog > 10 blocks for 2 min
	•	DLQ rate > 1% sustained
	•	Circuit breaker open > 30 s

⸻

# Recovery Tools
	•	Replay range: replay [from..to] for handlerKind X
	•	Replay DLQ: replay-dlq handlerKind X limit N
	•	Kill switch: pause chain executor while backlog drains.

⸻

# Anti-Patterns to Avoid
	•	Block-by-block RPC calls.
	•	Wildcard getLogs with no filters.
	•	Retrying inside handlers.
	•	Time-based replays (“last hour”).
	•	Shared business tables across domains.
	•	Mixing read/write RPC pools.

⸻

# Status

### MVP includes:
	•	Ingest loop with cursor, ingest_events, and ingest_outbox.
	•	Dispatcher with inbox.
	•	Domain outbox + executor.
	•	Metrics and basic alerts.

### Future work:
	•	Replay tooling
	•	Partitioning refinements
	•	Multi-chain support