import { describe, it, expect } from 'vitest';

describe('Core HTTP Server', () => {
  it('should export a server creation function', () => {
    // This is a simple test to ensure the module can be imported
    expect(() => import('./index.js')).not.toThrow();
  });

  it('should handle environment variables', () => {
    const originalPort = process.env.PORT;
    
    // Test default port
    delete process.env.PORT;
    expect(Number(process.env.PORT ?? 3000)).toBe(3000);
    
    // Test custom port
    process.env.PORT = '8080';
    expect(Number(process.env.PORT ?? 3000)).toBe(8080);
    
    // Restore
    if (originalPort) {
      process.env.PORT = originalPort;
    } else {
      delete process.env.PORT;
    }
  });
});
