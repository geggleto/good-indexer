# Good Indexer — LLM Agent Instruction Set

This document defines how autonomous/assisted agents contribute to the **good-indexer** framework. It specifies roles, constraints, deliverables, folder ownership, coding standards, and acceptance criteria. All agents must follow these rules to produce consistent, production-grade output.

---
## 0) Project Snapshot
- **Runtime:** TypeScript on Node.js v22
- **Package manager:** pnpm
- **Repo layout:** monorepo (workspaces)
- **DB:** PostgreSQL 14+
- **Targets:** Polling-only EVM indexers with exactly-once effects via Inbox/Outbox
- **Primary packages**
  - `packages/core` — types, runtime, scheduler
  - `packages/ingest` — poller + ingest store + ingest outbox
  - `packages/dispatch` — bus/queue consumer + inbox + command bus
  - `packages/executor-evm` — on-chain writer
  - `packages/adapters-evm` — RPC read/write with CB/backoff/buckets
  - `packages/storage-postgres` — infra schemas + repositories
  - `packages/transport-dbqueue` — default DB-backed queue
  - `packages/metrics` — Prom/OTel helpers
  - `packages/cli` — `gx` CLI
  - `examples/erc20-transfers` — sample plugin
  - `docs` — architecture & guides

---
## 1) Non‑Negotiable Principles
1. **Height cursors** per shard (`last_processed_block`) – restart-safe.
2. **Immutable ingest store** (`ingest_events`) with `ON CONFLICT DO NOTHING` – replay-safe.
3. **Ingest outbox** – exactly-once publish from DB to transport.
4. **Inbox** composite key `(event_id, handler_kind)` – exactly-once handler effects.
5. **Domain outbox** with deterministic `command_key` – idempotent on-chain writes.
6. **RPC adapters** with timeouts, jittered backoff, circuit breakers, token buckets.
7. **Partitioning** by stable key (`partition_key = hash(chainId:address)`), ordered consumption per partition.
8. **Batch I/O** everywhere; no per-row hot-path writes.
9. **Observability** baked in: metrics, tracing, health, replay tools.

Agents must not bypass these guarantees.

---
## 2) Agent Roles & Responsibilities

### A. Architect Agent
- Owns `docs/architecture.md` and `docs/data-model.md`.
- Keeps Mermaid diagrams and DDL in sync with code.
- Approves changes to core guarantees (Section 1).
- Deliverables:
  - Updated Mermaid diagram for RPC → Ingest → Outbox → Bus → Inbox → Domain Outbox → Executor
  - DDL for `infra.*` and `domain.*` tables

### B. Ingest Agent
- Owns `packages/ingest` and `packages/storage-postgres` (ingest repos).
- Implements adaptive `getLogs` scanning with token buckets and CB.
- Single transaction per chunk: insert `ingest_events` + `ingest_outbox` + bump cursor.
- Accepts `Subscriptions` (addresses + topics) and shards by partition key.
- Deliverables: `IngestDaemon`, `IngestPublisher`, unit/integration tests.

### C. Dispatch Agent
- Owns `packages/dispatch` and `packages/core` dispatch contracts.
- Consumes transport partitions, wraps handlers with `runWithInboxBatch`.
- Provides Command Bus for domain commands; supports Policies and Strategies.
- Deliverables: inbox gateway, command bus, batch handler API, DLQ handling.

### D. Executor Agent (EVM)
- Owns `packages/executor-evm` and write-side of `packages/adapters-evm`.
- Sends on-chain transactions from `domain_outbox` rows; writes back `tx_hash`.
- Manages nonce, gas, and rate-limit buckets; respects circuit breaker.

### E. Adapter Agent (RPC)
- Owns `packages/adapters-evm` read-side and shared resilience layer.
- Adds per-method timeouts, jittered retries, token buckets, CB.

### F. Storage Agent
- Owns `packages/storage-postgres` repositories and schema migrations.
- Exposes typed repos: `CursorStore`, `IngestRepo`, `IngestOutboxRepo`, `InboxRepo`, `DomainOutboxRepo`.

### G. Metrics Agent
- Owns `packages/metrics` and cross-cutting instrumentation.
- Exposes Prom/OTel metrics: backlog, rpc requests/errors, getLogs latency, inbox ACK/FAIL/DLQ, outbox lag, CB status.

### H. CLI Agent
- Owns `packages/cli` (`gx`).
- Commands:
  - `gx init-db`
  - `gx run ingest --shard 0/8`
  - `gx run publisher`
  - `gx run dispatch --partition <n>`
  - `gx run executor`
  - `gx replay --from <a> --to <b> --handler <Kind>`
  - `gx dlq --handler <Kind> --limit <N>`
  - `gx status`

