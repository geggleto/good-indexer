import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/packages/*/node_modules/**',
      '**/examples/*/node_modules/**',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/**/src/**/*.ts', 'examples/**/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/migrations/**',
        '**/src/index.ts',
        '**/src/**/index.ts',
        '**/container.ts',
        '**/example.ts',
      ],
    },
  },
});

