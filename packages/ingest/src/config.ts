import { z } from 'zod';

export const configSchema = z.object({
  rpcReadUrl: z.string().url().default(process.env.RPC_READ_URL ?? ''),
  dbUrl: z.string().min(1).default(process.env.DB_URL ?? ''),
  pollIntervalMs: z.coerce.number().int().positive().default(Number(process.env.POLL_INTERVAL_MS ?? 300)),
  getLogsStepInit: z.coerce.number().int().positive().default(Number(process.env.GETLOGS_STEP_INIT ?? 1000)),
  getLogsStepMin: z.coerce.number().int().positive().default(Number(process.env.GETLOGS_STEP_MIN ?? 500)),
  getLogsStepMax: z.coerce.number().int().positive().default(Number(process.env.GETLOGS_STEP_MAX ?? 20000)),
  rpcRpsMaxGetLogs: z.coerce.number().int().positive().default(Number(process.env.RPC_RPS_MAX_GETLOGS ?? 5)),
  rpcRpsMaxBlockNumber: z.coerce.number().int().positive().default(Number(process.env.RPC_RPS_MAX_BLOCKNUMBER ?? 10)),
  addrShards: z.coerce.number().int().positive().default(Number(process.env.ADDR_SHARDS ?? 1)),
  chainId: z.string().optional(),
  subscriptions: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return [] as Array<{ address?: string; topic0?: string }>;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed as Array<{ address?: string; topic0?: string }>;
      } catch {}
      return [] as Array<{ address?: string; topic0?: string }>;
    }),
});

export type IngestConfig = z.infer<typeof configSchema>;