### I. Example Agent
- Owns `examples/erc20-transfers` plugin demonstrating a subscription and a batch handler.

---
## 3) Folder Ownership & Boundaries
- `infra.*` schemas are **supporting subdomain**; shared across bounded contexts.
- `domain.*` schemas are **per bounded context**; never shared for business state.
- Handlers must only depend on `core` interfaces and `storage` repos, not raw clients.

---
## 4) Coding Standards
- **TypeScript** strict mode, `tsconfig` references per package.
- **Build:** tsup or tsx for dev; ESM first.
- **Lint/Format:** eslint + @typescript-eslint, prettier; CI-enforced.
- **Testing:** vitest + testcontainers (Postgres) for integration.
- **Commits:** Conventional Commits (`feat: ingest adaptive step`, `fix: inbox upsert race`).
- **Docs-as-code:** Any change to schemas or guarantees must update `docs/` and Mermaid.

---
## 5) Environment & Config
- Node 22.x, pnpm 9.x
- Required envs (12‑factor):
  - `RPC_READ_URL`, `RPC_WRITE_URL`
  - `DB_URL`
  - `GETLOGS_STEP_INIT`, `GETLOGS_STEP_MIN`, `GETLOGS_STEP_MAX`
  - `POLL_INTERVAL_MS`
  - `RPC_RPS_MAX_GETLOGS`, `RPC_RPS_MAX_BLOCKNUMBER`, `RPC_RPS_MAX_WRITES`
  - `EXECUTOR_ENABLED`
  - `ADDR_SHARDS`

All config must be overridable via env and surfaced via `/healthz` and `/metrics` labels.

---
## 6) Transport
- Default transport is DB-backed queue in `transport-dbqueue` consuming `infra.ingest_outbox`.
- Kafka is optional via `transport-kafka` (future); partition key must match `partition_key`.

---
## 7) Data Model (DDL)
Use these canonical tables. Storage Agent must ship migrations.

```sql
CREATE SCHEMA IF NOT EXISTS infra;
-- CREATE SCHEMA IF NOT EXISTS domain; -- each bounded context defines its own

CREATE TABLE IF NOT EXISTS infra.cursors (
  id TEXT PRIMARY KEY,
  last_processed_block BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS infra.ingest_events (
  event_id TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  address TEXT NOT NULL,
  topic0 TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ingest_events_address_topic_block
  ON infra.ingest_events (address, topic0, block_number);
CREATE INDEX IF NOT EXISTS ix_ingest_events_block
  ON infra.ingest_events (block_number);
CREATE INDEX IF NOT EXISTS ix_ingest_events_partition_key_block
  ON infra.ingest_events (partition_key, block_number);

CREATE TABLE IF NOT EXISTS infra.ingest_outbox (
  event_id TEXT PRIMARY KEY
    REFERENCES infra.ingest_events(event_id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_ingest_outbox_published_nulls_first
  ON infra.ingest_outbox (published_at ASC NULLS FIRST);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_status') THEN
    CREATE TYPE infra.inbox_status AS ENUM ('PENDING','ACK','FAIL','DLQ');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS infra.inbox (
  event_id TEXT NOT NULL,
  handler_kind TEXT NOT NULL,
  status infra.inbox_status NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  block_number BIGINT NOT NULL,
  partition_key TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, handler_kind)
);
CREATE INDEX IF NOT EXISTS ix_inbox_status_partition
  ON infra.inbox (status, partition_key);
CREATE INDEX IF NOT EXISTS ix_inbox_block_number
  ON infra.inbox (block_number);

-- Per-domain, defined in each domain schema
-- Example: CREATE SCHEMA IF NOT EXISTS nft;
--         CREATE TABLE IF NOT EXISTS nft.domain_outbox (...)
```

---
## 8) Milestones & Acceptance Criteria

### Milestone 1 — Skeleton & Schemas
- [ ] `pnpm -w init`, workspaces, Node 22 engines.
- [ ] Storage package with migrations that create Section 7 tables.
- [ ] CLI: `gx init-db` runs migrations.
- Acceptance: `gx init-db` succeeds on a clean Postgres, `/healthz` returns green.

### Milestone 2 — Ingest Path
- [ ] Adaptive `getLogs` loop with token buckets and CB.
- [ ] Batch insert `ingest_events` + `ingest_outbox` + cursor bump in one TX.
- [ ] Publisher marks `published_at` after successful publish.
- Acceptance: p95 getLogs < 1.5s for typical ranges; backlog ≤ 1 block under load test.

### Milestone 3 — Dispatch Path
- [ ] DB transport consumer partitioned by `partition_key`.
- [ ] Inbox batch wrapper, DLQ after N attempts.
- [ ] Example handler (ERC20) writing a toy projection.
- Acceptance: duplicate deliveries produce one projection change.

