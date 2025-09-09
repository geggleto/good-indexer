import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventProcessor,
  EventFetcher,
  PublisherLoop,
  IngestPublisher,
  createIngestPublisher,
  type DatabaseConnection,
  type PublisherDependencies,
} from './publisher.js';

describe('EventProcessor', () => {
  let mockConnection: DatabaseConnection;
  let mockLogger: PublisherDependencies['logger'];
  let eventProcessor: EventProcessor;

  beforeEach(() => {
    mockConnection = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    mockLogger = {
      error: vi.fn(),
    };
    eventProcessor = new EventProcessor(mockConnection, mockLogger);
  });

  describe('processEvent', () => {
    it('should process event successfully', async () => {
      const mockOnPublish = vi.fn().mockResolvedValue(undefined);
      const eventId = 'test-event-123';

      await eventProcessor.processEvent(eventId, mockOnPublish);

      expect(mockOnPublish).toHaveBeenCalledWith(eventId);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        `UPDATE infra.ingest_outbox SET published_at = now() WHERE event_id = $1`,
        [eventId]
      );
    });

    it('should handle publish errors gracefully', async () => {
      const mockOnPublish = vi.fn().mockRejectedValue(new Error('Publish failed'));
      const eventId = 'test-event-123';

      await eventProcessor.processEvent(eventId, mockOnPublish);

      expect(mockOnPublish).toHaveBeenCalledWith(eventId);
      expect(mockLogger.error).toHaveBeenCalledWith('publish error', expect.any(Error));
      expect(mockConnection.execute).toHaveBeenCalledWith(
        `UPDATE infra.ingest_outbox SET published_at = now() WHERE event_id = $1`,
        [eventId]
      );
    });

    it('should handle database update errors gracefully', async () => {
      const mockOnPublish = vi.fn().mockRejectedValue(new Error('Publish failed'));
      const eventId = 'test-event-123';
      mockConnection.execute
        .mockRejectedValueOnce(new Error('Database error')); // Update fails

      await eventProcessor.processEvent(eventId, mockOnPublish);

      expect(mockOnPublish).toHaveBeenCalledWith(eventId);
      expect(mockLogger.error).toHaveBeenCalledWith('publish error', expect.any(Error));
      expect(mockLogger.error).toHaveBeenCalledWith('database update error', expect.any(Error));
    });
  });
});

describe('EventFetcher', () => {
  let mockConnection: DatabaseConnection;
  let eventFetcher: EventFetcher;

  beforeEach(() => {
    mockConnection = {
      execute: vi.fn().mockResolvedValue([]),
    };
    eventFetcher = new EventFetcher(mockConnection, 100);
  });

  describe('fetchUnpublishedEvents', () => {
    it('should fetch events with default batch size', async () => {
      const mockEvents = [
        { event_id: 'event1' },
        { event_id: 'event2' },
      ];
      mockConnection.execute.mockResolvedValue(mockEvents);

      const result = await eventFetcher.fetchUnpublishedEvents();

      expect(result).toEqual(mockEvents);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        `SELECT event_id FROM infra.ingest_outbox WHERE published_at IS NULL ORDER BY event_id ASC NULLS LAST LIMIT $1`,
        [100]
      );
    });

    it('should fetch events with custom batch size', async () => {
      const customFetcher = new EventFetcher(mockConnection, 50);
      const mockEvents = [{ event_id: 'event1' }];
      mockConnection.execute.mockResolvedValue(mockEvents);

      const result = await customFetcher.fetchUnpublishedEvents();

      expect(result).toEqual(mockEvents);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        `SELECT event_id FROM infra.ingest_outbox WHERE published_at IS NULL ORDER BY event_id ASC NULLS LAST LIMIT $1`,
        [50]
      );
    });

    it('should return empty array when no events', async () => {
      mockConnection.execute.mockResolvedValue([]);

      const result = await eventFetcher.fetchUnpublishedEvents();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      await expect(eventFetcher.fetchUnpublishedEvents()).rejects.toThrow('Database error');
    });
  });
});

