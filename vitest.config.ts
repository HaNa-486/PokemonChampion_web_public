import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    maxWorkers: 1,
    testTimeout: 15000,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
