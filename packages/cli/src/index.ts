#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { findRootSync } from '@manypkg/find-root';
import { resolve } from 'node:path';

const program = new Command();

program
  .name('gx')
  .description('Good Indexer CLI')
  .version('0.1.0');

program
  .command('init-db')
  .description('Run database migrations')
  .action(async () => {
    const dbUrl = process.env.DB_URL;
    if (!dbUrl) {
      console.error('DB_URL is required');
      process.exit(1);
    }

    const monorepoRoot = findRootSync(process.cwd()).rootDir;
    const orm = await MikroORM.init({
      extensions: [pg.PostgreSqlDriver],
      clientUrl: dbUrl,
      entities: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      migrations: {
        path: resolve(monorepoRoot, 'packages/storage-postgres/src/migrations'),
        tableName: 'mikro_orm_migrations',
      },
      allowGlobalContext: true,
    } as any);

    const migrator = orm.getMigrator();
    await migrator.up();
    await orm.close(true);
    console.log('Migrations applied successfully');
  });

program.parseAsync();

