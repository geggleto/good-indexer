import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'domain_outbox', schema: 'domain' })
@Index({ name: 'ix_domain_outbox_published_nulls_first', expression: 'published_at ASC NULLS FIRST' })
export class DomainOutboxEntity {
  @PrimaryKey({ type: 'text' })
  command_key!: string;

  @Property({ type: 'text' })
  kind!: string;

  @Property({ type: 'json' })
  payload!: unknown;

  @Property({ type: 'timestamptz', nullable: true })
  published_at?: Date | null;

  @Property({ type: 'text', nullable: true })
  tx_hash?: string | null;
}

