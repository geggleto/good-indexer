# DeFi Indexer Example

This example shows how to build a comprehensive DeFi indexer using Good Indexer to track DEX trades, liquidity changes, yield farming, and lending protocols.

## Overview

The DeFi indexer tracks:
- DEX trades (Uniswap, SushiSwap, etc.)
- Liquidity pool changes
- Yield farming events
- Lending protocol interactions
- Governance proposals and votes

## Setup

### 1. Install Dependencies

```bash
npm install @good-indexer/core @good-indexer/adapters-evm @good-indexer/storage-postgres @good-indexer/metrics @good-indexer/ingest @good-indexer/dispatch @good-indexer/executor-evm @good-indexer/cli
```

### 2. Configuration

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/defi_indexer",
        "shardId": "0",
        "batchSize": 200,
        "subscriptions": [
          {
            "address": "0x...", // Uniswap V2 Router
            "topics": [
              "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822", // Swap
              "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f"  // Mint
            ]
          },
          {
            "address": "0x...", // Aave Lending Pool
            "topics": [
              "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f", // Deposit
              "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f"  // Withdraw
            ]
          }
        ]
      }
    }
  }
}
```

### 3. Event Handlers

```typescript
// handlers/swap.ts
export async function handleSwap(event: ProcessedEvent) {
  const { sender, amount0In, amount1In, amount0Out, amount1Out, to } = event.payload;
  
  console.log(`DEX Swap: ${amount0In} -> ${amount0Out} to ${to}`);
  
  // Calculate swap details
  const swap = await calculateSwapDetails(event);
  
  // Store swap in database
  await storeSwap(swap);
  
  // Update trading volume
  await updateTradingVolume(swap.pair, swap.volume);
}

// handlers/liquidity.ts
export async function handleLiquidityChange(event: ProcessedEvent) {
  const { sender, amount0, amount1, liquidity } = event.payload;
  
  console.log(`Liquidity Change: ${amount0} + ${amount1} = ${liquidity}`);
  
  // Update liquidity pool
  await updateLiquidityPool(event.address, amount0, amount1, liquidity);
  
  // Update pool stats
  await updatePoolStats(event.address);
}

