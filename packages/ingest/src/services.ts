import { injectable } from 'inversify';
import { MikroORM } from '@mikro-orm/core';
import { RpcReadClient } from '@good-indexer/adapters-evm';
import { TokenBucket, CircuitBreaker } from '@good-indexer/adapters-evm';
import { Counter, Histogram, Gauge, MetricsServer } from '@good-indexer/metrics';
import { findRootSync } from '@manypkg/find-root';
import { resolve } from 'path';
import { stablePartitionKey } from './util/hash.js';
import {
  IRpcReadClient,
  ITokenBucket,
  ICircuitBreaker,
  IMetricsRegistry,
  ICounter,
  IHistogram,
  IGauge,
  IMetricsServer,
  IMikroORM,
  ILogger,
  IDelay,
  IHashService,
  IPathService,
  IFindRootService,
} from './interfaces.js';

@injectable()
export class RpcReadClientService implements IRpcReadClient {
  private client: RpcReadClient;

  constructor(rpcUrl: string) {
    this.client = new RpcReadClient(rpcUrl);
  }

  async getBlockNumber(timeout: number): Promise<bigint> {
    return this.client.getBlockNumber(timeout);
  }

  async getLogs(params: any, timeout: number): Promise<any[]> {
    return this.client.getLogs(params, timeout);
  }
}

@injectable()
export class TokenBucketService implements ITokenBucket {
  private bucket: TokenBucket;

  constructor(rps: number) {
    this.bucket = new TokenBucket(rps);
  }

  async consume(_tokens: number): Promise<boolean> {
    await this.bucket.take();
    return true;
  }
}

@injectable()
export class CircuitBreakerService implements ICircuitBreaker {
  private breaker: CircuitBreaker;

  constructor() {
    this.breaker = new CircuitBreaker();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.breaker.execute(fn);
  }

  getOpenRemainingSeconds(): number {
    return this.breaker.getOpenRemainingSeconds();
  }
}

@injectable()
export class MetricsRegistryService implements IMetricsRegistry {
  constructor() {
    // Registry not needed for this implementation
  }

  createCounter(name: string, help: string): any {
    return new Counter(name, help);
  }

  createHistogram(name: string, help: string): any {
    return new Histogram(name, help);
  }

  createGauge(name: string, help: string): any {
    return new Gauge(name, help);
  }
}

@injectable()
export class CounterService implements ICounter {
  private counter: Counter;

  constructor(name: string, help: string) {
    this.counter = new Counter(name, help);
  }

  inc(labels?: Record<string, string>): void {
    this.counter.inc(labels);
  }
}

@injectable()
export class HistogramService implements IHistogram {
  private histogram: Histogram;

  constructor(name: string, help: string) {
    this.histogram = new Histogram(name, help);
  }

  observe(value: number, labels?: Record<string, string>): void {
    this.histogram.observe(labels || {}, value);
  }
}

@injectable()
export class GaugeService implements IGauge {
  private gauge: Gauge;

  constructor(name: string, help: string) {
    this.gauge = new Gauge(name, help);
  }

  set(value: number, labels?: Record<string, string>): void {
    this.gauge.set(labels || {}, value);
  }
}

@injectable()
export class MetricsServerService implements IMetricsServer {
  private server: MetricsServer;

  constructor(registry: IMetricsRegistry) {
    this.server = new MetricsServer(registry as any);
  }

  start(): void {
    this.server.start();
  }

  stop(): void {
    this.server.stop();
  }
}

@injectable()
export class MikroORMService implements IMikroORM {
  async init(): Promise<any> {
    return MikroORM.init({} as any);
  }

  getEntityManager(): any {
    return {} as any;
  }

  async close(): Promise<void> {
    // Implementation
  }
}

@injectable()
export class LoggerService implements ILogger {
  info(message: string, ...args: any[]): void {
    console.log(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(message, ...args);
  }
}

@injectable()
export class DelayService implements IDelay {
  async delay(ms: number): Promise<void> {
    return new Promise((resolve) => (globalThis as any).setTimeout(resolve, ms));
  }
}

@injectable()
export class HashService implements IHashService {
  hash(input: string): string {
    return stablePartitionKey(input);
  }
}

@injectable()
export class PathService implements IPathService {
  resolve(...paths: string[]): string {
    return resolve(...paths);
  }
}

@injectable()
export class FindRootService implements IFindRootService {
  findRootSync(cwd: string): string {
    return findRootSync(cwd).rootDir;
  }
}
