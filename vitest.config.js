import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'src/**/__tests__/**/*.test.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.js'],
      exclude: ['src/**/__tests__/**'],
    },
  },
});

