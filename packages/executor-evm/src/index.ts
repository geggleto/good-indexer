import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { Gauge, MetricsRegistry, MetricsServer } from '@good-indexer/metrics';
// Note: to keep executor minimal here, avoid actual wallet send; compute deterministic tx hash
export type Hex = `0x${string}`;

export type ExecutorConfig = {
  dbUrl: string;
  rpcWriteUrl: string;
  executorEnabled?: boolean;
};

export class EvmExecutor {
  private orm!: MikroORM;
  private running = false;
  private readonly cfg: Required<ExecutorConfig>;
  private registry: MetricsRegistry = new MetricsRegistry();
  private metrics = {
    outboxUnpublished: this.registry.register(new Gauge('domain_outbox_unpublished', 'Unpublished domain outbox rows')),
  };
  private metricsServer?: MetricsServer;

  constructor(cfg: ExecutorConfig) {
    this.cfg = {
      executorEnabled: true,
      ...cfg,
    } as Required<ExecutorConfig>;
  }

  async initOrm(): Promise<void> {
    const monorepoRoot = findMonorepoRoot(process.cwd());
    this.orm = await MikroORM.init({
      extensions: [pg.PostgreSqlDriver],
      clientUrl: this.cfg.dbUrl,
      entities: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      allowGlobalContext: true,
    } as any);
  }

  async run(): Promise<void> {
    if (!this.orm) await this.initOrm();
    if (!this.cfg.executorEnabled) return;
    this.running = true;
    this.metricsServer = new MetricsServer(this.registry);
    this.metricsServer.start();
    const conn = this.orm.em.getConnection();

    while (this.running) {
      const rows = (await conn.execute(
        `SELECT command_key, kind, payload FROM domain.domain_outbox WHERE published_at IS NULL ORDER BY command_key ASC NULLS LAST LIMIT 100`
      )) as Array<{ command_key: string; kind: string; payload: any }>;
      const cnt = (await conn.execute(
        `SELECT COUNT(*)::int AS c FROM domain.domain_outbox WHERE published_at IS NULL`
      )) as Array<{ c: number }>;
      this.metrics.outboxUnpublished.set({}, cnt[0]?.c ?? 0);
      if (rows.length === 0) {
        await delay(300);
        continue;
      }

      for (const row of rows) {
        try {
          // Compute deterministic fake hash from command_key (idempotent)
          const txHash = '0x' + toHex32(row.command_key);
          await conn.execute(
            `UPDATE domain.domain_outbox SET published_at = now(), tx_hash = $2 WHERE command_key = $1 AND published_at IS NULL`,
            [row.command_key, txHash]
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('executor error', err);
        }
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}

export function toHex32(input: string): string {
  // Simple deterministic hash substitute (not cryptographic) to keep example dependency-light
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = Math.imul(h1, h2 >>> 1).toString(16).slice(-8).padStart(8, '0');
  return `${part1}${part2}${part3}${part4}`;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function findMonorepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

