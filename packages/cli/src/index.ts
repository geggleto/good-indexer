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
  .option('--dispatch', 'Run dispatcher')
  .option('--executor', 'Run EVM executor')
  .option('--handler <kind>', 'Handler kind label for inbox')
  .option('--partition <selector>', 'Partition selector prefix (e.g., 0:)')
  .option('--shard <label>', 'Shard label', 'shard-0')
  .action(async (opts: { ingest?: boolean; publisher?: boolean; dispatch?: boolean; executor?: boolean; shard?: string; handler?: string; partition?: string }) => {
    const ingestPkg: any = await import('@good-indexer/ingest');
    const dispatchPkg: any = await import('@good-indexer/dispatch');
    const executorPkg: any = await import('@good-indexer/executor-evm').catch(() => null);
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
    if (opts.dispatch) {
      const handlerKind = opts.handler ?? 'Examples.Erc20Projector';
      const dispatcher = new dispatchPkg.Dispatcher({
        dbUrl: cfg.dbUrl,
        handlerKind,
        partitionSelector: opts.partition ?? '',
      });
      let handler: any;
      if (handlerKind === 'Examples.Erc20Projector') {
        const ex = await import('@good-indexer/examples-erc20-transfers');
        handler = ex.Erc20Projector;
      } else {
        handler = async (events: any[]) => {
          console.log('dispatch batch', events.length);
        };
      }
      await dispatcher.runWithInboxBatch(handler);
      return;
    }
    if (opts.executor) {
      if (!executorPkg) {
        console.error('executor package not available');
        process.exit(1);
      }
      const exec = new executorPkg.EvmExecutor({
        dbUrl: cfg.dbUrl,
        rpcWriteUrl: process.env.RPC_WRITE_URL ?? cfg.rpcReadUrl ?? '',
        executorEnabled: String(process.env.EXECUTOR_ENABLED ?? 'true') !== 'false',
      });
      await exec.run();
      return;
    }
    console.error('Specify --ingest or --publisher or --dispatch or --executor');
    process.exit(1);
  });

program.parseAsync();