### Milestone 4 — Executor
- [ ] Domain outbox with deterministic `command_key`.
- [ ] EVM executor sending tx and writing `tx_hash`.
- Acceptance: re-sent commands do not produce duplicate transactions.

### Milestone 5 — Ops & Replay
- [ ] Metrics: backlog, RPC requests/errors, getLogs latency, inbox state, outbox lag, CB.
- [ ] CLI: `gx replay`, `gx dlq`, `gx status`.
- Acceptance: junior operator can drain DLQ and replay a range without code changes.

---
## 9) Agent Prompts (copy/paste)

**Architect Agent**
> Update `docs/architecture.md` with a Mermaid diagram for the RPC → Ingest → Outbox → Bus → Inbox → Domain Outbox → Executor flow. Ensure data model in `docs/data-model.md` matches `/packages/storage-postgres/migrations`.

**Ingest Agent**
> Implement adaptive `getLogs` scanning in `packages/ingest` with a token bucket and circuit breaker. One transaction per chunk: insert into `infra.ingest_events`, insert `infra.ingest_outbox`, update `infra.cursors`. Expose `IngestDaemon.start(shardId)`.

**Dispatch Agent**
> Build `runWithInboxBatch` in `packages/dispatch` that guards handlers by `(event_id, handler_kind)` and supports batch ACK/FAIL/DLQ. Provide a `CommandBus` to write `domain_outbox` rows in the same TX as state changes.

**Executor Agent**
> In `packages/executor-evm`, read `domain_outbox` where `published_at IS NULL`, send transactions with write RPC pool, then set `published_at` and `tx_hash`. Ensure idempotency via `command_key`.

**Metrics Agent**
> Instrument ingest, dispatch, and executor with Prom/OTel metrics listed in Section 11. Provide `/metrics` endpoint.

**CLI Agent**
> Implement `gx` commands listed in Section 2H using `commander` and `@manypkg/find-root` to operate at repo root.

---
## 10) Quality Gates (CI)
- Lint + typecheck must pass for all packages.
- Migrations are forward-only; `gx init-db` is idempotent.
- e2e test spins Postgres (testcontainers) and an RPC simulator; verifies exactly-once effects.
- Any change to `packages/adapters-evm` must include failure-injection tests (timeouts, 5xx).

---
## 11) Metrics (Prometheus names)
- `indexer_backlog{shard}` = `head - last_processed_block`
- `rpc_requests_total{method}` / `rpc_errors_total{method}`
- `getlogs_duration_ms` (histogram)
- `blocknumber_duration_ms` (histogram)
- `inbox_attempts_total{handlerKind,status}`
- `dlq_total{handlerKind}`
- `domain_outbox_lag{domain}`
- `cb_open_seconds{pool}` / `rate_limited_total{pool}`

---
## 12) Security & Compliance
- No secrets in logs. Mask RPC keys.
- Inbox payloads must not contain PII; store only what’s needed for replay/debug.
- Principle of least privilege DB roles: domains cannot alter `infra` schemas beyond INSERT/UPDATE on allowed tables.

---
## 13) Support & Runbooks
- **Replay range:** `gx replay --from <a> --to <b> --handler <Kind>`
- **Drain DLQ:** `gx dlq --handler <Kind> --limit <N>`
- **Degraded mode:** reduce `GETLOGS_STEP_*`, increase `POLL_INTERVAL_MS`, lower `RPC_RPS_MAX_*`, pause executor with `EXECUTOR_ENABLED=false`.

---
## 14) Appendix — Mermaid Diagram
```mermaid
flowchart LR
  subgraph RPC["RPC Providers"]
    RPCR[Read Pool<br/>(CB + retries + token bucket)]
    RPCW[Write Pool<br/>(CB + retries + token bucket)]
  end

  subgraph Ingest["Ingestion"]
    I[Ingest Daemon\nadaptive ranges]
    EV[(infra.ingest_events)]
    IO[(infra.ingest_outbox)]
    CUR[(infra.cursors)]
  end

  subgraph Dispatch["Dispatch & Domains"]
    BUS[[DB Queue / Bus\npartitioned by partition_key]]
    D[Dispatcher]
    INBOX[(infra.inbox)]
    DOX[(domain.domain_outbox)]
  end

  subgraph Exec["Chain Executor"]
    EX[Executor\nreads domain_outbox, sends tx, writes tx_hash]
  end

  RPCR -->|getLogs, blockNumber| I
  I -->|INSERT batch| EV
  I -->|INSERT batch| IO
  I -->|UPDATE| CUR
  IO -->|publish exactly once| BUS
  BUS --> D
  D -->|run handler| INBOX
  D -->|emit command| DOX
  EX -->|read pending| DOX
  EX -->|send tx| RPCW
  EX -->|mark tx_hash| DOX
```