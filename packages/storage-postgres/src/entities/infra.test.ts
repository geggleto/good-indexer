import { describe, it, expect } from 'vitest';
import { InfraCursorEntity, InfraIngestEventEntity, InfraIngestOutboxEntity, InfraInboxEntity } from './infra.js';

describe('InfraCursorEntity', () => {
  it('should create a cursor entity with required properties', () => {
    const cursor = new InfraCursorEntity();
    cursor.id = 'test-cursor';
    cursor.last_processed_block = '12345';

    expect(cursor.id).toBe('test-cursor');
    expect(cursor.last_processed_block).toBe('12345');
  });

  it('should handle string block numbers', () => {
    const cursor = new InfraCursorEntity();
    cursor.id = 'cursor-1';
    cursor.last_processed_block = '999999999999999999';

    expect(cursor.last_processed_block).toBe('999999999999999999');
  });
});

describe('InfraIngestEventEntity', () => {
  it('should create an ingest event entity with all properties', () => {
    const event = new InfraIngestEventEntity();
    event.event_id = 'event-123';
    event.block_number = '12345';
    event.block_hash = '0xabc123';
    event.address = '0x1234567890abcdef';
    event.topic0 = '0xdef456';
    event.partition_key = 'partition-1';
    event.payload = { data: 'test' };

    expect(event.event_id).toBe('event-123');
    expect(event.block_number).toBe('12345');
    expect(event.block_hash).toBe('0xabc123');
    expect(event.address).toBe('0x1234567890abcdef');
    expect(event.topic0).toBe('0xdef456');
    expect(event.partition_key).toBe('partition-1');
    expect(event.payload).toEqual({ data: 'test' });
  });

  it('should handle complex payload objects', () => {
    const event = new InfraIngestEventEntity();
    event.event_id = 'event-456';
    event.block_number = '67890';
    event.block_hash = '0xdef456';
    event.address = '0xabcdef1234567890';
    event.topic0 = '0x123abc';
    event.partition_key = 'partition-2';
    event.payload = {
      complex: {
        nested: {
          data: [1, 2, 3],
          flag: true,
        },
      },
    };

    expect(event.payload).toEqual({
      complex: {
        nested: {
          data: [1, 2, 3],
          flag: true,
        },
      },
    });
  });
});

describe('InfraIngestOutboxEntity', () => {
  it('should create an outbox entity with event_id', () => {
    const outbox = new InfraIngestOutboxEntity();
    outbox.event_id = 'event-789';

    expect(outbox.event_id).toBe('event-789');
    expect(outbox.published_at).toBeUndefined();
  });

  it('should handle published_at timestamp', () => {
    const outbox = new InfraIngestOutboxEntity();
    outbox.event_id = 'event-789';
    outbox.published_at = new Date('2023-01-01T00:00:00Z');

    expect(outbox.published_at).toEqual(new Date('2023-01-01T00:00:00Z'));
  });

  it('should handle null published_at', () => {
    const outbox = new InfraIngestOutboxEntity();
    outbox.event_id = 'event-789';
    outbox.published_at = null;

    expect(outbox.published_at).toBeNull();
  });
});

describe('InfraInboxEntity', () => {
  it('should create an inbox entity with all properties', () => {
    const inbox = new InfraInboxEntity();
    inbox.event_id = 'event-123';
    inbox.handler_kind = 'test-handler';
    inbox.status = 'PENDING';
    inbox.attempts = 0;
    inbox.block_number = '12345';
    inbox.partition_key = 'partition-1';

    expect(inbox.event_id).toBe('event-123');
    expect(inbox.handler_kind).toBe('test-handler');
    expect(inbox.status).toBe('PENDING');
    expect(inbox.attempts).toBe(0);
    expect(inbox.block_number).toBe('12345');
    expect(inbox.partition_key).toBe('partition-1');
  });

  it('should handle error states', () => {
    const inbox = new InfraInboxEntity();
    inbox.event_id = 'event-456';
    inbox.handler_kind = 'test-handler';
    inbox.status = 'FAIL';
    inbox.attempts = 3;
    inbox.last_error = 'Test error message';
    inbox.block_number = '67890';
    inbox.partition_key = 'partition-2';

    expect(inbox.status).toBe('FAIL');
    expect(inbox.attempts).toBe(3);
    expect(inbox.last_error).toBe('Test error message');
  });

  it('should handle DLQ status', () => {
    const inbox = new InfraInboxEntity();
    inbox.event_id = 'event-789';
    inbox.handler_kind = 'test-handler';
    inbox.status = 'DLQ';
    inbox.attempts = 5;
    inbox.last_error = 'Max attempts exceeded';
    inbox.block_number = '11111';
    inbox.partition_key = 'partition-3';

    expect(inbox.status).toBe('DLQ');
    expect(inbox.attempts).toBe(5);
    expect(inbox.last_error).toBe('Max attempts exceeded');
  });

  it('should handle ACK status', () => {
    const inbox = new InfraInboxEntity();
    inbox.event_id = 'event-ack';
    inbox.handler_kind = 'test-handler';
    inbox.status = 'ACK';
    inbox.attempts = 1;
    inbox.last_error = null;
    inbox.block_number = '22222';
    inbox.partition_key = 'partition-4';

    expect(inbox.status).toBe('ACK');
    expect(inbox.attempts).toBe(1);
    expect(inbox.last_error).toBeNull();
  });
});