// handlers/lending.ts
export async function handleLendingEvent(event: ProcessedEvent) {
  const { user, amount, reserve } = event.payload;
  
  console.log(`Lending Event: ${user} ${amount} ${reserve}`);
  
  // Update user position
  await updateUserPosition(user, reserve, amount);
  
  // Update protocol stats
  await updateProtocolStats(reserve, amount);
}
```

### 4. Database Schema

```sql
-- DEX trades table
CREATE TABLE dex_trades (
  id SERIAL PRIMARY KEY,
  protocol TEXT NOT NULL,
  pair_address TEXT NOT NULL,
  token0_address TEXT NOT NULL,
  token1_address TEXT NOT NULL,
  amount0_in DECIMAL(78, 18),
  amount1_in DECIMAL(78, 18),
  amount0_out DECIMAL(78, 18),
  amount1_out DECIMAL(78, 18),
  trader_address TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Liquidity pools table
CREATE TABLE liquidity_pools (
  pair_address TEXT PRIMARY KEY,
  token0_address TEXT NOT NULL,
  token1_address TEXT NOT NULL,
  token0_symbol TEXT,
  token1_symbol TEXT,
  total_liquidity DECIMAL(78, 18),
  total_volume_24h DECIMAL(78, 18),
  total_volume_7d DECIMAL(78, 18),
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Lending positions table
CREATE TABLE lending_positions (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  protocol TEXT NOT NULL,
  reserve_address TEXT NOT NULL,
  supply_amount DECIMAL(78, 18),
  borrow_amount DECIMAL(78, 18),
  collateral_factor DECIMAL(5, 4),
  health_factor DECIMAL(10, 4),
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Governance proposals table
CREATE TABLE governance_proposals (
  id SERIAL PRIMARY KEY,
  protocol TEXT NOT NULL,
  proposal_id BIGINT NOT NULL,
  proposer TEXT NOT NULL,
  description TEXT,
  start_block BIGINT NOT NULL,
  end_block BIGINT NOT NULL,
  for_votes DECIMAL(78, 18),
  against_votes DECIMAL(78, 18),
  status TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## Usage

### 1. Start the Indexer

```bash
# Start all services
gx start all

# Check status
gx status

# View logs
gx logs ingest --follow
```

### 2. Query DeFi Data

```typescript
// Query recent trades
const recentTrades = await db.query(`
  SELECT * FROM dex_trades 
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  ORDER BY timestamp DESC
  LIMIT 100
`);

// Query top pools by volume
const topPools = await db.query(`
  SELECT * FROM liquidity_pools 
  ORDER BY total_volume_24h DESC 
  LIMIT 10
`);

// Query user positions
const userPositions = await db.query(`
  SELECT * FROM lending_positions 
  WHERE user_address = $1
`, [userAddress]);
```

## Advanced Features

### 1. Price Calculation

```typescript
// utils/price-calculation.ts
export async function calculateTokenPrice(pairAddress: string, tokenAddress: string) {
  const pool = await db.query(`
    SELECT token0_address, token1_address, total_liquidity 
    FROM liquidity_pools 
    WHERE pair_address = $1
  `, [pairAddress]);
  
  if (pool.length === 0) return null;
  
  const { token0_address, token1_address, total_liquidity } = pool[0];
  
  // Calculate price based on token reserves
  const price = tokenAddress === token0_address 
    ? total_liquidity / getToken1Reserve(pairAddress)
    : total_liquidity / getToken0Reserve(pairAddress);
  
  return price;
}
```

### 2. Arbitrage Detection

```typescript
// analytics/arbitrage.ts
export async function detectArbitrageOpportunities() {
  const opportunities = await db.query(`
    WITH price_differences AS (
      SELECT 
        t1.pair_address as pair1,
        t2.pair_address as pair2,
        t1.token0_address,
        t1.token1_address,
        ABS(t1.price - t2.price) as price_diff,
        t1.price as price1,
        t2.price as price2
      FROM dex_trades t1
      JOIN dex_trades t2 ON t1.token0_address = t2.token0_address 
        AND t1.token1_address = t2.token1_address
      WHERE t1.timestamp > NOW() - INTERVAL '1 minute'
        AND t2.timestamp > NOW() - INTERVAL '1 minute'
        AND t1.pair_address != t2.pair_address
    )
    SELECT * FROM price_differences 
    WHERE price_diff > 0.01  -- 1% price difference
    ORDER BY price_diff DESC
  `);
  
  return opportunities;
}
```

### 3. Risk Analysis

```typescript
// analytics/risk-analysis.ts
export async function analyzeLendingRisks() {
  const riskyPositions = await db.query(`
    SELECT 
      user_address,
      protocol,
      reserve_address,
      supply_amount,
      borrow_amount,
      health_factor,
      CASE 
        WHEN health_factor < 1.0 THEN 'LIQUIDATION_RISK'
        WHEN health_factor < 1.5 THEN 'HIGH_RISK'
        WHEN health_factor < 2.0 THEN 'MEDIUM_RISK'
        ELSE 'LOW_RISK'
      END as risk_level
    FROM lending_positions 
    WHERE health_factor < 2.0
    ORDER BY health_factor ASC
  `);
  
  return riskyPositions;
}
```

### 4. Real-time Alerts

```typescript
// alerts/defi-alerts.ts
export function setupDeFiAlerts() {
  // Large trade alerts
  const largeTradeAlert = {
    condition: (trade) => trade.volume > 1000000, // $1M+
    action: (trade) => sendAlert(`Large trade detected: ${trade.volume} USD`)
  };
  
  // Liquidation alerts
  const liquidationAlert = {
    condition: (position) => position.health_factor < 1.0,
    action: (position) => sendAlert(`Liquidation risk: ${position.user_address}`)
  };
  
  // Governance alerts
  const governanceAlert = {
    condition: (proposal) => proposal.status === 'ACTIVE',
    action: (proposal) => sendAlert(`New proposal: ${proposal.description}`)
  };
  
  return { largeTradeAlert, liquidationAlert, governanceAlert };
}
```

## Monitoring

### 1. DeFi Metrics

```typescript
// metrics/defi-metrics.ts
export function setupDeFiMetrics(registry: MetricsRegistry) {
  const tradesTotal = registry.createCounter(
    'defi_trades_total',
    'Total DeFi trades processed'
  );
  
  const tradingVolume = registry.createGauge(
    'defi_trading_volume_usd',
    'Total trading volume in USD'
  );
  
  const liquidityTotal = registry.createGauge(
    'defi_liquidity_total_usd',
    'Total liquidity across all pools'
  );
  
  const lendingTotal = registry.createGauge(
    'defi_lending_total_usd',
    'Total lending across all protocols'
  );
  
  return { tradesTotal, tradingVolume, liquidityTotal, lendingTotal };
}
```

### 2. Performance Metrics

```typescript
// metrics/performance.ts
export function setupPerformanceMetrics(registry: MetricsRegistry) {
  const processingTime = registry.createHistogram(
    'defi_processing_duration_seconds',
    'Time spent processing DeFi events'
  );
  
  const rpcLatency = registry.createHistogram(
    'defi_rpc_latency_seconds',
    'RPC request latency'
  );
  
  const databaseLatency = registry.createHistogram(
    'defi_database_latency_seconds',
    'Database query latency'
  );
  
  return { processingTime, rpcLatency, databaseLatency };
}
```

## Production Deployment

### 1. High-Availability Setup

```yaml
# kubernetes/defi-indexer.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: defi-indexer
spec:
  replicas: 5
  selector:
    matchLabels:
      app: defi-indexer
  template:
    metadata:
      labels:
        app: defi-indexer
    spec:
      containers:
      - name: indexer
        image: defi-indexer:latest
        ports:
        - containerPort: 9090
        resources:
          requests:
            memory: "4Gi"
            cpu: "2000m"
          limits:
            memory: "8Gi"
            cpu: "4000m"
        env:
        - name: DATABASE_URL
          value: "postgresql://user:pass@postgres:5432/defi_indexer"
        - name: RPC_URL
          value: "https://eth-mainnet.g.alchemy.com/v2/your-key"
```

### 2. Database Optimization

```sql
-- Optimize for DeFi queries
CREATE INDEX idx_dex_trades_timestamp ON dex_trades(timestamp);
CREATE INDEX idx_dex_trades_pair ON dex_trades(pair_address);
CREATE INDEX idx_dex_trades_trader ON dex_trades(trader_address);
CREATE INDEX idx_liquidity_pools_volume ON liquidity_pools(total_volume_24h);
CREATE INDEX idx_lending_positions_user ON lending_positions(user_address);
CREATE INDEX idx_lending_positions_health ON lending_positions(health_factor);
```

### 3. Caching Strategy

```typescript
// cache/defi-cache.ts
export class DeFiCache {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async getPoolStats(pairAddress: string) {
    const cached = await this.redis.get(`pool:${pairAddress}`);
    if (cached) return JSON.parse(cached);
    
    const stats = await this.calculatePoolStats(pairAddress);
    await this.redis.setex(`pool:${pairAddress}`, 300, JSON.stringify(stats));
    return stats;
  }
  
  async getTokenPrice(tokenAddress: string) {
    const cached = await this.redis.get(`price:${tokenAddress}`);
    if (cached) return JSON.parse(cached);
    
    const price = await this.calculateTokenPrice(tokenAddress);
    await this.redis.setex(`price:${tokenAddress}`, 60, JSON.stringify(price));
    return price;
  }
}
```

## Performance Optimization

### 1. Batch Processing

```typescript
// processing/batch-processor.ts
export class DeFiBatchProcessor {
  async processTradesBatch(trades: ProcessedEvent[]) {
    const batch = trades.map(trade => ({
      protocol: this.getProtocol(trade.address),
      pair_address: trade.payload.pair,
      token0_address: trade.payload.token0,
      token1_address: trade.payload.token1,
      amount0_in: trade.payload.amount0In,
      amount1_in: trade.payload.amount1In,
      amount0_out: trade.payload.amount0Out,
      amount1_out: trade.payload.amount1Out,
      trader_address: trade.payload.to,
      block_number: trade.blockNumber,
      transaction_hash: trade.transactionHash
    }));
    
    await db.query(`
      INSERT INTO dex_trades (protocol, pair_address, token0_address, token1_address, 
                             amount0_in, amount1_in, amount0_out, amount1_out, 
                             trader_address, block_number, transaction_hash)
      VALUES ${batch.map((_, i) => `($${i*11+1}, $${i*11+2}, $${i*11+3}, $${i*11+4}, 
                             $${i*11+5}, $${i*11+6}, $${i*11+7}, $${i*11+8}, 
                             $${i*11+9}, $${i*11+10}, $${i*11+11})`).join(', ')}
    `, batch.flat());
  }
}
```

### 2. Parallel Processing

```typescript
// processing/parallel-processor.ts
export class ParallelDeFiProcessor {
  async processEvents(events: ProcessedEvent[]) {
    const chunks = this.chunkArray(events, 100);
    
    await Promise.all(chunks.map(chunk => 
      this.processChunk(chunk)
    ));
  }
  
  private async processChunk(chunk: ProcessedEvent[]) {
    const trades = chunk.filter(e => e.kind === 'SWAP');
    const liquidity = chunk.filter(e => e.kind === 'LIQUIDITY');
    const lending = chunk.filter(e => e.kind === 'LENDING');
    
    await Promise.all([
      this.processTrades(trades),
      this.processLiquidity(liquidity),
      this.processLending(lending)
    ]);
  }
}
```

## Next Steps

- **Read the [Getting Started Guide](../docs/getting-started.md)** for basic setup
- **Check the [API Documentation](../docs/api/README.md)** for detailed APIs
- **Explore the [Multi-Chain Indexer Example](./multi-chain-indexer/README.md)** for cross-chain indexing
