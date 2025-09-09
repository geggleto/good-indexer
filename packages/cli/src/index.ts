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

program
  .command('run')
  .description('Run a component')
  .option('--ingest', 'Run ingest daemon')
  .option('--publisher', 'Run ingest publisher')
  .option('--shard <label>', 'Shard label', 'shard-0')
  .action(async (opts: { ingest?: boolean; publisher?: boolean; shard?: string }) => {
    const ingestPkg: any = await import('@good-indexer/ingest');
    const cfgResult = ingestPkg.configSchema.safeParse({});
    if (!cfgResult.success) {
      console.error('Invalid config', cfgResult.error.flatten());
      process.exit(1);
    }
    const cfg = cfgResult.data;
    if (opts.ingest) {
      const daemon = new ingestPkg.IngestDaemon(cfg);
      await daemon.start(opts.shard!, cfg.subscriptions ?? []);
      return;
    }
    if (opts.publisher) {
      const publisher = new ingestPkg.IngestPublisher(cfg.dbUrl);
      await publisher.start(async (eventId: string) => {
        console.log('publish', eventId);
      });
      return;
    }
    console.error('Specify --ingest or --publisher');
    process.exit(1);
  });

program.parseAsync();

