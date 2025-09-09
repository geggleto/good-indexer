# Dependency Injection with Inversify

This package now includes Inversify for dependency injection, which significantly improves testability and modularity.

## Architecture

### Core Components

1. **Interfaces** (`interfaces.ts`) - Define contracts for all services
2. **Services** (`services.ts`) - Concrete implementations of interfaces
3. **Container** (`container.ts`) - Inversify container configuration
4. **DI-enabled IngestDaemon** (`ingest.di.ts`) - Refactored daemon with DI

### Key Benefits

#### 1. **Improved Testability**
- Easy mocking of individual services
- Isolated testing of components
- No complex setup/teardown for tests

#### 2. **Better Modularity**
- Clear separation of concerns
- Easy service replacement
- Loose coupling between components

#### 3. **Configuration Flexibility**
- Different configurations for different environments
- Runtime service swapping
- Easy A/B testing of implementations

## Usage

### Basic Setup

```typescript
import 'reflect-metadata';
import { configureContainer } from './container.js';
import { IngestConfig } from './config.js';

const config: IngestConfig = {
  rpcReadUrl: 'https://rpc.example.com',
  dbUrl: 'postgresql://localhost:5432/test',
  // ... other config
};

const container = configureContainer(config);
const daemon = container.get<IngestDaemon>(TYPES.IngestDaemon);
```

### Testing with DI

```typescript
import { Container } from 'inversify';
import { IngestDaemon } from './ingest.di.js';
import { TYPES } from './container.js';

describe('IngestDaemon Tests', () => {
  let container: Container;
  let daemon: IngestDaemon;

  beforeEach(() => {
    container = new Container();
    
    // Bind mock services
    container.bind<IRpcReadClient>(TYPES.RpcReadClient)
      .toConstantValue(mockRpcClient);
    container.bind<ILogger>(TYPES.Logger)
      .toConstantValue(mockLogger);
    
    // Get daemon with injected mocks
    daemon = container.get<IngestDaemon>(TYPES.IngestDaemon);
  });

  it('should use mocked RPC client', async () => {
    // Test with mocked dependencies
    await daemon.start('test-shard', []);
    expect(mockRpcClient.getBlockNumber).toHaveBeenCalled();
  });
});
```

## Service Interfaces

### Core Services
- `IRpcReadClient` - RPC communication
- `IMikroORM` - Database operations
- `ILogger` - Logging
- `IDelay` - Async delays

### Metrics Services
- `ICounter` - Counter metrics
- `IHistogram` - Histogram metrics
- `IGauge` - Gauge metrics
- `IMetricsRegistry` - Metrics registry

### Utility Services
- `IHashService` - Hashing operations
- `IPathService` - Path operations
- `IFindRootService` - Monorepo root detection

## Migration from Original

The original `ingest.ts` remains unchanged for backward compatibility. The new DI-enabled version is in `ingest.di.ts`.

### Key Changes

1. **Constructor Injection**: All dependencies are injected via constructor
2. **Interface-based**: All dependencies use interfaces instead of concrete classes
3. **Container-managed**: Services are managed by the Inversify container
4. **Testable**: Easy to mock and test individual components

## Benefits for Testing

### Before DI
```typescript
// Hard to test - tightly coupled
class IngestDaemon {
  constructor(config: IngestConfig) {
    this.rpc = new RpcReadClient(config.rpcReadUrl);
    this.logger = console;
    // ... hard to mock
  }
}
```

### After DI
```typescript
// Easy to test - loosely coupled
@injectable()
class IngestDaemon {
  constructor(
    @inject(TYPES.RpcReadClient) private rpc: IRpcReadClient,
    @inject(TYPES.Logger) private logger: ILogger,
    // ... easy to mock
  ) {}
}
```

## Future Enhancements

1. **Service Lifecycle Management**: Singleton vs transient services
2. **Conditional Bindings**: Different implementations based on environment
3. **Middleware Support**: Cross-cutting concerns like logging, metrics
4. **Configuration Validation**: Runtime validation of service configurations

## Conclusion

The Inversify implementation provides a solid foundation for:
- **Maintainable code** with clear separation of concerns
- **Comprehensive testing** with easy mocking
- **Flexible configuration** for different environments
- **Future extensibility** with new services and features

This makes the ingest system much more robust and easier to work with in both development and production environments.
