import { describe, it, expect } from 'vitest';
import { toHex32 } from './index.js';

describe('toHex32', () => {
  it('produces deterministic 64-hex-character string', () => {
    const a1 = toHex32('abc');
    const a2 = toHex32('abc');
    const b = toHex32('abcd');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });
});

