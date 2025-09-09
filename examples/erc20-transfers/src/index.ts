import type { BatchHandler, InboxEvent } from '@good-indexer/dispatch';

// Toy projection table DDL (domain schema) for balances
// CREATE SCHEMA IF NOT EXISTS domain;
// CREATE TABLE IF NOT EXISTS domain.erc20_balances (
//   address TEXT PRIMARY KEY,
//   balance NUMERIC NOT NULL DEFAULT 0
// );

export const Erc20Projector: BatchHandler = async (events: InboxEvent[], tx) => {
  // This example just writes a simple projection that counts events by address
  const counts = new Map<string, number>();
  for (const ev of events) {
    const addr = ev.address.toLowerCase();
    counts.set(addr, (counts.get(addr) ?? 0) + 1);
  }
  for (const [address, count] of counts.entries()) {
    await tx.execute(
      `INSERT INTO domain.erc20_balances (address, balance) VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE SET balance = domain.erc20_balances.balance + EXCLUDED.balance`,
      [address, count]
    );
  }
};

