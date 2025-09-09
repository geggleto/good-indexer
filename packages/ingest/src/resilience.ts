export class TokenBucket {
  private capacity: number;
  private tokens: number;
  private refillPerSecond: number;
  private lastRefillMs: number;

  constructor(rpsMax: number, burst?: number) {
    this.capacity = Math.max(1, burst ?? rpsMax);
    this.tokens = this.capacity;
    this.refillPerSecond = Math.max(1, rpsMax);
    this.lastRefillMs = Date.now();
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = 50;
      await delay(waitMs);
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillMs) / 1000;
    if (elapsedSec <= 0) return;
    const add = elapsedSec * this.refillPerSecond;
    if (add >= 1) {
      this.tokens = Math.min(this.capacity, this.tokens + Math.floor(add));
      this.lastRefillMs = now;
    }
  }
}

export class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private openUntil = 0;
  // half-open window not yet used; future improvement

  constructor(
    private failureThreshold = 5,
    private openSeconds = 5
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (now < this.openUntil) {
      throw new Error('circuit_open');
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.successCount += 1;
    if (this.successCount >= 2) {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.openUntil = Date.now() + this.openSeconds * 1000;
      this.successCount = 0;
      this.failureCount = 0;
    }
  }

  getOpenRemainingSeconds(): number {
    const now = Date.now();
    if (this.openUntil <= now) return 0;
    return Math.ceil((this.openUntil - now) / 1000);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

