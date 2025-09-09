import { Migration } from '@mikro-orm/migrations';

export class Migration0003 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE SCHEMA IF NOT EXISTS domain;`);
    this.addSql(`CREATE TABLE IF NOT EXISTS domain.domain_outbox (
      command_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload JSONB NOT NULL,
      published_at TIMESTAMPTZ,
      tx_hash TEXT
    );`);
    this.addSql(`CREATE INDEX IF NOT EXISTS ix_domain_outbox_published_nulls_first ON domain.domain_outbox (published_at ASC NULLS FIRST);`);
  }
}

