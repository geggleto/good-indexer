# Configuration Guide

This guide covers all configuration options for Good Indexer, from basic setup to advanced production configurations.

## Configuration Overview

Good Indexer uses a hierarchical configuration system:

1. **Default values** (built into the code)
2. **Configuration file** (JSON)
3. **Environment variables** (override file settings)
4. **CLI arguments** (override everything)

## Configuration File

### File Locations

The system looks for configuration files in this order:

1. `--config` CLI argument
2. `GOOD_INDEXER_CONFIG` environment variable
3. `./good-indexer.json`
4. `./config/good-indexer.json`
5. `~/.config/good-indexer/config.json`

### Basic Structure

```json
{
  "services": {
    "ingest": { ... },
    "dispatch": { ... },
    "executor": { ... }
  },
  "logging": { ... },
  "metrics": { ... },
  "database": { ... },
  "rpc": { ... }
}
```

## Service Configuration

### Ingest Service

The ingest service polls blockchain data and stores events.

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "shardId": "0",
        "batchSize": 100,
        "stepSize": 10,
        "maxStepSize": 1000,
        "minStepSize": 1,
        "pollInterval": 1000,
        "timeout": 5000,
        "retries": 3,
        "circuitBreakerThreshold": 5,
        "rateLimitRps": 10,
        "metricsPort": 9090
      }
    }
  }
}
```

#### Ingest Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rpcUrl` | string | - | RPC endpoint URL |
| `dbUrl` | string | - | Database connection string |
| `shardId` | string | "0" | Shard identifier |
| `batchSize` | number | 100 | Number of events per batch |
| `stepSize` | number | 10 | Initial step size for polling |
| `maxStepSize` | number | 1000 | Maximum step size |
| `minStepSize` | number | 1 | Minimum step size |
| `pollInterval` | number | 1000 | Polling interval in ms |
| `timeout` | number | 5000 | Request timeout in ms |
| `retries` | number | 3 | Number of retries |
| `circuitBreakerThreshold` | number | 5 | Circuit breaker failure threshold |
| `rateLimitRps` | number | 10 | Rate limit requests per second |
| `metricsPort` | number | 9090 | Metrics server port |

### Dispatch Service

The dispatch service processes events through handlers.

```json
{
  "services": {
    "dispatch": {
      "enabled": true,
      "config": {
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "batchSize": 50,
        "pollInterval": 1000,
        "maxRetries": 3,
        "retryDelay": 1000,
        "timeout": 5000
      }
    }
  }
}
```

#### Dispatch Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dbUrl` | string | - | Database connection string |
| `batchSize` | number | 50 | Number of events per batch |
| `pollInterval` | number | 1000 | Polling interval in ms |
| `maxRetries` | number | 3 | Maximum retries per event |
| `retryDelay` | number | 1000 | Delay between retries in ms |
| `timeout` | number | 5000 | Handler timeout in ms |

### Executor Service

The executor service executes on-chain commands.

```json
{
  "services": {
    "executor": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "privateKey": "0x...",
        "gasLimit": 21000,
        "gasPrice": "20000000000",
        "maxFeePerGas": "20000000000",
        "maxPriorityFeePerGas": "2000000000",
        "nonce": null,
        "chainId": 1,
        "timeout": 30000,
        "retries": 3,
        "pollInterval": 1000
      }
    }
  }
}
```

#### Executor Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rpcUrl` | string | - | RPC endpoint URL |
| `dbUrl` | string | - | Database connection string |
| `privateKey` | string | - | Private key for signing |
| `gasLimit` | number | 21000 | Gas limit for transactions |
| `gasPrice` | string | "20000000000" | Gas price in wei |
| `maxFeePerGas` | string | "20000000000" | Max fee per gas (EIP-1559) |
| `maxPriorityFeePerGas` | string | "2000000000" | Max priority fee per gas |
| `nonce` | number | null | Transaction nonce (auto if null) |
| `chainId` | number | 1 | Chain ID for the network |
| `timeout` | number | 30000 | Request timeout in ms |
| `retries` | number | 3 | Number of retries |
| `pollInterval` | number | 1000 | Polling interval in ms |

