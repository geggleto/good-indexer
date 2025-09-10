# Multi-Chain Indexer Example

This example shows how to build a multi-chain indexer using Good Indexer to track events across multiple blockchain networks (Ethereum, Polygon, BSC, etc.).

## Overview

The multi-chain indexer tracks:
- Cross-chain token transfers
- Bridge events
- Multi-chain DeFi interactions
- Cross-chain governance
- Network-specific events

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
        "dbUrl": "postgresql://user:pass@localhost:5432/multichain_indexer",
        "shardId": "0",
        "batchSize": 100,
        "networks": [
          {
            "name": "ethereum",
            "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
            "chainId": 1,
            "subscriptions": [
              {
                "address": "0x...", // USDC contract
                "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
              }
            ]
          },
          {
            "name": "polygon",
            "rpcUrl": "https://polygon-mainnet.g.alchemy.com/v2/your-key",
            "chainId": 137,
            "subscriptions": [
              {
                "address": "0x...", // USDC contract on Polygon
                "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
              }
            ]
          },
          {
            "name": "bsc",
            "rpcUrl": "https://bsc-dataseed.binance.org/",
            "chainId": 56,
            "subscriptions": [
              {
                "address": "0x...", // USDC contract on BSC
                "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]
              }
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
// handlers/cross-chain.ts
export async function handleCrossChainTransfer(event: ProcessedEvent) {
  const { from, to, amount, token } = event.payload;
  const network = event.network;
  
  console.log(`Cross-chain transfer: ${amount} ${token} from ${from} to ${to} on ${network}`);
  
  // Store cross-chain transfer
  await storeCrossChainTransfer({
    from,
    to,
    amount,
    token,
    sourceNetwork: network,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash
  });
  
  // Update network stats
  await updateNetworkStats(network, amount);
}

// handlers/bridge.ts
export async function handleBridgeEvent(event: ProcessedEvent) {
  const { user, amount, token, destinationChain } = event.payload;
  const sourceNetwork = event.network;
  
  console.log(`Bridge event: ${amount} ${token} from ${sourceNetwork} to ${destinationChain}`);
  
  // Store bridge event
  await storeBridgeEvent({
    user,
    amount,
    token,
    sourceNetwork,
    destinationChain,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash
  });
  
  // Update bridge stats
  await updateBridgeStats(sourceNetwork, destinationChain, amount);
}

// handlers/governance.ts
export async function handleCrossChainGovernance(event: ProcessedEvent) {
  const { proposalId, proposer, description, votes } = event.payload;
  const network = event.network;
  
  console.log(`Cross-chain governance: Proposal ${proposalId} on ${network}`);
  
  // Store governance event
  await storeGovernanceEvent({
    proposalId,
    proposer,
    description,
    votes,
    network,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash
  });
  
  // Update governance stats
  await updateGovernanceStats(network, votes);
}
```

### 4. Database Schema

```sql
-- Cross-chain transfers table
CREATE TABLE cross_chain_transfers (
  id SERIAL PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(78, 18) NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  source_network TEXT NOT NULL,
  destination_network TEXT,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Bridge events table
CREATE TABLE bridge_events (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  amount DECIMAL(78, 18) NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  source_network TEXT NOT NULL,
  destination_network TEXT NOT NULL,
  bridge_protocol TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Network stats table
CREATE TABLE network_stats (
  network_name TEXT PRIMARY KEY,
  total_transfers BIGINT DEFAULT 0,
  total_volume DECIMAL(78, 18) DEFAULT 0,
  active_addresses BIGINT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Cross-chain governance table
CREATE TABLE cross_chain_governance (
  id SERIAL PRIMARY KEY,
  proposal_id BIGINT NOT NULL,
  proposer TEXT NOT NULL,
  description TEXT,
  votes_for DECIMAL(78, 18) DEFAULT 0,
  votes_against DECIMAL(78, 18) DEFAULT 0,
  network TEXT NOT NULL,
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

### 2. Query Multi-Chain Data

```typescript
// Query cross-chain transfers
const crossChainTransfers = await db.query(`
  SELECT * FROM cross_chain_transfers 
  WHERE source_network = $1 AND destination_network = $2
  ORDER BY timestamp DESC
`, ['ethereum', 'polygon']);

// Query network stats
const networkStats = await db.query(`
  SELECT * FROM network_stats 
  ORDER BY total_volume DESC
`);

// Query bridge events
const bridgeEvents = await db.query(`
  SELECT * FROM bridge_events 
  WHERE bridge_protocol = $1
  ORDER BY timestamp DESC
`, ['wormhole']);
```

## Advanced Features

### 1. Cross-Chain Analytics

```typescript
// analytics/cross-chain-analytics.ts
export async function generateCrossChainAnalytics() {
  const analytics = await db.query(`
    WITH network_volumes AS (
      SELECT 
        source_network,
        SUM(amount) as total_volume,
        COUNT(*) as total_transfers
      FROM cross_chain_transfers
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY source_network
    ),
    bridge_volumes AS (
      SELECT 
        source_network,
        destination_network,
        SUM(amount) as bridge_volume
      FROM bridge_events
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY source_network, destination_network
    )
    SELECT 
      nv.source_network,
      nv.total_volume,
      nv.total_transfers,
      bv.bridge_volume
    FROM network_volumes nv
    LEFT JOIN bridge_volumes bv ON nv.source_network = bv.source_network
    ORDER BY nv.total_volume DESC
  `);
  
  return analytics;
}
```

### 2. Cross-Chain Price Tracking

```typescript
// analytics/price-tracking.ts
export async function trackCrossChainPrices() {
  const prices = await db.query(`
    WITH token_prices AS (
      SELECT 
        token_address,
        source_network,
        AVG(amount) as avg_amount,
        COUNT(*) as trade_count
      FROM cross_chain_transfers
      WHERE timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY token_address, source_network
    )
    SELECT 
      token_address,
      source_network,
      avg_amount,
      trade_count
    FROM token_prices
    ORDER BY trade_count DESC
  `);
  
  return prices;
}
```

### 3. Cross-Chain Governance Analysis

```typescript
// analytics/governance-analysis.ts
export async function analyzeCrossChainGovernance() {
  const analysis = await db.query(`
    WITH governance_stats AS (
      SELECT 
        network,
        COUNT(*) as total_proposals,
        SUM(votes_for) as total_votes_for,
        SUM(votes_against) as total_votes_against,
        AVG(votes_for + votes_against) as avg_participation
      FROM cross_chain_governance
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY network
    )
    SELECT 
      network,
      total_proposals,
      total_votes_for,
      total_votes_against,
      avg_participation,
      CASE 
        WHEN total_votes_for > total_votes_against THEN 'POSITIVE'
        WHEN total_votes_for < total_votes_against THEN 'NEGATIVE'
        ELSE 'NEUTRAL'
      END as sentiment
    FROM governance_stats
    ORDER BY total_proposals DESC
  `);
  
  return analysis;
}
```

### 4. Real-time Cross-Chain Monitoring

```typescript
// monitoring/cross-chain-monitor.ts
export function setupCrossChainMonitoring() {
  const monitor = {
    // Monitor cross-chain transfers
    async monitorTransfers() {
      const recentTransfers = await db.query(`
        SELECT * FROM cross_chain_transfers 
        WHERE timestamp > NOW() - INTERVAL '1 minute'
        ORDER BY timestamp DESC
      `);
      
      for (const transfer of recentTransfers) {
        await this.analyzeTransfer(transfer);
      }
    },
    
    // Analyze transfer for anomalies
    async analyzeTransfer(transfer: any) {
      const { amount, source_network, destination_network } = transfer;
      
      // Check for large transfers
      if (amount > 1000000) { // $1M+
        await this.sendAlert(`Large cross-chain transfer: ${amount} from ${source_network} to ${destination_network}`);
      }
      
      // Check for suspicious patterns
      const recentTransfers = await db.query(`
        SELECT COUNT(*) FROM cross_chain_transfers 
        WHERE from_address = $1 AND timestamp > NOW() - INTERVAL '1 hour'
      `, [transfer.from_address]);
      
      if (recentTransfers[0].count > 10) {
        await this.sendAlert(`Suspicious activity: ${transfer.from_address} made ${recentTransfers[0].count} transfers in 1 hour`);
      }
    },
    
    // Send alerts
    async sendAlert(message: string) {
      console.log(`ALERT: ${message}`);
      // Send to monitoring system
    }
  };
  
  return monitor;
}
```

## Monitoring

### 1. Multi-Chain Metrics

```typescript
// metrics/multichain-metrics.ts
export function setupMultiChainMetrics(registry: MetricsRegistry) {
  const crossChainTransfers = registry.createCounter(
    'cross_chain_transfers_total',
    'Total cross-chain transfers processed'
  );
  
  const bridgeEvents = registry.createCounter(
    'bridge_events_total',
    'Total bridge events processed'
  );
  
  const networkVolume = registry.createGauge(
    'network_volume_usd',
    'Total volume per network'
  );
  
  const governanceProposals = registry.createCounter(
    'governance_proposals_total',
    'Total governance proposals processed'
  );
  
  return { crossChainTransfers, bridgeEvents, networkVolume, governanceProposals };
}
```

### 2. Network Health Monitoring

```typescript
// monitoring/network-health.ts
export function setupNetworkHealthMonitoring() {
  const healthChecks = {
    async checkNetworkHealth(network: string) {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as recent_transfers,
          MAX(timestamp) as last_activity
        FROM cross_chain_transfers 
        WHERE source_network = $1 AND timestamp > NOW() - INTERVAL '1 hour'
      `, [network]);
      
      const { recent_transfers, last_activity } = stats[0];
      
      return {
        network,
        recent_transfers,
        last_activity,
        health: recent_transfers > 0 ? 'HEALTHY' : 'UNHEALTHY'
      };
    },
    
    async checkAllNetworks() {
      const networks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];
      const healthChecks = await Promise.all(
        networks.map(network => this.checkNetworkHealth(network))
      );
      
      return healthChecks;
    }
  };
  
  return healthChecks;
}
```

## Production Deployment

### 1. Multi-Region Deployment

```yaml
# kubernetes/multichain-indexer.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multichain-indexer
spec:
  replicas: 10
  selector:
    matchLabels:
      app: multichain-indexer
  template:
    metadata:
      labels:
        app: multichain-indexer
    spec:
      containers:
      - name: indexer
        image: multichain-indexer:latest
        ports:
        - containerPort: 9090
        resources:
          requests:
            memory: "8Gi"
            cpu: "4000m"
          limits:
            memory: "16Gi"
            cpu: "8000m"
        env:
        - name: DATABASE_URL
          value: "postgresql://user:pass@postgres:5432/multichain_indexer"
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: NETWORKS
          value: "ethereum,polygon,bsc,arbitrum,optimism"
```

### 2. Database Optimization

```sql
-- Optimize for multi-chain queries
CREATE INDEX idx_cross_chain_transfers_network ON cross_chain_transfers(source_network);
CREATE INDEX idx_cross_chain_transfers_timestamp ON cross_chain_transfers(timestamp);
CREATE INDEX idx_cross_chain_transfers_token ON cross_chain_transfers(token_address);
CREATE INDEX idx_bridge_events_networks ON bridge_events(source_network, destination_network);
CREATE INDEX idx_governance_network ON cross_chain_governance(network);
CREATE INDEX idx_governance_proposal ON cross_chain_governance(proposal_id);
```

### 3. Caching Strategy

```typescript
// cache/multichain-cache.ts
export class MultiChainCache {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async getNetworkStats(network: string) {
    const cached = await this.redis.get(`network:${network}`);
    if (cached) return JSON.parse(cached);
    
    const stats = await this.calculateNetworkStats(network);
    await this.redis.setex(`network:${network}`, 300, JSON.stringify(stats));
    return stats;
  }
  
  async getCrossChainVolume(sourceNetwork: string, destinationNetwork: string) {
    const key = `volume:${sourceNetwork}:${destinationNetwork}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    const volume = await this.calculateCrossChainVolume(sourceNetwork, destinationNetwork);
    await this.redis.setex(key, 600, JSON.stringify(volume));
    return volume;
  }
}
```

## Performance Optimization

### 1. Parallel Network Processing

```typescript
// processing/parallel-network-processor.ts
export class ParallelNetworkProcessor {
  async processNetworks(networks: string[]) {
    const chunks = this.chunkArray(networks, 3); // Process 3 networks at a time
    
    await Promise.all(chunks.map(chunk => 
      this.processNetworkChunk(chunk)
    ));
  }
  
  private async processNetworkChunk(networks: string[]) {
    await Promise.all(networks.map(network => 
      this.processNetwork(network)
    ));
  }
  
  private async processNetwork(network: string) {
    // Process events for specific network
    const events = await this.fetchNetworkEvents(network);
    await this.processEvents(events);
  }
}
```

### 2. Cross-Chain Data Aggregation

```typescript
// aggregation/cross-chain-aggregator.ts
export class CrossChainAggregator {
  async aggregateCrossChainData() {
    const aggregations = await db.query(`
      WITH daily_volumes AS (
        SELECT 
          DATE(timestamp) as date,
          source_network,
          destination_network,
          SUM(amount) as daily_volume
        FROM cross_chain_transfers
        WHERE timestamp > NOW() - INTERVAL '30 days'
        GROUP BY DATE(timestamp), source_network, destination_network
      ),
      network_rankings AS (
        SELECT 
          source_network,
          SUM(daily_volume) as total_volume,
          RANK() OVER (ORDER BY SUM(daily_volume) DESC) as volume_rank
        FROM daily_volumes
        GROUP BY source_network
      )
      SELECT * FROM network_rankings
      ORDER BY volume_rank
    `);
    
    return aggregations;
  }
}
```

## Next Steps

- **Read the [Getting Started Guide](../docs/getting-started.md)** for basic setup
- **Check the [API Documentation](../docs/api/README.md)** for detailed APIs
- **Explore the [DeFi Indexer Example](./defi-indexer/README.md)** for DeFi-specific indexing
