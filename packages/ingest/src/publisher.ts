import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { resolve } from 'node:path';
import { findRootSync } from '@manypkg/find-root';
import { setTimeout as delayMs } from 'timers/promises';

export class IngestPublisher {
  private orm!: MikroORM;
  private dbUrl: string;
  private running = false;

  constructor(dbUrl: string) {
    this.dbUrl = dbUrl;
  }

  async initOrm(): Promise<void> {
    const monorepoRoot = findRootSync(process.cwd()).rootDir;
    this.orm = await MikroORM.init({
      extensions: [pg.PostgreSqlDriver],
      clientUrl: this.dbUrl,
      entities: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      allowGlobalContext: true,
    } as any);
  }

  async start(onPublish: (eventId: string) => Promise<void>): Promise<void> {
    if (!this.orm) await this.initOrm();
    this.running = true;
    const conn = this.orm.em.getConnection();
    while (this.running) {
      const rows = (await conn.execute(
        `SELECT event_id FROM infra.ingest_outbox WHERE published_at IS NULL ORDER BY event_id ASC NULLS LAST LIMIT 500`
      )) as Array<{ event_id: string }>;
      if (rows.length === 0) {
        await delay(250);
        continue;
      }
      for (const row of rows) {
        try {
          await onPublish(row.event_id);
          await conn.execute(
            `UPDATE infra.ingest_outbox SET published_at = now() WHERE event_id = $1`,
            [row.event_id]
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('publish error', err);
        }
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}

function delay(ms: number): Promise<void> {
  return delayMs(ms) as unknown as Promise<void>;
}

