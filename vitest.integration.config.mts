import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@kansride/types': resolve(__dirname, 'packages/shared-types/src/index.ts'),
      '@kansride/config': resolve(__dirname, 'packages/shared-config/src/index.ts'),
      '@kansride/db': resolve(__dirname, 'packages/shared-db/src/index.ts'),
      '@kansride/auth': resolve(__dirname, 'packages/shared-auth/src/index.ts'),
      '@kansride/ui': resolve(__dirname, 'packages/design-system/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['apps/backend/test/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
