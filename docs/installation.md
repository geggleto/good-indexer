# Installation Guide

This guide covers detailed installation instructions for Good Indexer across different platforms and deployment scenarios.

## System Requirements

### Minimum Requirements

- **Node.js**: 22.0.0 or higher
- **PostgreSQL**: 12.0 or higher
- **RAM**: 2GB minimum, 4GB recommended
- **Disk Space**: 1GB for installation, additional space for data
- **Network**: Stable internet connection for RPC access

### Recommended Requirements

- **Node.js**: 22.0.0 LTS
- **PostgreSQL**: 15.0 or higher
- **RAM**: 8GB or more
- **Disk Space**: 10GB+ for production data
- **CPU**: 2+ cores
- **Network**: High-speed, reliable connection

## Installation Methods

### Method 1: Global CLI Installation (Recommended)

This is the easiest way to get started:

```bash
# Install the CLI globally
npm install -g @good-indexer/cli

# Verify installation
gx --version
```

### Method 2: Local Project Installation

For project-specific installations:

```bash
# Initialize a new project
mkdir my-indexer
cd my-indexer
npm init -y

# Install packages
npm install @good-indexer/core @good-indexer/adapters-evm @good-indexer/storage-postgres @good-indexer/metrics @good-indexer/ingest @good-indexer/dispatch @good-indexer/executor-evm @good-indexer/cli

# Or install all at once
npm install @good-indexer/core @good-indexer/adapters-evm @good-indexer/storage-postgres @good-indexer/metrics @good-indexer/ingest @good-indexer/dispatch @good-indexer/executor-evm @good-indexer/cli
```

### Method 3: Using pnpm (Recommended for Monorepos)

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Create a new project
mkdir my-indexer
cd my-indexer
pnpm init

# Install packages
pnpm add @good-indexer/core @good-indexer/adapters-evm @good-indexer/storage-postgres @good-indexer/metrics @good-indexer/ingest @good-indexer/dispatch @good-indexer/executor-evm @good-indexer/cli
```

### Method 4: Using Yarn

```bash
# Create a new project
mkdir my-indexer
cd my-indexer
yarn init -y

# Install packages
yarn add @good-indexer/core @good-indexer/adapters-evm @good-indexer/storage-postgres @good-indexer/metrics @good-indexer/ingest @good-indexer/dispatch @good-indexer/executor-evm @good-indexer/cli
```

## Database Setup

### PostgreSQL Installation

#### macOS (using Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb indexer
```

#### Ubuntu/Debian

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb indexer
```

#### CentOS/RHEL

```bash
# Install PostgreSQL
sudo yum install postgresql-server postgresql-contrib

# Initialize database
sudo postgresql-setup initdb

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb indexer
```

#### Windows

1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Follow the installation wizard
4. Create a database named `indexer`

#### Docker

```bash
# Run PostgreSQL in Docker
docker run --name postgres-indexer \
  -e POSTGRES_DB=indexer \
  -e POSTGRES_USER=indexer \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

### Database Configuration

#### Create Database User

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create user
CREATE USER indexer WITH PASSWORD 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE indexer TO indexer;

-- Exit
\q
```

#### Configure Connection

```bash
# Set environment variable
export DATABASE_URL="postgresql://indexer:your_password@localhost:5432/indexer"
```

## RPC Provider Setup

### Alchemy (Recommended)

1. Sign up at [alchemy.com](https://www.alchemy.com/)
2. Create a new app
3. Copy your API key
4. Set the RPC URL:

```bash
export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/your-api-key"
```

### Infura

1. Sign up at [infura.io](https://infura.io/)
2. Create a new project
3. Copy your project ID
4. Set the RPC URL:

```bash
export RPC_URL="https://mainnet.infura.io/v3/your-project-id"
```

### QuickNode

1. Sign up at [quicknode.com](https://www.quicknode.com/)
2. Create an endpoint
3. Copy your endpoint URL
4. Set the RPC URL:

```bash
export RPC_URL="https://your-endpoint.quiknode.pro/your-key/"
```

### Local Node (Advanced)

If you're running your own Ethereum node:

```bash
export RPC_URL="http://localhost:8545"
```

## Configuration Setup

### 1. Initialize Configuration

```bash
# Initialize default configuration
gx config init