describe('PublisherLoop', () => {
  let mockEventFetcher: EventFetcher;
  let mockEventProcessor: EventProcessor;
  let mockDelay: PublisherDependencies['delay'];
  let publisherLoop: PublisherLoop;

  beforeEach(() => {
    mockEventFetcher = {
      fetchUnpublishedEvents: vi.fn().mockResolvedValue([]),
    } as any;
    mockEventProcessor = {
      processEvent: vi.fn().mockResolvedValue(undefined),
    } as any;
    mockDelay = vi.fn().mockResolvedValue(undefined);
    publisherLoop = new PublisherLoop(mockEventFetcher, mockEventProcessor, mockDelay);
  });

  describe('runLoop', () => {
    it('should process events when available', async () => {
      const mockEvents = [
        { event_id: 'event1' },
        { event_id: 'event2' },
      ];
      mockEventFetcher.fetchUnpublishedEvents
        .mockResolvedValueOnce(mockEvents)
        .mockResolvedValueOnce([]);
      
      const mockOnPublish = vi.fn().mockResolvedValue(undefined);
      let callCount = 0;
      const shouldContinue = () => {
        callCount++;
        return callCount < 3; // Stop after 2 iterations
      };

      await publisherLoop.runLoop(mockOnPublish, shouldContinue);

      expect(mockEventFetcher.fetchUnpublishedEvents).toHaveBeenCalledTimes(2);
      expect(mockEventProcessor.processEvent).toHaveBeenCalledTimes(2);
      expect(mockEventProcessor.processEvent).toHaveBeenCalledWith('event1', mockOnPublish);
      expect(mockEventProcessor.processEvent).toHaveBeenCalledWith('event2', mockOnPublish);
    });

    it('should delay when no events available', async () => {
      mockEventFetcher.fetchUnpublishedEvents.mockResolvedValue([]);
      
      const mockOnPublish = vi.fn().mockResolvedValue(undefined);
      let callCount = 0;
      const shouldContinue = () => {
        callCount++;
        return callCount < 2; // Stop after 1 iteration
      };

      await publisherLoop.runLoop(mockOnPublish, shouldContinue);

      expect(mockEventFetcher.fetchUnpublishedEvents).toHaveBeenCalledTimes(1);
      expect(mockDelay).toHaveBeenCalledWith(250);
      expect(mockEventProcessor.processEvent).not.toHaveBeenCalled();
    });

    it('should stop when shouldContinue returns false', async () => {
      const mockOnPublish = vi.fn().mockResolvedValue(undefined);
      const shouldContinue = vi.fn().mockReturnValue(false);

      await publisherLoop.runLoop(mockOnPublish, shouldContinue);

      expect(shouldContinue).toHaveBeenCalledTimes(1);
      expect(mockEventFetcher.fetchUnpublishedEvents).not.toHaveBeenCalled();
    });

    it('should handle multiple batches', async () => {
      const firstBatch = [{ event_id: 'event1' }];
      const secondBatch = [{ event_id: 'event2' }];
      const emptyBatch = [];
      
      mockEventFetcher.fetchUnpublishedEvents
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(secondBatch)
        .mockResolvedValueOnce(emptyBatch);
      
      const mockOnPublish = vi.fn().mockResolvedValue(undefined);
      let callCount = 0;
      const shouldContinue = () => {
        callCount++;
        return callCount < 4; // Stop after 3 iterations
      };

      await publisherLoop.runLoop(mockOnPublish, shouldContinue);

      expect(mockEventFetcher.fetchUnpublishedEvents).toHaveBeenCalledTimes(3);
      expect(mockEventProcessor.processEvent).toHaveBeenCalledTimes(2);
      expect(mockDelay).toHaveBeenCalledWith(250);
    });
  });
});

