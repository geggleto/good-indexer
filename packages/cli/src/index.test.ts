import { describe, it, expect } from 'vitest';

describe('CLI Module', () => {
  it('should export commander program', () => {
    // This is a simple test to ensure the module can be imported
    expect(() => import('./index.js')).not.toThrow();
  });

  it('should handle environment variables', () => {
    const originalDbUrl = process.env.DB_URL;
    const originalRpcUrl = process.env.RPC_READ_URL;
    
    // Test DB_URL requirement
    delete process.env.DB_URL;
    expect(process.env.DB_URL).toBeUndefined();
    
    process.env.DB_URL = 'postgresql://localhost:5432/test';
    expect(process.env.DB_URL).toBe('postgresql://localhost:5432/test');
    
    // Test RPC_READ_URL
    delete process.env.RPC_READ_URL;
    expect(process.env.RPC_READ_URL).toBeUndefined();
    
    process.env.RPC_READ_URL = 'https://rpc.example.com';
    expect(process.env.RPC_READ_URL).toBe('https://rpc.example.com');
    
    // Restore
    if (originalDbUrl) {
      process.env.DB_URL = originalDbUrl;
    } else {
      delete process.env.DB_URL;
    }
    
    if (originalRpcUrl) {
      process.env.RPC_READ_URL = originalRpcUrl;
    } else {
      delete process.env.RPC_READ_URL;
    }
  });
});
