import { defineConfig } from 'vitest/config';

// Hidden tests live in tasks/<id>/hidden-tests/ and are run by harness/score.ts,
// which sets CONTRACT_MODULE to the freshly compiled contract.
export default defineConfig({
  test: {
    include: ['tasks/*/hidden-tests/**/*.test.ts'],
    testTimeout: 60_000,
    pool: 'forks',
  },
});
