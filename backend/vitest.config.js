import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.js'],
    hookTimeout: 600000,
    testTimeout: 30000,
    fileParallelism: false,
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
  },
});
