CREATE SCHEMA IF NOT EXISTS infra;

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
