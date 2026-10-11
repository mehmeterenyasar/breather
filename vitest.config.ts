import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import { fileURLToPath } from 'node:url';

/**
 * `src/core` is pure functions, so the suite runs in the cheap `node`
 * environment. The tests that need browser APIs set up fake-indexeddb and
 * fakeBrowser themselves.
 */
export default defineConfig({
  // Points `wxt/browser` at fakeBrowser and makes the WXT aliases work.
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // A fixed timezone, or the local day arithmetic is not deterministic.
    // Berlin, specifically, so the DST tests have transitions to run against.
    env: { TZ: 'Europe/Berlin' },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/storage/schema.ts'],
    },
  },
});
