# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Good Indexer.

## Quick Diagnostics

### Check System Status

```bash
# Check all services
gx status

# Check health
gx health

# View logs
gx logs all --follow
```

### Check Configuration

```bash
# Validate configuration
gx config validate

# Show current configuration
gx config show

# Check environment variables
env | grep -E "(DATABASE|RPC|LOG|METRICS)"
```

## Common Issues

### 1. Service Won't Start

#### Symptoms
- Service fails to start
- Error messages in logs
- Status shows "stopped"

#### Diagnosis

```bash
# Check logs for errors
gx logs ingest --level error

# Check configuration
gx config validate

# Check database connection
gx db migrate --dry-run
```

#### Common Causes

**Invalid Configuration**
```bash
# Fix: Validate and correct configuration
gx config validate
gx config show
```

**Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -U indexer -d indexer -c "SELECT 1;"

# Check database URL
echo $DATABASE_URL
```

**RPC Connection Failed**
```bash
# Test RPC URL
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $RPC_URL

# Check API key
echo $RPC_URL
```

**Port Already in Use**
```bash
# Check what's using the port
lsof -i :9090

# Kill the process
kill -9 <PID>

# Or use a different port
gx start all --metrics-port 9091
```

#### Solutions

1. **Fix Configuration**
   ```bash
   # Edit configuration file
   gx config init --template production
   # Edit the generated config file
   ```

2. **Fix Database Connection**
   ```bash
   # Start PostgreSQL
   sudo systemctl start postgresql
   
   # Create database
   createdb indexer
   
   # Run migrations
   gx db migrate
   ```

3. **Fix RPC Connection**
   ```bash
   # Check API key
   echo $RPC_URL
   
   # Test with different provider
   export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/your-key"
   ```

### 2. High Memory Usage

#### Symptoms
- High memory consumption
- Out of memory errors
- Slow performance

#### Diagnosis

```bash
# Check memory usage
gx metrics | grep memory

# Check process memory
ps aux | grep gx

# Check system memory
free -h
```

#### Common Causes

**Large Batch Sizes**
```json
{
  "services": {
    "ingest": {
      "config": {
        "batchSize": 10000  // Too large
      }
    }
  }
}
```

**Memory Leaks**
- Unhandled promises
- Event listeners not cleaned up
- Large objects not garbage collected

#### Solutions

1. **Reduce Batch Sizes**
   ```json
   {
     "services": {
       "ingest": {
         "config": {
           "batchSize": 100  // Reduce from 1000
         }
       }
     }
   }
   ```

2. **Optimize Configuration**
   ```json
   {
     "services": {
       "ingest": {
         "config": {
           "stepSize": 50,      // Reduce step size
           "maxStepSize": 500,  // Reduce max step size
           "pollInterval": 2000 // Increase poll interval
         }
       }
     }
   }
   ```

3. **Monitor Memory Usage**
   ```bash
   # Watch memory metrics
   gx metrics --watch | grep memory
   ```

### 3. Slow Performance

#### Symptoms
- Slow event processing
- High latency
- Low throughput

#### Diagnosis

```bash
# Check metrics
gx metrics --watch

# Check logs for errors
gx logs ingest --level debug

# Check database performance
gx logs ingest | grep "database"
```

#### Common Causes

**Database Bottlenecks**
- Missing indexes
- Large table scans
- Connection pool exhaustion

**RPC Limitations**
- Rate limiting
- Network latency
- Provider throttling

**Configuration Issues**
- Small batch sizes
- High poll intervals
- Inefficient step sizes

#### Solutions

1. **Optimize Database**
   ```sql
   -- Create indexes
   CREATE INDEX CONCURRENTLY idx_ingest_events_block_number 
   ON infra.ingest_events(block_number);
   
   CREATE INDEX CONCURRENTLY idx_ingest_events_address_topic 
   ON infra.ingest_events(address, topic0);
   ```

2. **Optimize RPC Usage**
   ```json
   {
     "services": {
       "ingest": {
         "config": {
           "rateLimitRps": 50,        // Increase rate limit
           "circuitBreakerThreshold": 10, // Increase threshold
           "timeout": 10000          // Increase timeout
         }
       }
     }
   }
   ```

3. **Optimize Configuration**
   ```json
   {
     "services": {
       "ingest": {
         "config": {
           "batchSize": 1000,        // Increase batch size
           "stepSize": 100,          // Increase step size
           "pollInterval": 500       // Reduce poll interval
         }
       }
     }
   }
   ```

### 4. Database Errors

#### Symptoms
- Database connection errors
- Migration failures
- Query timeouts

#### Diagnosis

```bash
# Check database status
sudo systemctl status postgresql

