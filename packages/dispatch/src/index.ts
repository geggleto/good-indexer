import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { findRootSync } from '@manypkg/find-root';
import { resolve } from 'node:path';

export type DispatchConfig = {
  dbUrl: string;
  handlerKind: string; // e.g., "Examples.Erc20Projector"
  partitionSelector?: string; // e.g., "0:" prefix for a shard
  maxAttempts?: number;
  batchSize?: number;
};

export type InboxEvent = {
  event_id: string;
  block_number: string;
  partition_key: string;
  address: string;
  topic0: string;
  payload: unknown;
};

export type BatchHandler = (events: InboxEvent[], tx: { execute: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<void>;

export class Dispatcher {
  private orm!: MikroORM;
  private running = false;
  private readonly cfg: Required<DispatchConfig>;

  constructor(cfg: DispatchConfig) {
    this.cfg = {
      maxAttempts: 5,
      batchSize: 200,
      partitionSelector: '',
      ...cfg,
    } as Required<DispatchConfig>;
  }

  async initOrm(): Promise<void> {
    const monorepoRoot = findRootSync(process.cwd()).rootDir;
    this.orm = await MikroORM.init({
      extensions: [pg.PostgreSqlDriver],
      clientUrl: this.cfg.dbUrl,
      entities: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      allowGlobalContext: true,
    } as any);
  }

  async runWithInboxBatch(handler: BatchHandler): Promise<void> {
    if (!this.orm) await this.initOrm();
    this.running = true;
    const em = this.orm.em.fork();
    const conn = em.getConnection();

    while (this.running) {
      // Pick a batch of published ingest events from outbox, join fields for inbox rows
      let sql =
        `SELECT e.event_id, e.block_number, e.partition_key, e.address, e.topic0, e.payload
         FROM infra.ingest_outbox o
         JOIN infra.ingest_events e ON e.event_id = o.event_id
         WHERE o.published_at IS NOT NULL`;
      const params: unknown[] = [];
      if (this.cfg.partitionSelector && this.cfg.partitionSelector.length > 0) {
        sql += ' AND e.partition_key LIKE $' + (params.length + 1);
        params.push(`${this.cfg.partitionSelector}%`);
      }
      // Exclude events already present for this handler in inbox (any status)
      sql +=
        ' AND NOT EXISTS (SELECT 1 FROM infra.inbox i WHERE i.event_id = e.event_id AND i.handler_kind = $' +
        (params.length + 1) +
        ')';
      params.push(this.cfg.handlerKind);
      sql += ' ORDER BY e.block_number ASC LIMIT $' + (params.length + 1);
      params.push(this.cfg.batchSize);
      const rows = (await conn.execute(sql, params)) as InboxEvent[];

      if (rows.length === 0) {
        await delay(200);
        continue;
      }

      await conn.transactional(async (trx: any) => {
        // Insert PENDING inbox rows idempotently for this handler and only process inserted ones (dedupe across workers)
        const valuesSql = rows
          .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, 'PENDING'::infra.inbox_status, 0, NULL, $${i * 4 + 3}, $${i * 4 + 4}, now(), NULL)`) // 4 params per row
          .join(',');
        const insertParams: unknown[] = [];
        for (const r of rows) {
          insertParams.push(r.event_id, this.cfg.handlerKind, r.block_number, r.partition_key);
        }
        const inserted = (await trx.execute(
          `INSERT INTO infra.inbox (event_id, handler_kind, status, attempts, last_error, block_number, partition_key, first_seen_at, last_attempt_at)
           VALUES ${valuesSql}
           ON CONFLICT (event_id, handler_kind) DO NOTHING
           RETURNING event_id`,
          insertParams
        )) as Array<{ event_id: string }>;

        if (inserted.length === 0) {
          return; // nothing to do (another worker won the race)
        }

        const toProcess = rows.filter((r) => inserted.find((i) => i.event_id === r.event_id));

        try {
          // Run user handler guarded by inbox; pass the same transaction handle
          await handler(toProcess, trx);

          // Mark ACK for processed rows
          const idsParams = toProcess.map((_, i) => `$${i + 1}`).join(',');
          await trx.execute(
            `UPDATE infra.inbox
             SET status = 'ACK', attempts = attempts + 1, last_attempt_at = now(), last_error = NULL
             WHERE handler_kind = $${toProcess.length + 1} AND event_id IN (${idsParams})`,
            [...toProcess.map((r) => r.event_id), this.cfg.handlerKind]
          );
        } catch (err: any) {
          const errorMsg = (err?.message ?? String(err)).slice(0, 500);
          const idsParams = toProcess.map((_, i) => `$${i + 1}`).join(',');
          await trx.execute(
            `UPDATE infra.inbox
             SET attempts = attempts + 1,
                 status = CASE WHEN attempts + 1 >= $${toProcess.length + 2} THEN 'DLQ' ELSE 'FAIL' END,
                 last_attempt_at = now(),
                 last_error = $${toProcess.length + 3}
             WHERE handler_kind = $${toProcess.length + 1} AND event_id IN (${idsParams})`,
            [...toProcess.map((r) => r.event_id), this.cfg.handlerKind, this.cfg.maxAttempts, errorMsg]
          );
        }
      });
    }
  }

  stop(): void {
    this.running = false;
  }
}

export async function dlqFailures(dbUrl: string, handlerKind: string, limit: number): Promise<void> {
  const monorepoRoot = findRootSync(process.cwd()).rootDir;
  const orm = await MikroORM.init({
    extensions: [pg.PostgreSqlDriver],
    clientUrl: dbUrl,
    entities: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
    entitiesTs: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
    allowGlobalContext: true,
  } as any);
  const conn = orm.em.getConnection();
  const rows = (await conn.execute(
    `SELECT event_id FROM infra.inbox WHERE handler_kind = $1 AND status = 'FAIL' ORDER BY last_attempt_at ASC NULLS FIRST LIMIT $2`,
    [handlerKind, limit]
  )) as Array<{ event_id: string }>;
  if (rows.length === 0) return;
  const idsParams = rows.map((_, i) => `$${i + 1}`).join(',');
  await conn.execute(
    `UPDATE infra.inbox SET status = 'PENDING', last_error = NULL WHERE handler_kind = $${rows.length + 1} AND event_id IN (${idsParams})`,
    [...rows.map((r) => r.event_id), handlerKind]
  );
  await orm.close(true);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

