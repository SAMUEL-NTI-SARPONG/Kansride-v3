import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Root Vitest configuration for the KansRide monorepo.
//
// Phase 0B intentionally uses Vitest (TypeScript-native via esbuild, no
// Babel/ts-jest pipeline, small install footprint) rather than Jest. This
// matches the Node 22+/24 toolchain already used by the repo and keeps the
// test layer minimal: a single root config + per-workspace test directories
// under `<workspace>/test/`.
//
// The `@kansride/*` package aliases point at package *source*
// (`src/index.ts`) — NOT at `dist/index.js`. Dist build ordering is therefore
// NOT required to run the invariant tests, which is deliberate so tests gate
// every change even when `packages/*/dist` has not yet been rebuilt (see
// `fix(shared): prevent stale shared-package outputs`). The aliases mirror
// `tsconfig.base.json` `paths` and must be kept in sync if package layout
// changes. A `vite-tsconfig-paths` plugin was avoided for an ESM-only-loadable
// dependency clash with the CommonJS-shaped root config.
//
// Mobile Expo workspaces are intentionally excluded from the include glob only
// because no Phase 0B tests live there; the glob is generic so future mobile
// tests are picked up automatically once added.

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
    include: [
      'packages/*/test/**/*.test.ts',
      'apps/*/test/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.qoder/**',
      'apps/backend/test/integration/**',
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});