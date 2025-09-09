import { describe, it, expect } from 'vitest';
import { Counter, Histogram, Gauge, MetricsRegistry } from './index.js';

describe('Counter', () => {
  it('increments and renders with labels', () => {
    const c = new Counter('requests_total', 'Total requests');
    c.inc({ method: 'GET' }, 2);
    c.inc({ method: 'GET' });
    c.inc({ method: 'POST' }, 5);
    const out = c.render();
    expect(out).toContain('# TYPE requests_total counter');
    expect(out).toContain('requests_total{method="GET"} 3');
    expect(out).toContain('requests_total{method="POST"} 5');
  });
});

describe('Histogram', () => {
  it('observes and renders buckets, sum and count', () => {
    const h = new Histogram('latency_ms', 'Latency', [10, 100]);
    h.observe({ route: '/a' }, 5);
    h.observe({ route: '/a' }, 50);
    h.observe({ route: '/a' }, 200);
    const out = h.render();
    expect(out).toContain('latency_ms_bucket{route="/a",le="10"} 1');
    expect(out).toContain('latency_ms_bucket{route="/a",le="100"} 3');
    expect(out).toContain('latency_ms_bucket{route="/a",le="+Inf"} 6');
    expect(out).toContain('latency_ms_sum{route="/a"}');
    expect(out).toContain('latency_ms_count{route="/a"} 3');
  });
});

describe('Gauge and registry', () => {
  it('sets and renders; registry joins outputs', () => {
    const g = new Gauge('backlog', 'Backlog');
    g.set({ shard: '0' }, 5);
    const r = new MetricsRegistry();
    r.register(g);
    const out = r.render();
    expect(out).toContain('backlog{shard="0"} 5');
  });
});

