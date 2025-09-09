// Service interfaces for dependency injection

export interface IRpcReadClient {
  getBlockNumber(timeout: number): Promise<bigint>;
  getLogs(params: any, timeout: number): Promise<any[]>;
}

export interface ITokenBucket {
  consume(tokens: number): Promise<boolean>;
}

export interface ICircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}

export interface IMetricsRegistry {
  createCounter(name: string, help: string): any;
  createHistogram(name: string, help: string): any;
  createGauge(name: string, help: string): any;
}

export interface ICounter {
  inc(labels?: Record<string, string>): void;
}

export interface IHistogram {
  observe(value: number, labels?: Record<string, string>): void;
}

export interface IGauge {
  set(value: number, labels?: Record<string, string>): void;
}

export interface IMetricsServer {
  start(port: number): void;
  stop(): void;
}

export interface IDelay {
  delay(ms: number): Promise<void>;
}

export interface IHashService {
  hash(input: string): string;
}

export interface IPathService {
  resolve(...paths: string[]): string;
}

export interface IFindRootService {
  findRootSync(cwd: string): string;
}

export interface IMikroORM {
  init(): Promise<any>;
  getEntityManager(): any;
  close(): Promise<void>;
}

export interface ILogger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