## Global Configuration

### Logging Configuration

```json
{
  "logging": {
    "level": "info",
    "format": "json",
    "file": "./logs/indexer.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

#### Logging Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | "info" | Log level (debug, info, warn, error) |
| `format` | string | "json" | Log format (json, text) |
| `file` | string | null | Log file path |
| `maxSize` | string | "10MB" | Maximum log file size |
| `maxFiles` | number | 5 | Maximum number of log files |

### Metrics Configuration

```json
{
  "metrics": {
    "enabled": true,
    "port": 9090,
    "path": "/metrics",
    "collectDefaultMetrics": true
  }
}
```

#### Metrics Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable metrics collection |
| `port` | number | 9090 | Metrics server port |
| `path` | string | "/metrics" | Metrics endpoint path |
| `collectDefaultMetrics` | boolean | true | Collect default Node.js metrics |

### Database Configuration

```json
{
  "database": {
    "url": "postgresql://user:pass@localhost:5432/indexer",
    "pool": {
      "min": 2,
      "max": 10,
      "idleTimeoutMillis": 30000,
      "connectionTimeoutMillis": 2000
    },
    "migrations": {
      "enabled": true,
      "path": "./migrations"
    }
  }
}
```

#### Database Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | - | Database connection string |
| `pool.min` | number | 2 | Minimum connections |
| `pool.max` | number | 10 | Maximum connections |
| `pool.idleTimeoutMillis` | number | 30000 | Idle timeout in ms |
| `pool.connectionTimeoutMillis` | number | 2000 | Connection timeout in ms |
| `migrations.enabled` | boolean | true | Enable migrations |
| `migrations.path` | string | "./migrations" | Migrations directory |

## Environment Variables

### Database Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:pass@localhost:5432/indexer
DB_HOST=localhost
DB_PORT=5432
DB_NAME=indexer
DB_USER=indexer
DB_PASSWORD=password
DB_SSL=false
```

### RPC Variables

```bash
# RPC configuration
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
RPC_TIMEOUT=5000
RPC_RETRIES=3
RPC_RATE_LIMIT=10
```

### Executor Variables

```bash
# Executor configuration
PRIVATE_KEY=0x...
GAS_LIMIT=21000
GAS_PRICE=20000000000
MAX_FEE_PER_GAS=20000000000
MAX_PRIORITY_FEE_PER_GAS=2000000000
CHAIN_ID=1
```

### Logging Variables

```bash
# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=./logs/indexer.log
```

### Metrics Variables

```bash
# Metrics configuration
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/metrics
```

## Configuration Templates

### Development Configuration

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-goerli.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://indexer:password@localhost:5432/indexer_dev",
        "shardId": "0",
        "batchSize": 10,
        "stepSize": 5,
        "pollInterval": 2000
      }
    },
    "dispatch": {
      "enabled": true,
      "config": {
        "dbUrl": "postgresql://indexer:password@localhost:5432/indexer_dev",
        "batchSize": 5
      }
    },
    "executor": {
      "enabled": false
    }
  },
  "logging": {
    "level": "debug",
    "format": "text"
  },
  "metrics": {
    "enabled": true,
    "port": 9090
  }
}
```

### Production Configuration

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://indexer:password@db.example.com:5432/indexer",
        "shardId": "0",
        "batchSize": 1000,
        "stepSize": 100,
        "maxStepSize": 5000,
        "minStepSize": 10,
        "pollInterval": 500,
        "timeout": 10000,
        "retries": 5,
        "circuitBreakerThreshold": 10,
        "rateLimitRps": 50
      }
    },
    "dispatch": {
      "enabled": true,
      "config": {
        "dbUrl": "postgresql://indexer:password@db.example.com:5432/indexer",
        "batchSize": 500,
        "pollInterval": 500,
        "maxRetries": 5,
        "retryDelay": 2000,
        "timeout": 10000
      }
    },
    "executor": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://indexer:password@db.example.com:5432/indexer",
        "privateKey": "0x...",
        "gasLimit": 21000,
        "gasPrice": "20000000000",
        "maxFeePerGas": "20000000000",
        "maxPriorityFeePerGas": "2000000000",
        "chainId": 1,
        "timeout": 60000,
        "retries": 5,
        "pollInterval": 500
      }
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "file": "/var/log/indexer/indexer.log",
    "maxSize": "100MB",
    "maxFiles": 10
  },
  "metrics": {
    "enabled": true,
    "port": 9090
  },
  "database": {
    "url": "postgresql://indexer:password@db.example.com:5432/indexer",
    "pool": {
      "min": 5,
      "max": 50,
      "idleTimeoutMillis": 60000,
      "connectionTimeoutMillis": 5000
    }
  }
}
```

