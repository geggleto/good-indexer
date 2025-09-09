import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      '**/dist/**',
      '**/build/**',
    ],
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/migrations/**', '**/src/index.ts'],
    },
  },
});