describe('IngestPublisher', () => {
  let mockDependencies: PublisherDependencies;
  let publisher: IngestPublisher;

  beforeEach(() => {
    mockDependencies = {
      findRootSync: vi.fn().mockReturnValue({ rootDir: '/mock/root' }),
      resolve: vi.fn().mockImplementation((...args) => args.join('/')),
      delay: vi.fn().mockResolvedValue(undefined),
      logger: {
        error: vi.fn(),
      },
    };
    publisher = new IngestPublisher(
      { dbUrl: 'postgresql://localhost:5432/test' },
      mockDependencies
    );
  });

  describe('Constructor', () => {
    it('should create publisher with config', () => {
      expect(publisher).toBeDefined();
      expect(publisher.isRunning).toBe(false);
    });

    it('should create publisher with custom batch size', () => {
      const customPublisher = new IngestPublisher(
        { dbUrl: 'postgresql://localhost:5432/test', batchSize: 100 },
        mockDependencies
      );
      expect(customPublisher).toBeDefined();
    });
  });

  describe('initOrm', () => {
    it('should initialize ORM with correct configuration', async () => {
      // Mock MikroORM.init to avoid actual initialization
      const originalMikroORM = await import('@mikro-orm/core');
      const mockInit = vi.fn().mockResolvedValue({
        em: {
          getConnection: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
        },
      });
      
      vi.spyOn(originalMikroORM.MikroORM, 'init').mockImplementation(mockInit);

      await publisher.initOrm();

      expect(mockDependencies.findRootSync).toHaveBeenCalledWith(process.cwd());
      expect(mockDependencies.resolve).toHaveBeenCalledWith('/mock/root', 'packages/storage-postgres/src/entities');
      expect(mockInit).toHaveBeenCalledWith({
        driver: expect.anything(),
        clientUrl: 'postgresql://localhost:5432/test',
        entities: ['/mock/root/packages/storage-postgres/src/entities'],
        entitiesTs: ['/mock/root/packages/storage-postgres/src/entities'],
        allowGlobalContext: true,
      });
    });
  });

  describe('start', () => {
    it('should initialize ORM if not already initialized', async () => {
      const mockOnPublish = vi.fn().mockResolvedValue(undefined);
      
      // Mock the ORM and components
      const mockOrm = {
        em: {
          getConnection: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
        },
      };
      publisher['orm'] = mockOrm as any;
      publisher['eventFetcher'] = {
        fetchUnpublishedEvents: vi.fn().mockResolvedValue([]),
      } as any;
      publisher['eventProcessor'] = {
        processEvent: vi.fn().mockResolvedValue(undefined),
      } as any;
      publisher['publisherLoop'] = {
        runLoop: vi.fn().mockResolvedValue(undefined),
      } as any;

      const startPromise = publisher.start(mockOnPublish);
      publisher.stop();
      await startPromise;

      expect(publisher.publisherLoopInstance.runLoop).toHaveBeenCalledWith(
        mockOnPublish,
        expect.any(Function)
      );
    });
  });

  describe('stop', () => {
    it('should set running to false', () => {
      publisher.stop();
      expect(publisher.isRunning).toBe(false);
    });

    it('should be idempotent', () => {
      publisher.stop();
      publisher.stop();
      publisher.stop();
      expect(publisher.isRunning).toBe(false);
    });
  });
});

describe('createIngestPublisher', () => {
  it('should create publisher with factory function', () => {
    const publisher = createIngestPublisher('postgresql://localhost:5432/test');
    expect(publisher).toBeDefined();
  });

  it('should create publisher with custom dependencies', () => {
    const customDependencies = {
      logger: {
        error: vi.fn(),
      },
    };
    const publisher = createIngestPublisher('postgresql://localhost:5432/test', customDependencies);
    expect(publisher).toBeDefined();
  });
});

describe('Integration Tests', () => {
  it('should handle complete publish cycle', async () => {
    const mockConnection = {
      execute: vi.fn()
        .mockResolvedValueOnce([{ event_id: 'event1' }]) // SELECT
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce([]), // Empty SELECT
    };

    const mockDependencies = {
      findRootSync: vi.fn().mockReturnValue({ rootDir: '/mock/root' }),
      resolve: vi.fn().mockImplementation((...args) => args.join('/')),
      delay: vi.fn().mockResolvedValue(undefined),
      logger: {
        error: vi.fn(),
      },
    };

    const publisher = new IngestPublisher(
      { dbUrl: 'postgresql://localhost:5432/test' },
      mockDependencies
    );

    // Mock the ORM initialization
    const mockOrm = {
      em: {
        getConnection: vi.fn().mockReturnValue(mockConnection),
      },
    };
    publisher['orm'] = mockOrm as any;
    
    // Initialize the components
    publisher['eventFetcher'] = new EventFetcher(mockConnection, 500);
    publisher['eventProcessor'] = new EventProcessor(mockConnection, mockDependencies.logger);
    publisher['publisherLoop'] = new PublisherLoop(
      publisher['eventFetcher'],
      publisher['eventProcessor'],
      mockDependencies.delay
    );

    const mockOnPublish = vi.fn().mockResolvedValue(undefined);
    
    const startPromise = publisher.start(mockOnPublish);
    publisher.stop();
    await startPromise;

    expect(mockOnPublish).toHaveBeenCalledWith('event1');
    expect(mockConnection.execute).toHaveBeenCalledWith(
      `UPDATE infra.ingest_outbox SET published_at = now() WHERE event_id = $1`,
      ['event1']
    );
  });
});