### High-Availability Configuration

```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://indexer:password@db.example.com:5432/indexer",
        "shardId": "0",
        "batchSize": 2000,
        "stepSize": 200,
        "maxStepSize": 10000,
        "minStepSize": 50,
        "pollInterval": 250,
        "timeout": 15000,
        "retries": 10,
        "circuitBreakerThreshold": 20,
        "rateLimitRps": 100
      }
    }
  },
  "database": {
    "url": "postgresql://indexer:password@db.example.com:5432/indexer",
    "pool": {
      "min": 10,
      "max": 100,
      "idleTimeoutMillis": 120000,
      "connectionTimeoutMillis": 10000
    }
  }
}
```

## Advanced Configuration

### Custom Event Subscriptions

```json
{
  "services": {
    "ingest": {
      "config": {
        "subscriptions": [
          {
            "address": "0xA0b86a33E6441b8c4C8C0C4C0C4C0C4C0C4C0C4C",
            "topics": [
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
            ]
          }
        ]
      }
    }
  }
}
```

### Custom Handlers

```json
{
  "services": {
    "dispatch": {
      "config": {
        "handlers": {
          "TRANSFER": "./handlers/transfer.js",
          "APPROVAL": "./handlers/approval.js",
          "MINT": "./handlers/mint.js"
        }
      }
    }
  }
}
```

### Custom Metrics

```json
{
  "metrics": {
    "custom": {
      "events_processed_total": {
        "type": "counter",
        "help": "Total events processed"
      },
      "processing_duration_seconds": {
        "type": "histogram",
        "help": "Event processing duration"
      }
    }
  }
}
```

## Configuration Validation

### Validate Configuration

```bash
# Validate configuration file
gx config validate

# Validate with custom file
gx config validate --config ./my-config.json
```

### Show Configuration

```bash
# Show current configuration
gx config show

# Show in different formats
gx config show --format json
gx config show --format yaml
gx config show --format table
```

## Best Practices

### 1. Environment-Specific Configs

- Use separate config files for dev/staging/prod
- Use environment variables for secrets
- Keep sensitive data out of version control

### 2. Performance Tuning

- Adjust batch sizes based on your use case
- Tune step sizes for optimal polling
- Configure connection pools appropriately
- Set appropriate timeouts

### 3. Monitoring

- Enable metrics collection
- Set up log aggregation
- Configure health checks
- Monitor resource usage

### 4. Security

- Use strong database passwords
- Rotate API keys regularly
- Use SSL for database connections
- Restrict network access

## Troubleshooting

### Common Configuration Issues

#### Invalid JSON

```bash
# Check JSON syntax
gx config validate
```

#### Missing Required Fields

```bash
# Show configuration with defaults
gx config show
```

#### Environment Variable Overrides

```bash
# Check environment variables
env | grep -E "(DATABASE|RPC|LOG|METRICS)"
```

## Next Steps

- **Read the [Deployment Guide](./deployment.md)** for production setup
- **Check the [Troubleshooting Guide](./troubleshooting.md)** for common issues
- **Explore the [Examples](../examples/)** for configuration examples
