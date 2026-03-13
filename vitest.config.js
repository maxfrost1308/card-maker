import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Overall minimum: 60% lines
      // Pure logic modules (template-renderer, csv-parser, qr-code): 80%
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        // Per-file thresholds for core logic modules
        'js/template-renderer.js': { lines: 80, functions: 80 },
        'js/csv-parser.js': { lines: 80, functions: 80 },
        'js/qr-code.js': { lines: 80 },
      },
    },
  },
});
