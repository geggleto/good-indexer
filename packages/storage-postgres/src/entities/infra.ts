import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'cursors', schema: 'infra' })
export class InfraCursorEntity {
  @PrimaryKey({ type: 'text' })
  id!: string;

  @Property({ type: 'bigint' })
  last_processed_block!: string; // store as string to avoid precision issues
}

@Entity({ tableName: 'ingest_events', schema: 'infra' })
@Index({ properties: ['address', 'topic0', 'block_number'], name: 'ix_ingest_events_address_topic_block' })
@Index({ properties: ['block_number'], name: 'ix_ingest_events_block' })
@Index({ properties: ['partition_key', 'block_number'], name: 'ix_ingest_events_partition_key_block' })
export class InfraIngestEventEntity {
  @PrimaryKey({ type: 'text' })
  event_id!: string;

  @Property({ type: 'bigint' })
  block_number!: string;

  @Property({ type: 'text' })
  block_hash!: string;

  @Property({ type: 'text' })
  address!: string;

  @Property({ type: 'text' })
  topic0!: string;

  @Property({ type: 'text' })
  partition_key!: string;

  @Property({ type: 'json' })
  payload!: unknown;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  created_at!: Date;
}

@Entity({ tableName: 'ingest_outbox', schema: 'infra' })
@Index({ name: 'ix_ingest_outbox_published_nulls_first', expression: 'published_at ASC NULLS FIRST' })
export class InfraIngestOutboxEntity {
  @PrimaryKey({ type: 'text' })
  event_id!: string; // references infra.ingest_events(event_id)

  @Property({ type: 'timestamptz', nullable: true })
  published_at?: Date | null;
}

@Entity({ tableName: 'inbox', schema: 'infra' })
@Index({ properties: ['status', 'partition_key'], name: 'ix_inbox_status_partition' })
@Index({ properties: ['block_number'], name: 'ix_inbox_block_number' })
export class InfraInboxEntity {
  @PrimaryKey({ type: 'text' })
  event_id!: string;

  @PrimaryKey({ type: 'text' })
  handler_kind!: string;

  @Property({ columnType: 'infra.inbox_status', defaultRaw: `'PENDING'::infra.inbox_status` })
  status!: string;

  @Property({ type: 'int' })
  attempts!: number;

  @Property({ type: 'text', nullable: true })
  last_error?: string | null;

  @Property({ type: 'bigint' })
  block_number!: string;

  @Property({ type: 'text' })
  partition_key!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  first_seen_at!: Date;

  @Property({ type: 'timestamptz', nullable: true })
  last_attempt_at?: Date | null;
}

