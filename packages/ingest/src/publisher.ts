import { MikroORM } from '@mikro-orm/core';
import pg from '@mikro-orm/postgresql';
import { resolve } from 'node:path';
import { findRootSync } from '@manypkg/find-root';
import { setTimeout as delayMs } from 'timers/promises';

// Interfaces for better testability
export interface DatabaseConnection {
  execute(query: string, params?: any[]): Promise<any>;
}

export interface EventRow {
  event_id: string;
}

export interface PublisherConfig {
  dbUrl: string;
  batchSize?: number;
  delayMs?: number;
}

export interface PublisherDependencies {
  findRootSync: (cwd: string) => { rootDir: string };
  resolve: (...paths: string[]) => string;
  delay: (ms: number) => Promise<void>;
  logger: {
    error: (message: string, error?: any) => void;
  };
}

// Event processor class for handling individual events
export class EventProcessor {
  constructor(
    private connection: DatabaseConnection,
    private logger: PublisherDependencies['logger']
  ) {}

  async processEvent(eventId: string, onPublish: (eventId: string) => Promise<void>): Promise<void> {
    try {
      await onPublish(eventId);
      await this.markEventAsPublished(eventId);
    } catch (err) {
      this.logger.error('publish error', err);
      // Still try to mark as published even if onPublish fails
      try {
        await this.markEventAsPublished(eventId);
      } catch (updateErr) {
        this.logger.error('database update error', updateErr);
      }
    }
  }

  private async markEventAsPublished(eventId: string): Promise<void> {
    await this.connection.execute(
      `UPDATE infra.ingest_outbox SET published_at = now() WHERE event_id = $1`,
      [eventId]
    );
  }
}

// Event fetcher class for retrieving events from database
export class EventFetcher {
  constructor(
    private connection: DatabaseConnection,
    private batchSize: number = 500
  ) {}

  async fetchUnpublishedEvents(): Promise<EventRow[]> {
    const rows = await this.connection.execute(
      `SELECT event_id FROM infra.ingest_outbox WHERE published_at IS NULL ORDER BY event_id ASC NULLS LAST LIMIT $1`,
      [this.batchSize]
    );
    return rows as EventRow[];
  }
}

// Main publisher loop class
export class PublisherLoop {
  constructor(
    private eventFetcher: EventFetcher,
    private eventProcessor: EventProcessor,
    private delay: PublisherDependencies['delay']
  ) {}

  async runLoop(
    onPublish: (eventId: string) => Promise<void>,
    shouldContinue: () => boolean
  ): Promise<void> {
    while (shouldContinue()) {
      const events = await this.eventFetcher.fetchUnpublishedEvents();
      
      if (events.length === 0) {
        await this.delay(250);
        continue;
      }

      await this.processBatch(events, onPublish);
    }
  }

  private async processBatch(events: EventRow[], onPublish: (eventId: string) => Promise<void>): Promise<void> {
    for (const event of events) {
      await this.eventProcessor.processEvent(event.event_id, onPublish);
    }
  }
}

// Refactored IngestPublisher
export class IngestPublisher {
  private orm!: MikroORM;
  private running = false;
  private eventFetcher!: EventFetcher;
  private eventProcessor!: EventProcessor;
  private publisherLoop!: PublisherLoop;

  constructor(
    private config: PublisherConfig,
    private dependencies: PublisherDependencies = {
      findRootSync,
      resolve,
      delay: (ms: number) => delayMs(ms) as unknown as Promise<void>,
      logger: {
        error: (message: string, error?: any) => console.error(message, error),
      },
    }
  ) {}

  async initOrm(): Promise<void> {
    const monorepoRoot = this.dependencies.findRootSync(process.cwd()).rootDir;
    this.orm = await MikroORM.init({
      driver: pg.PostgreSqlDriver,
      clientUrl: this.config.dbUrl,
      entities: [this.dependencies.resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      entitiesTs: [this.dependencies.resolve(monorepoRoot, 'packages/storage-postgres/src/entities')],
      allowGlobalContext: true,
    } as any);

    // Initialize the refactored components
    const connection = this.orm.em.getConnection();
    this.eventFetcher = new EventFetcher(connection, this.config.batchSize);
    this.eventProcessor = new EventProcessor(connection, this.dependencies.logger);
    this.publisherLoop = new PublisherLoop(
      this.eventFetcher,
      this.eventProcessor,
      this.dependencies.delay
    );
  }

  async start(onPublish: (eventId: string) => Promise<void>): Promise<void> {
    if (!this.orm) await this.initOrm();
    this.running = true;
    
    await this.publisherLoop.runLoop(onPublish, () => this.running);
  }

  stop(): void {
    this.running = false;
  }

  // Getter methods for testing
  get isRunning(): boolean {
    return this.running;
  }

  get eventFetcherInstance(): EventFetcher {
    return this.eventFetcher;
  }

  get eventProcessorInstance(): EventProcessor {
    return this.eventProcessor;
  }

  get publisherLoopInstance(): PublisherLoop {
    return this.publisherLoop;
  }
}

// Factory function for easier testing
export function createIngestPublisher(
  dbUrl: string,
  dependencies?: Partial<PublisherDependencies>
): IngestPublisher {
  return new IngestPublisher(
    { dbUrl },
    {
      findRootSync,
      resolve,
      delay: (ms: number) => delayMs(ms) as unknown as Promise<void>,
      logger: {
        error: (message: string, error?: any) => console.error(message, error),
      },
      ...dependencies,
    }
  );
}
