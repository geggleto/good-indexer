# Deployment Guide

This guide covers production deployment strategies for Good Indexer, including Docker, Kubernetes, and cloud platform deployments.

## Deployment Overview

Good Indexer is designed for production deployment with:

- **High availability** through horizontal scaling
- **Fault tolerance** with circuit breakers and retries
- **Observability** with comprehensive metrics and logging
- **Security** with proper secret management
- **Performance** with optimized configurations

## Deployment Strategies

### 1. Single Server Deployment

Best for small to medium workloads.

#### Prerequisites

- Ubuntu 20.04+ or CentOS 8+
- 8GB+ RAM
- 4+ CPU cores
- 100GB+ storage
- PostgreSQL 15+

#### Installation

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Install PM2 for process management
sudo npm install -g pm2

# Install Good Indexer CLI
sudo npm install -g @good-indexer/cli
```

#### Configuration

```bash
# Create application directory
sudo mkdir -p /opt/good-indexer
sudo chown $USER:$USER /opt/good-indexer
cd /opt/good-indexer

# Initialize configuration
gx config init --template production

# Set up environment variables
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://indexer:password@localhost:5432/indexer
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
PRIVATE_KEY=0x...
LOG_LEVEL=info
METRICS_PORT=9090
EOF
```

#### Database Setup

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE indexer;
CREATE USER indexer WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE indexer TO indexer;
EOF

# Run migrations
gx db migrate
```

#### Process Management

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'good-indexer-ingest',
      script: 'gx',
      args: 'start ingest',
      cwd: '/opt/good-indexer',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'good-indexer-dispatch',
      script: 'gx',
      args: 'start dispatch',
      cwd: '/opt/good-indexer',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'good-indexer-executor',
      script: 'gx',
      args: 'start executor',
      cwd: '/opt/good-indexer',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
EOF

# Start services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### 2. Docker Deployment

Best for containerized environments and microservices.

#### Dockerfile

```dockerfile
FROM node:22-alpine

# Install dependencies
RUN apk add --no-cache postgresql-client

# Create app directory
WORKDIR /app

# Install Good Indexer CLI
RUN npm install -g @good-indexer/cli

# Copy configuration
COPY . .

# Expose metrics port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD gx health || exit 1

# Start command
CMD ["gx", "start", "all"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: indexer
      POSTGRES_USER: indexer
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U indexer -d indexer"]
      interval: 10s
      timeout: 5s
      retries: 5

  indexer:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://indexer:password@postgres:5432/indexer
      RPC_URL: https://eth-mainnet.g.alchemy.com/v2/your-key
      PRIVATE_KEY: 0x...
      LOG_LEVEL: info
      METRICS_PORT: 9090
    ports:
      - "9090:9090"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "gx", "health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
```

#### Build and Run

```bash
# Build image
docker build -t good-indexer .

# Run with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f indexer
```

### 3. Kubernetes Deployment

Best for large-scale, cloud-native deployments.

#### Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: good-indexer
```

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: good-indexer-config
  namespace: good-indexer
data:
  config.json: |
    {
      "services": {
        "ingest": {
          "enabled": true,
          "config": {
            "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/your-key",
            "dbUrl": "postgresql://indexer:password@postgres:5432/indexer",
            "shardId": "0",
            "batchSize": 1000
          }
        }
      }
    }
```

#### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: good-indexer-secrets
  namespace: good-indexer
type: Opaque
data:
  private-key: <base64-encoded-private-key>
  rpc-url: <base64-encoded-rpc-url>
```

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: good-indexer
  namespace: good-indexer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: good-indexer
  template:
    metadata:
      labels:
        app: good-indexer
    spec:
      containers:
      - name: indexer
        image: good-indexer:latest
        ports:
        - containerPort: 9090
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          value: "postgresql://indexer:password@postgres:5432/indexer"
        - name: PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: good-indexer-secrets
              key: private-key
        - name: RPC_URL
          valueFrom:
            secretKeyRef:
              name: good-indexer-secrets
              key: rpc-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 9090
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: good-indexer-service
  namespace: good-indexer
spec:
  selector:
    app: good-indexer
  ports:
  - port: 9090
    targetPort: 9090
  type: ClusterIP
```

#### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: good-indexer-hpa
  namespace: good-indexer
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: good-indexer
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 4. Cloud Platform Deployments

#### AWS ECS

