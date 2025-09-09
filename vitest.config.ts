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
      ],
    },
  },
});

