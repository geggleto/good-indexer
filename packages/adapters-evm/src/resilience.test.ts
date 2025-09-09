import { describe, it, expect, vi } from 'vitest';
import { TokenBucket, CircuitBreaker } from './resilience.js';

describe('TokenBucket', () => {
  it('consumes tokens up to capacity without waiting', async () => {
    const bucket = new TokenBucket(10, 3);
    await bucket.take();
    await bucket.take();
    await bucket.take();
  });

  it('refills over time according to rps', async () => {
    vi.useFakeTimers();
    try {
      const bucket = new TokenBucket(2, 1); // 2 tokens/sec, burst 1
      await bucket.take(); // consume initial token

      let resolved = false;
      const p = bucket.take().then(() => {
        resolved = true;
      });

      // Not enough time elapsed yet
      await vi.advanceTimersByTimeAsync(200);
      expect(resolved).toBe(false);

      // After 500ms, 1 token should be refilled
      await vi.advanceTimersByTimeAsync(500);
      await p;
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CircuitBreaker', () => {
  it('opens after threshold and then closes after open window', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker(2, 1); // 2 failures to open, open for 1s
      await expect(cb.execute(async () => {
        throw new Error('boom');
      })).rejects.toThrow();

      await expect(cb.execute(async () => {
        throw new Error('boom');
      })).rejects.toThrow();

      // Should be open now
      await expect(cb.execute(async () => 'ok')).rejects.toThrow(/circuit_open/);
      expect(cb.getOpenRemainingSeconds()).toBeGreaterThan(0);

      // Advance beyond openSeconds
      await vi.advanceTimersByTimeAsync(1100);

      // Next success should pass and start closing logic
      const res = await cb.execute(async () => 'ok');
      expect(res).toBe('ok');

      // Another success should reset failure counts internally; further calls pass
      await cb.execute(async () => 'ok');
    } finally {
      vi.useRealTimers();
    }
  });
});

