# @good-indexer/cli API Documentation

Command line interface for the good-indexer system.

## Overview

The `@good-indexer/cli` package provides a comprehensive command-line interface for managing and operating the good-indexer system. It includes commands for starting services, managing configuration, and monitoring system health.

## Installation

```bash
npm install -g @good-indexer/cli
```

## Commands

### Global Commands

#### `gx --help`

Shows help information for all available commands.

```bash
gx --help
```

#### `gx --version`

Shows the current version of the CLI.

```bash
gx --version
```

### Service Commands

#### `gx start <service>`

Starts a specific service.

**Syntax:**
```bash
gx start <service> [options]
```

**Services:**
- `ingest`: Start the ingestion service
- `dispatch`: Start the dispatch service
- `executor`: Start the executor service
- `all`: Start all services

**Options:**
- `--config <path>`: Path to configuration file
- `--env <file>`: Environment file to load
- `--daemon`: Run as daemon process

**Examples:**
```bash
# Start ingestion service
gx start ingest

# Start with custom config
gx start ingest --config ./config.json

# Start all services as daemon
gx start all --daemon
```

#### `gx stop <service>`

Stops a specific service.

**Syntax:**
```bash
gx stop <service> [options]
```

**Services:**
- `ingest`: Stop the ingestion service
- `dispatch`: Stop the dispatch service
- `executor`: Stop the executor service
- `all`: Stop all services

**Options:**
- `--force`: Force stop without graceful shutdown

**Examples:**
```bash
# Stop ingestion service
gx stop ingest

# Force stop all services
gx stop all --force
```

#### `gx restart <service>`

Restarts a specific service.

**Syntax:**
```bash
gx restart <service> [options]
```

**Examples:**
```bash
# Restart ingestion service
gx restart ingest

# Restart with custom config
gx restart ingest --config ./config.json
```

### Configuration Commands

#### `gx config init`

Initializes a new configuration file.

**Syntax:**
```bash
gx config init [options]
```

**Options:**
- `--output <path>`: Output path for config file
- `--template <name>`: Configuration template to use

**Examples:**
```bash
# Initialize default config
gx config init

# Initialize with custom output
gx config init --output ./my-config.json

# Initialize with template
gx config init --template production
```

#### `gx config validate`

Validates a configuration file.

**Syntax:**
```bash
gx config validate [options]
```

**Options:**
- `--config <path>`: Path to configuration file

**Examples:**
```bash
# Validate default config
gx config validate

# Validate custom config
gx config validate --config ./config.json
```

#### `gx config show`

Shows the current configuration.

**Syntax:**
```bash
gx config show [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--format <format>`: Output format (json, yaml, table)

**Examples:**
```bash
# Show current config
gx config show

# Show config in JSON format
gx config show --format json
```

### Database Commands

#### `gx db migrate`

Runs database migrations.

**Syntax:**
```bash
gx db migrate [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--dry-run`: Show what would be migrated without executing

**Examples:**
```bash
# Run migrations
gx db migrate

# Dry run migrations
gx db migrate --dry-run
```

#### `gx db reset`

Resets the database (WARNING: Destructive operation).

**Syntax:**
```bash
gx db reset [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--confirm`: Skip confirmation prompt

**Examples:**
```bash
# Reset database with confirmation
gx db reset

# Reset database without confirmation
gx db reset --confirm
```

#### `gx db seed`

Seeds the database with initial data.

**Syntax:**
```bash
gx db seed [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--data <path>`: Path to seed data file

**Examples:**
```bash
# Seed database
gx db seed

# Seed with custom data
gx db seed --data ./seed-data.json
```

### Monitoring Commands

#### `gx status`

Shows the status of all services.

**Syntax:**
```bash
gx status [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--format <format>`: Output format (json, yaml, table)

**Examples:**
```bash
# Show service status
gx status

# Show status in JSON format
gx status --format json
```

#### `gx logs <service>`

Shows logs for a specific service.

**Syntax:**
```bash
gx logs <service> [options]
```

**Options:**
- `--follow`: Follow log output
- `--tail <number>`: Number of lines to show
- `--level <level>`: Log level filter

**Examples:**
```bash
# Show ingestion logs
gx logs ingest

# Follow logs with tail
gx logs ingest --follow --tail 100

# Filter by log level
gx logs ingest --level error
```

#### `gx metrics`

Shows system metrics.

**Syntax:**
```bash
gx metrics [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--format <format>`: Output format (json, yaml, table)
- `--watch`: Watch metrics in real-time

**Examples:**
```bash
# Show metrics
gx metrics

# Watch metrics in real-time
gx metrics --watch
```

### Utility Commands

#### `gx health`

Checks the health of all services.

**Syntax:**
```bash
gx health [options]
```

**Options:**
- `--config <path>`: Path to configuration file
- `--timeout <ms>`: Health check timeout

**Examples:**
```bash
# Check health
gx health

# Check health with timeout
gx health --timeout 5000
```

#### `gx version`

Shows version information for all packages.

**Syntax:**
```bash
gx version [options]
```

**Options:**
- `--format <format>`: Output format (json, yaml, table)

**Examples:**
```bash
# Show versions
gx version

# Show versions in JSON format
gx version --format json
```

## Configuration

### Configuration File

The CLI uses a JSON configuration file that can be specified with the `--config` option or loaded from the default location.

**Default locations:**
- `./good-indexer.json`
- `./config/good-indexer.json`
- `~/.config/good-indexer/config.json`

**Example configuration:**
```json
{
  "services": {
    "ingest": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "shardId": "0",
        "batchSize": 100
      }
    },
    "dispatch": {
      "enabled": true,
      "config": {
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "batchSize": 50
      }
    },
    "executor": {
      "enabled": true,
      "config": {
        "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
        "dbUrl": "postgresql://user:pass@localhost:5432/indexer",
        "privateKey": "0x...",
        "gasLimit": 21000
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

### Environment Variables

The CLI supports configuration through environment variables:

- `GOOD_INDEXER_CONFIG`: Path to configuration file
- `GOOD_INDEXER_LOG_LEVEL`: Log level
- `GOOD_INDEXER_METRICS_PORT`: Metrics server port
- `RPC_URL`: RPC endpoint URL
- `DATABASE_URL`: Database connection string
- `PRIVATE_KEY`: Private key for executor

## Examples

### Complete Setup

```bash
# Install CLI globally
npm install -g @good-indexer/cli

# Initialize configuration
gx config init

# Run database migrations
gx db migrate

# Start all services
gx start all

# Check status
gx status

# View logs
gx logs ingest --follow

# Check health
gx health

# Stop all services
gx stop all
```

### Development Workflow

```bash
# Start only ingestion for development
gx start ingest --config ./dev-config.json

# Monitor logs
gx logs ingest --follow --level debug

# Check metrics
gx metrics --watch

# Restart service after changes
gx restart ingest
```

### Production Deployment

```bash
# Start all services as daemon
gx start all --daemon

# Check service status
gx status

# Monitor system health
gx health

# View error logs
gx logs ingest --level error
```

## Dependencies

- `@good-indexer/core`: Core types and utilities
- `@good-indexer/ingest`: Ingestion service
- `@good-indexer/dispatch`: Dispatch service
- `@good-indexer/executor-evm`: Executor service
- `@good-indexer/storage-postgres`: Database entities
- `@good-indexer/metrics`: Metrics collection
- `commander`: Command-line interface framework
- `@mikro-orm/core`: ORM functionality

## Version

Current version: 1.0.0

## License

MIT
