import { Migration } from '@mikro-orm/migrations';

export class Migration0002 extends Migration {
  async up(): Promise<void> {
    this.addSql(`CREATE SCHEMA IF NOT EXISTS domain;`);
    this.addSql(`CREATE TABLE IF NOT EXISTS domain.erc20_balances (
      address TEXT PRIMARY KEY,
      balance NUMERIC NOT NULL DEFAULT 0
    );`);
  }
}

