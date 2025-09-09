#!/usr/bin/env node
/// <reference types="node" />
import 'dotenv/config';
import { Command } from 'commander';
import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { findRootSync } from '@manypkg/find-root';
import { resolve } from 'path';

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

program
  .command('replay')
  .description('Replay a block range for a handler into the inbox')
  .requiredOption('--from <block>', 'From block (inclusive)')
  .requiredOption('--to <block>', 'To block (inclusive)')
  .requiredOption('--handler <kind>', 'Handler kind label for inbox')
  .option('--batch <n>', 'Batch size for upserts', '1000')
  .action(async (opts: { from: string; to: string; handler: string; batch?: string }) => {
    const dbUrl = process.env.DB_URL;
    if (!dbUrl) {
      console.error('DB_URL is required');
      process.exit(1);
    }
    const dispatchPkg: any = await import('@good-indexer/dispatch');
    const fromBn = BigInt(opts.from);
    const toBn = BigInt(opts.to);
    if (toBn < fromBn) {
      console.error('--to must be >= --from');
      process.exit(1);
    }
    const batchSize = Number(opts.batch ?? '1000');
    const res = await dispatchPkg.replayRange(dbUrl, opts.handler, fromBn, toBn, batchSize);
    console.log(JSON.stringify({ ...res, from: opts.from, to: opts.to, handler: opts.handler }, null, 2));
  });

program
  .command('dlq')
  .description('Reset DLQ or FAIL entries back to PENDING for a handler')
  .requiredOption('--handler <kind>', 'Handler kind label for inbox')
  .requiredOption('--limit <n>', 'Maximum rows to reset')
  .option('--source <dlq|fail>', 'Which source status to drain', 'dlq')
  .action(async (opts: { handler: string; limit: string; source?: string }) => {
    const dbUrl = process.env.DB_URL;
    if (!dbUrl) {
      console.error('DB_URL is required');
      process.exit(1);
    }
    const dispatchPkg: any = await import('@good-indexer/dispatch');
    const limit = Number(opts.limit);
    if (opts.source?.toLowerCase() === 'fail') {
      await dispatchPkg.dlqFailures(dbUrl, opts.handler, limit);
      console.log(JSON.stringify({ handler: opts.handler, reset: 'FAIL->PENDING', limit }, null, 2));
    } else {
      await dispatchPkg.dlqDrain(dbUrl, opts.handler, limit);
      console.log(JSON.stringify({ handler: opts.handler, reset: 'DLQ->PENDING', limit }, null, 2));
    }
  });

program
  .command('status')
  .description('Show operational status from DB and RPC head')
  .option('--handler <kind>', 'Optional handler to scope inbox counts')
  .option('--json', 'Output JSON instead of text')
  .action(async (opts: { handler?: string; json?: boolean }) => {
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
      allowGlobalContext: true,
    } as any);

    const conn = orm.em.getConnection();
    const adapters: any = await import('@good-indexer/adapters-evm');
    const rpcUrl = process.env.RPC_READ_URL;
    let head: bigint | null = null;
    if (rpcUrl) {
      try {
        const rpc = new adapters.RpcReadClient(rpcUrl);
        head = await rpc.getBlockNumber(800);
      } catch {
        head = null;
      }
    }

    const cursors = (await conn.execute(
      `SELECT id, last_processed_block FROM infra.cursors ORDER BY id ASC`
    )) as Array<{ id: string; last_processed_block: string }>;

    const outboxPending = (await conn.execute(
      `SELECT COUNT(*)::int AS c FROM infra.ingest_outbox WHERE published_at IS NULL`
    )) as Array<{ c: number }>;

    const inboxCounts = (await conn.execute(
      opts.handler
        ? `SELECT status, COUNT(*)::int AS c FROM infra.inbox WHERE handler_kind = $1 GROUP BY status`
        : `SELECT status, COUNT(*)::int AS c FROM infra.inbox GROUP BY status`,
      opts.handler ? [opts.handler] : []
    )) as Array<{ status: string; c: number }>;

    const domainUnpub = (await conn.execute(
      `SELECT COUNT(*)::int AS c FROM domain.domain_outbox WHERE published_at IS NULL`
    )) as Array<{ c: number }>;

    await orm.close(true);

    const cursorSummaries = cursors.map((c) => ({
      id: c.id,
      last_processed_block: c.last_processed_block,
      backlog: head ? Number(head - BigInt(c.last_processed_block)) : null,
    }));

    const result = {
      head: head ? head.toString() : null,
      cursors: cursorSummaries,
      ingest_outbox_pending: outboxPending[0]?.c ?? 0,
      inbox_counts: inboxCounts.reduce((acc, r) => ({ ...acc, [r.status]: r.c }), {} as Record<string, number>),
      domain_outbox_unpublished: domainUnpub[0]?.c ?? 0,
    };

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Head:', result.head ?? 'unknown');
      for (const c of result.cursors) {
        console.log(`Cursor ${c.id}: last=${c.last_processed_block} backlog=${c.backlog ?? 'n/a'}`);
      }
      console.log('Ingest outbox pending:', result.ingest_outbox_pending);
      console.log('Inbox counts:', JSON.stringify(result.inbox_counts));
      console.log('Domain outbox unpublished:', result.domain_outbox_unpublished);
    }
  });

program.parseAsync();