# Or with custom output
gx config init --output ./my-config.json
```

### 2. Basic Configuration

Edit your configuration file:

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://indexer:password@localhost:5432/indexer",
        "shardId": "0",
        "batchSize": 100,
        "stepSize": 10,
        "maxStepSize": 1000,
        "minStepSize": 1,
        "pollInterval": 1000,
        "timeout": 5000,
        "retries": 3,
        "circuitBreakerThreshold": 5,
        "rateLimitRps": 10
      }
    },
    "dispatch": {
      "enabled": true,
      "config": {
        "dbUrl": "postgresql://indexer:password@localhost:5432/indexer",
        "batchSize": 50,
        "pollInterval": 1000,
        "maxRetries": 3,
        "retryDelay": 1000,
        "timeout": 5000
      }
    },
    "executor": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://indexer:password@localhost:5432/indexer",
        "privateKey": "0x...",
        "gasLimit": 21000,
        "gasPrice": "20000000000",
        "maxFeePerGas": "20000000000",
        "maxPriorityFeePerGas": "2000000000",
        "chainId": 1,
        "timeout": 30000,
        "retries": 3,
        "pollInterval": 1000
      }
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "metrics": {
    "enabled": true,
    "port": 9090
  }
}
```

### 3. Environment Variables

Create a `.env` file:

```bash
# Database
DATABASE_URL=postgresql://indexer:password@localhost:5432/indexer

# RPC
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key

# Executor
PRIVATE_KEY=0x...

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
```

## Database Migration

### Run Migrations

```bash
# Run all migrations
gx db migrate

# Dry run (see what would be migrated)
gx db migrate --dry-run

# Reset database (WARNING: Destructive)
gx db reset --confirm
```

### Verify Database Setup

```bash
# Check database connection
gx db migrate --dry-run

# View database status
gx status
```

## Verification

### 1. Check Installation

```bash
# Check CLI version
gx --version

# Check all package versions
gx version

# Check configuration
gx config show
```

### 2. Test Database Connection

```bash
# Test database connection
gx db migrate --dry-run
```

### 3. Test RPC Connection

```bash
# Start ingestion service
gx start ingest

# Check logs for RPC connection
gx logs ingest --follow
```

### 4. Full System Test

```bash
# Start all services
gx start all

# Check status
gx status

# Check health
gx health

# View metrics
gx metrics
```

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database exists
psql -U postgres -l

# Test connection
psql -U indexer -d indexer -c "SELECT 1;"
```

#### RPC Connection Failed

```bash
# Test RPC URL
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $RPC_URL

# Check API key
echo $RPC_URL
```

#### Port Already in Use

```bash
# Check what's using the port
lsof -i :9090

# Kill the process
kill -9 <PID>

# Or use a different port
gx start all --metrics-port 9091
```

### Logs and Debugging

```bash
# View all logs
gx logs all --follow

# View specific service logs
gx logs ingest --follow --level debug

# View error logs only
gx logs executor --level error
```

## Next Steps

After successful installation:

1. **Read the [Getting Started Guide](./getting-started.md)** for your first indexer
2. **Check the [Configuration Guide](./configuration.md)** for advanced setup
3. **Explore the [Examples](../examples/)** for use cases
4. **Read the [Deployment Guide](./deployment.md)** for production setup

## Support

If you encounter issues:

- **Check the [Troubleshooting Guide](./troubleshooting.md)**
- **View the [API Documentation](../api/README.md)**
- **Report issues on [GitHub](https://github.com/glenneggleton/good-indexer/issues)**
