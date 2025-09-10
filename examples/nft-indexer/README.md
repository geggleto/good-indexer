# NFT Indexer Example

This example shows how to build an NFT indexer using Good Indexer to track NFT transfers, approvals, and metadata changes.

## Overview

The NFT indexer tracks:
- NFT transfers (ERC-721, ERC-1155)
- NFT approvals
- Metadata updates
- Collection statistics

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
        "dbUrl": "postgresql://user:pass@localhost:5432/nft_indexer",
        "shardId": "0",
        "batchSize": 100,
        "subscriptions": [
          {
            "address": "0x...", // NFT contract address
            "topics": [
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer
              "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"  // Approval
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
// handlers/transfer.ts
export async function handleTransfer(event: ProcessedEvent) {
  const { from, to, tokenId } = event.payload;
  
  console.log(`NFT Transfer: Token ${tokenId} from ${from} to ${to}`);
  
  // Update ownership in database
  await updateNFTOwnership(tokenId, to);
  
  // Update collection stats
  await updateCollectionStats(event.address);
}

// handlers/approval.ts
export async function handleApproval(event: ProcessedEvent) {
  const { owner, approved, tokenId } = event.payload;
  
  console.log(`NFT Approval: Token ${tokenId} approved to ${approved}`);
  
  // Update approval in database
  await updateNFTApproval(tokenId, owner, approved);
}
```

### 4. Database Schema

```sql
-- NFT ownership table
CREATE TABLE nft_ownership (
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  PRIMARY KEY (contract_address, token_id)
);

-- NFT approvals table
CREATE TABLE nft_approvals (
  contract_address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  approved_address TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  PRIMARY KEY (contract_address, token_id)
);

-- Collection stats table
CREATE TABLE collection_stats (
  contract_address TEXT PRIMARY KEY,
  total_supply BIGINT,
  total_transfers BIGINT,
  unique_holders BIGINT,
  last_updated TIMESTAMP DEFAULT NOW()
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

### 2. Query NFT Data

```typescript
// Query NFT ownership
const ownership = await db.query(
  'SELECT * FROM nft_ownership WHERE contract_address = $1 AND token_id = $2',
  [contractAddress, tokenId]
);

// Query collection stats
const stats = await db.query(
  'SELECT * FROM collection_stats WHERE contract_address = $1',
  [contractAddress]
);
```

## Advanced Features

### 1. Metadata Indexing

```typescript
// handlers/metadata.ts
export async function handleMetadataUpdate(event: ProcessedEvent) {
  const { tokenId, metadataURI } = event.payload;
  
  // Fetch metadata from URI
  const metadata = await fetchMetadata(metadataURI);
  
  // Store metadata in database
  await storeNFTMetadata(tokenId, metadata);
}
```

### 2. Collection Analytics

```typescript
// analytics/collection.ts
export async function generateCollectionAnalytics(contractAddress: string) {
  const stats = await db.query(`
    SELECT 
      COUNT(*) as total_transfers,
      COUNT(DISTINCT owner_address) as unique_holders,
      AVG(block_number) as avg_block
    FROM nft_ownership 
    WHERE contract_address = $1
  `, [contractAddress]);
  
  return stats[0];
}
```

### 3. Real-time Notifications

```typescript
// notifications/websocket.ts
export function setupWebSocketNotifications() {
  const wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', (ws) => {
    // Send real-time NFT transfer notifications
    ws.on('message', (message) => {
      const { type, contractAddress } = JSON.parse(message);
      
      if (type === 'subscribe') {
        // Subscribe to specific contract
        subscribeToContract(contractAddress, (event) => {
          ws.send(JSON.stringify(event));
        });
      }
    });
  });
}
```

## Monitoring

### 1. Metrics

```typescript
// metrics/nft-metrics.ts
export function setupNFTMetrics(registry: MetricsRegistry) {
  const nftTransfers = registry.createCounter(
    'nft_transfers_total',
    'Total NFT transfers processed'
  );
  
  const nftApprovals = registry.createCounter(
    'nft_approvals_total',
    'Total NFT approvals processed'
  );
  
  const collectionStats = registry.createGauge(
    'collection_total_supply',
    'Total supply of NFT collections'
  );
  
  return { nftTransfers, nftApprovals, collectionStats };
}
```

### 2. Health Checks

```typescript
// health/nft-health.ts
export function setupNFTHealthChecks() {
  return {
    async checkDatabase() {
      const result = await db.query('SELECT 1');
      return result.length > 0;
    },
    
    async checkRPC() {
      const blockNumber = await rpcClient.getBlockNumber();
      return blockNumber > 0;
    },
    
    async checkProcessing() {
      const recentTransfers = await db.query(`
        SELECT COUNT(*) FROM nft_ownership 
        WHERE block_number > $1
      `, [Date.now() - 60000]); // Last minute
      
      return recentTransfers[0].count > 0;
    }
  };
}
```

## Production Deployment

### 1. Docker

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 9090

CMD ["gx", "start", "all"]
```

### 2. Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nft-indexer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nft-indexer
  template:
    metadata:
      labels:
        app: nft-indexer
    spec:
      containers:
      - name: indexer
        image: nft-indexer:latest
        ports:
        - containerPort: 9090
        env:
        - name: DATABASE_URL
          value: "postgresql://user:pass@postgres:5432/nft_indexer"
        - name: RPC_URL
          value: "https://eth-mainnet.g.alchemy.com/v2/your-key"
```

## Performance Optimization

### 1. Database Indexes

```sql
-- Optimize queries
CREATE INDEX idx_nft_ownership_owner ON nft_ownership(owner_address);
CREATE INDEX idx_nft_ownership_contract ON nft_ownership(contract_address);
CREATE INDEX idx_nft_ownership_block ON nft_ownership(block_number);
```

### 2. Batch Processing

```typescript
// Process multiple NFTs in batches
export async function processNFTBatch(events: ProcessedEvent[]) {
  const batch = events.map(event => ({
    contract_address: event.address,
    token_id: event.payload.tokenId,
    owner_address: event.payload.to,
    block_number: event.blockNumber,
    transaction_hash: event.transactionHash
  }));
  
  await db.query(`
    INSERT INTO nft_ownership (contract_address, token_id, owner_address, block_number, transaction_hash)
    VALUES ${batch.map((_, i) => `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`).join(', ')}
    ON CONFLICT (contract_address, token_id) DO UPDATE SET
      owner_address = EXCLUDED.owner_address,
      block_number = EXCLUDED.block_number,
      transaction_hash = EXCLUDED.transaction_hash
  `, batch.flat());
}
```

## Next Steps

- **Read the [Getting Started Guide](../docs/getting-started.md)** for basic setup
- **Check the [API Documentation](../docs/api/README.md)** for detailed APIs
- **Explore the [DeFi Indexer Example](./defi-indexer/README.md)** for more complex use cases
