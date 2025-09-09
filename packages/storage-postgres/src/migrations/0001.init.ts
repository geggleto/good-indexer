import { Migration } from '@mikro-orm/migrations';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export class Migration0001 extends Migration {
  async up(): Promise<void> {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    const sqlPath = resolve(currentDir, '../../migrations/0001_init_infra.sql');
    const ddl = readFileSync(sqlPath, 'utf8');
    this.addSql(ddl);
  }
}

