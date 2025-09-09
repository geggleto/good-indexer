import { describe, it, expect, vi } from 'vitest';
vi.mock('@mikro-orm/core', () => ({}));
vi.mock('@mikro-orm/postgresql', () => ({}));
vi.mock('@good-indexer/metrics', () => ({
  Gauge: class { set() {} },
  MetricsRegistry: class { register(x: any) { return x; } },
  MetricsServer: class { start() {} stop() {} },
}));
import { toHex32 } from './index.js';

describe('toHex32', () => {
  it('produces deterministic hex string', () => {
    const a1 = toHex32('abc');
    const a2 = toHex32('abc');
    const b = toHex32('abcd');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]+$/);
  });
});

