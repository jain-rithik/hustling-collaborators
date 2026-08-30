import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The API integration suites share one Postgres database and each truncates it in
    // beforeAll, so test FILES must not run concurrently.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      // Barrel re-exports carry no logic.
      exclude: ['src/domain/index.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 95,
      },
    },
  },
});
