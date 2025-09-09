import { describe, it, expect } from 'vitest';
import { DomainOutboxEntity } from './domain';

describe('DomainOutboxEntity', () => {
  it('should create a domain outbox entity with required properties', () => {
    const outbox = new DomainOutboxEntity();
    outbox.command_key = 'cmd-123';
    outbox.kind = 'TestCommand';
    outbox.payload = { data: 'test' };

    expect(outbox.command_key).toBe('cmd-123');
    expect(outbox.kind).toBe('TestCommand');
    expect(outbox.payload).toEqual({ data: 'test' });
    expect(outbox.published_at).toBeUndefined();
    expect(outbox.tx_hash).toBeUndefined();
  });

  it('should handle published state', () => {
    const outbox = new DomainOutboxEntity();
    outbox.command_key = 'cmd-456';
    outbox.kind = 'TestCommand';
    outbox.payload = { data: 'test' };
    outbox.published_at = new Date('2023-01-01T00:00:00Z');
    outbox.tx_hash = '0xabc123def456';

    expect(outbox.published_at).toEqual(new Date('2023-01-01T00:00:00Z'));
    expect(outbox.tx_hash).toBe('0xabc123def456');
  });

  it('should handle null published_at', () => {
    const outbox = new DomainOutboxEntity();
    outbox.command_key = 'cmd-789';
    outbox.kind = 'TestCommand';
    outbox.payload = { data: 'test' };
    outbox.published_at = null;
    outbox.tx_hash = null;

    expect(outbox.published_at).toBeNull();
    expect(outbox.tx_hash).toBeNull();
  });

  it('should handle complex payload objects', () => {
    const outbox = new DomainOutboxEntity();
    outbox.command_key = 'cmd-complex';
    outbox.kind = 'ComplexCommand';
    outbox.payload = {
      user: {
        id: 'user-123',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
      action: 'update',
      metadata: {
        timestamp: '2023-01-01T00:00:00Z',
        version: '1.0.0',
      },
    };

    expect(outbox.payload).toEqual({
      user: {
        id: 'user-123',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
      action: 'update',
      metadata: {
        timestamp: '2023-01-01T00:00:00Z',
        version: '1.0.0',
      },
    });
  });

  it('should handle different command kinds', () => {
    const commandKinds = [
      'CreateUser',
      'UpdateUser',
      'DeleteUser',
      'TransferFunds',
      'ProcessPayment',
    ];

    commandKinds.forEach((kind, index) => {
      const outbox = new DomainOutboxEntity();
      outbox.command_key = `cmd-${index}`;
      outbox.kind = kind;
      outbox.payload = { commandType: kind };

      expect(outbox.kind).toBe(kind);
      expect(outbox.payload).toEqual({ commandType: kind });
    });
  });
});