# Test connection
psql -U indexer -d indexer -c "SELECT 1;"

# Check logs
gx logs ingest | grep -i database
```

#### Common Causes

**Connection Issues**
- Database server down
- Wrong credentials
- Network problems

**Migration Issues**
- Corrupted migrations
- Version conflicts
- Permission problems

**Query Issues**
- Missing indexes
- Large table scans
- Lock contention

#### Solutions

1. **Fix Connection Issues**
   ```bash
   # Start PostgreSQL
   sudo systemctl start postgresql
   
   # Check credentials
   echo $DATABASE_URL
   
   # Test connection
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Fix Migration Issues**
   ```bash
   # Reset migrations
   gx db reset --confirm
   
   # Run migrations
   gx db migrate
   ```

3. **Optimize Database**
   ```sql
   -- Check table sizes
   SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables WHERE schemaname = 'infra';
   
   -- Analyze tables
   ANALYZE infra.ingest_events;
   ```

### 5. RPC Errors

#### Symptoms
- RPC connection failures
- Rate limit errors
- Timeout errors

#### Diagnosis

```bash
# Test RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $RPC_URL

# Check logs
gx logs ingest | grep -i rpc
```

#### Common Causes

**API Key Issues**
- Invalid API key
- Expired API key
- Rate limit exceeded

**Network Issues**
- Internet connectivity
- DNS resolution
- Firewall blocking

**Provider Issues**
- Service downtime
- Maintenance windows
- Rate limiting

#### Solutions

1. **Fix API Key Issues**
   ```bash
   # Check API key
   echo $RPC_URL
   
   # Test with different provider
   export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/your-key"
   ```

2. **Fix Network Issues**
   ```bash
   # Test connectivity
   ping google.com
   
   # Test DNS
   nslookup eth-mainnet.g.alchemy.com
   
   # Check firewall
   sudo ufw status
   ```

3. **Handle Rate Limiting**
   ```json
   {
     "services": {
       "ingest": {
         "config": {
           "rateLimitRps": 10,        // Reduce rate limit
           "circuitBreakerThreshold": 5, // Reduce threshold
           "retries": 5               // Increase retries
         }
       }
     }
   }
   ```

### 6. Event Processing Issues

#### Symptoms
- Events not processed
- Duplicate events
- Missing events

#### Diagnosis

```bash
# Check event counts
gx metrics | grep events

# Check logs
gx logs dispatch --follow

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM infra.ingest_events;"
```

#### Common Causes

**Handler Errors**
- Invalid event data
- Handler exceptions
- Database errors

**Duplicate Processing**
- Inbox pattern issues
- Handler idempotency
- Race conditions

**Missing Events**
- Polling gaps
- RPC failures
- Database issues

#### Solutions

1. **Fix Handler Errors**
   ```typescript
   // Add error handling
   export async function handleTransfer(event: ProcessedEvent) {
     try {
       // Process event
       await processTransfer(event.payload);
     } catch (error) {
       console.error('Transfer processing failed:', error);
       throw error; // Let dispatcher handle retry
     }
   }
   ```

2. **Fix Duplicate Processing**
   ```typescript
   // Add idempotency check
   export async function handleTransfer(event: ProcessedEvent) {
     const existing = await checkExistingTransfer(event.eventId);
     if (existing) {
       return; // Already processed
     }
     
     await processTransfer(event.payload);
   }
   ```

