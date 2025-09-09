/// <reference types="node" />
import { createServer, Server } from 'http';

export type LabelValues = Record<string, string | number | boolean | null | undefined>;

export class Counter {
  private readonly name: string;
  private readonly help: string;
  private readonly values: Map<string, number> = new Map();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels?: LabelValues, value = 1): void {
    const key = serializeLabels(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    for (const [k, v] of this.values.entries()) {
      out += `${this.name}${k} ${v}\n`;
    }
    return out;
  }
}

export class Histogram {
  private readonly name: string;
  private readonly help: string;
  private readonly buckets: number[];
  private readonly data: Map<string, number[]> = new Map();

  constructor(name: string, help: string, buckets?: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = (buckets ?? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]).slice().sort((a, b) => a - b);
  }

  observe(labels: LabelValues | undefined, valueMs: number): void {
    const key = serializeLabels(labels);
    let arr = this.data.get(key);
    if (!arr) {
      arr = new Array(this.buckets.length + 2).fill(0); // buckets + sum + count
      this.data.set(key, arr);
    }
    for (let i = 0; i < this.buckets.length; i++) {
      if (valueMs <= this.buckets[i]) {
        arr[i] += 1;
      }
    }
    // +Inf bucket
    arr[this.buckets.length] += 1;
    // sum at index buckets.length + 1, count at + 2? We'll collapse: store sum in last-1, count in last
    // To keep it simple: reuse positions
    // sum
    (arr as any).sum = ((arr as any).sum ?? 0) + valueMs;
    // count
    (arr as any).count = ((arr as any).count ?? 0) + 1;
  }

  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    for (const [k, arr] of this.data.entries()) {
      const sum = (arr as any).sum ?? 0;
      const count = (arr as any).count ?? 0;
      let cum = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        cum += arr[i];
        out += `${this.name}_bucket${appendLeLabel(k, this.buckets[i])} ${cum}\n`;
      }
      cum += arr[this.buckets.length];
      out += `${this.name}_bucket${appendLeLabel(k, '+Inf')} ${cum}\n`;
      out += `${this.name}_sum${k} ${sum}\n`;
      out += `${this.name}_count${k} ${count}\n`;
    }
    return out;
  }
}

export class Gauge {
  private readonly name: string;
  private readonly help: string;
  private readonly values: Map<string, number> = new Map();

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  set(labels: LabelValues | undefined, value: number): void {
    const key = serializeLabels(labels);
    this.values.set(key, value);
  }

  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} gauge\n`;
    for (const [k, v] of this.values.entries()) {
      out += `${this.name}${k} ${v}\n`;
    }
    return out;
  }
}

function serializeLabels(labels?: LabelValues): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  const entries = Object.entries(labels)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .sort();
  return `{${entries.join(',')}}`;
}

function appendLeLabel(k: string, le: number | string): string {
  if (k === '') return `{le="${le}"}`;
  return k.slice(0, -1) + `,le="${le}"}`;
}

export class MetricsRegistry {
  private readonly items: Array<Counter | Histogram | Gauge> = [];
  register<T extends Counter | Histogram | Gauge>(metric: T): T {
    this.items.push(metric);
    return metric;
  }
  render(): string {
    return this.items.map((m) => m.render()).join('\n');
  }
}

export class MetricsServer {
  private readonly registry: MetricsRegistry;
  private server?: Server;
  constructor(registry: MetricsRegistry) {
    this.registry = registry;
  }
  start(port = Number((process as any).env.METRICS_PORT ?? 9464)): void {
    this.server = createServer((req, res) => {
      if (req.url === '/metrics') {
        const body = this.registry.render();
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(body);
        return;
      }
      if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });
    this.server.listen(port);
  }
  stop(): void {
    this.server?.close();
  }
}