```yaml
# task-definition.json
{
  "family": "good-indexer",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "indexer",
      "image": "good-indexer:latest",
      "portMappings": [
        {
          "containerPort": 9090,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:good-indexer/database-url"
        },
        {
          "name": "RPC_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:good-indexer/rpc-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/good-indexer",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Google Cloud Run

```yaml
# cloud-run.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: good-indexer
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 1000
      timeoutSeconds: 300
      containers:
      - image: gcr.io/project/good-indexer:latest
        ports:
        - containerPort: 9090
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: good-indexer-secrets
              key: database-url
        resources:
          limits:
            cpu: "2000m"
            memory: "4Gi"
          requests:
            cpu: "1000m"
            memory: "2Gi"
```

#### Azure Container Instances

```yaml
# azure-container-instance.yaml
apiVersion: 2019-12-01
location: eastus
name: good-indexer
properties:
  containers:
  - name: indexer
    properties:
      image: good-indexer:latest
      ports:
      - port: 9090
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: "production"
      - name: DATABASE_URL
        secureValue: "postgresql://..."
      resources:
        requests:
          cpu: 1.0
          memoryInGb: 2.0
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 9090
```

## Monitoring and Observability

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
- job_name: 'good-indexer'
  static_configs:
  - targets: ['good-indexer:9090']
  scrape_interval: 5s
  metrics_path: /metrics
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Good Indexer",
    "panels": [
      {
        "title": "Events Processed",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(events_processed_total[5m])",
            "legendFormat": "Events/sec"
          }
        ]
      },
      {
        "title": "Processing Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(event_processing_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation

#### ELK Stack

```yaml
# docker-compose.logging.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    ports:
      - "5601:5601"
```

## Security Considerations

### 1. Secret Management

```bash
# Use environment variables for secrets
export DATABASE_URL="postgresql://user:password@localhost:5432/indexer"
export PRIVATE_KEY="0x..."

# Or use secret management services
# AWS Secrets Manager
# Azure Key Vault
# HashiCorp Vault
```

### 2. Network Security

```yaml
# Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: good-indexer-netpol
spec:
  podSelector:
    matchLabels:
      app: good-indexer
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: postgres
    ports:
    - protocol: TCP
      port: 5432
```

### 3. RBAC

```yaml
# Kubernetes RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: good-indexer-role
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list"]
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_ingest_events_block_number 
ON infra.ingest_events(block_number);

CREATE INDEX CONCURRENTLY idx_ingest_events_address_topic 
ON infra.ingest_events(address, topic0);

-- Partition large tables
CREATE TABLE infra.ingest_events_2024_01 
PARTITION OF infra.ingest_events 
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. Application Optimization

```json
{
  "services": {
    "ingest": {
      "config": {
        "batchSize": 2000,
        "stepSize": 500,
        "maxStepSize": 10000,
        "pollInterval": 100
      }
    }
  }
}
```

### 3. Resource Limits

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

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup script
#!/bin/bash
pg_dump -h localhost -U indexer -d indexer > backup_$(date +%Y%m%d_%H%M%S).sql

# Schedule with cron
0 2 * * * /opt/good-indexer/backup.sh
```

### 2. Configuration Backup

```bash
# Backup configuration
tar -czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz /opt/good-indexer/
```

### 3. Disaster Recovery

```bash
# Restore database
psql -h localhost -U indexer -d indexer < backup_20240101_020000.sql

# Restore configuration
tar -xzf config_backup_20240101_020000.tar.gz -C /
```

## Troubleshooting

### 1. Common Issues

#### Service Won't Start

```bash
# Check logs
gx logs all --follow

# Check configuration
gx config validate

# Check database connection
gx db migrate --dry-run
```

#### High Memory Usage

```bash
# Check memory usage
gx metrics | grep memory

# Adjust batch sizes
gx config show | grep batchSize
```

#### Slow Performance

```bash
# Check metrics
gx metrics --watch

# Check database performance
gx logs ingest --level debug
```

### 2. Monitoring Commands

```bash
# Check service status
gx status

# Check health
gx health

# View metrics
gx metrics

# View logs
gx logs all --follow
```

## Next Steps

- **Read the [Troubleshooting Guide](./troubleshooting.md)** for common issues
- **Check the [Configuration Guide](./configuration.md)** for advanced setup
- **Explore the [Examples](../examples/)** for deployment examples