3. **Fix Missing Events**
   ```bash
   # Check polling gaps
   gx logs ingest | grep "gap"
   
   # Check RPC errors
   gx logs ingest | grep "rpc"
   
   # Check database
   psql $DATABASE_URL -c "SELECT MIN(block_number), MAX(block_number) FROM infra.ingest_events;"
   ```

## Performance Tuning

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_ingest_events_block_number 
ON infra.ingest_events(block_number);

CREATE INDEX CONCURRENTLY idx_ingest_events_address_topic 
ON infra.ingest_events(address, topic0);

-- Analyze tables
ANALYZE infra.ingest_events;
ANALYZE infra.ingest_outbox;
ANALYZE infra.inbox;
```

### 2. Application Optimization

```json
{
  "services": {
    "ingest": {
      "config": {
        "batchSize": 2000,        // Increase batch size
        "stepSize": 200,          // Increase step size
        "maxStepSize": 5000,      // Increase max step size
        "pollInterval": 100,      // Reduce poll interval
        "rateLimitRps": 100       // Increase rate limit
      }
    }
  }
}
```

### 3. Resource Optimization

```yaml
# Kubernetes resource limits
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

## Monitoring and Alerting

### 1. Key Metrics to Monitor

```bash
# Events processed per second
gx metrics | grep "events_processed_total"

# Processing duration
gx metrics | grep "event_processing_duration_seconds"

# RPC request duration
gx metrics | grep "rpc_request_duration_seconds"

# Database connection pool
gx metrics | grep "database_connections"
```

### 2. Alerting Rules

```yaml
# Prometheus alerting rules
groups:
- name: good-indexer
  rules:
  - alert: HighErrorRate
    expr: rate(events_processed_total{status="error"}[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      
  - alert: HighProcessingDuration
    expr: histogram_quantile(0.95, rate(event_processing_duration_seconds_bucket[5m])) > 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High processing duration detected"
```

### 3. Health Checks

```bash
# Check service health
gx health

# Check specific service
gx status

# Check metrics endpoint
curl http://localhost:9090/metrics
```

## Log Analysis

### 1. Common Log Patterns

```bash
# Error logs
gx logs all --level error

# Warning logs
gx logs all --level warn

# Debug logs
gx logs all --level debug

# Specific service logs
gx logs ingest --follow
```

### 2. Log Filtering

```bash
# Filter by keyword
gx logs ingest | grep "error"

# Filter by time
gx logs ingest --since "2024-01-01T00:00:00Z"

# Filter by level
gx logs ingest --level error
```

### 3. Log Aggregation

```bash
# Send logs to external system
gx logs all --format json | jq '.' | curl -X POST -H "Content-Type: application/json" -d @- http://logstash:5044
```

## Recovery Procedures

### 1. Service Recovery

```bash
# Restart all services
gx stop all
gx start all

# Restart specific service
gx restart ingest

# Force restart
gx stop ingest --force
gx start ingest
```

### 2. Database Recovery

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Reset and migrate
gx db reset --confirm
gx db migrate
```

### 3. Configuration Recovery

```bash
# Restore configuration
cp config.backup.json good-indexer.json

# Validate configuration
gx config validate
```

## Getting Help

### 1. Self-Diagnosis

```bash
# Run diagnostics
gx health
gx status
gx config validate

# Collect logs
gx logs all > logs.txt

# Collect metrics
gx metrics > metrics.txt
```

### 2. Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/glenneggleton/good-indexer/issues)
- **Documentation**: [Full documentation](https://github.com/glenneggleton/good-indexer#readme)
- **Examples**: [Example implementations](https://github.com/glenneggleton/good-indexer/tree/main/examples)

### 3. Professional Support

For production deployments requiring professional support:

- **Consulting**: Architecture and deployment guidance
- **Training**: Team training and best practices
- **Support**: 24/7 production support

## Next Steps

- **Read the [Deployment Guide](./deployment.md)** for production setup
- **Check the [Configuration Guide](./configuration.md)** for advanced configuration
- **Explore the [Examples](../examples/)** for implementation examples
