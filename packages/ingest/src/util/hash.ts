import { createHash } from 'node:crypto';

export function stablePartitionKey(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  return hash;
}

