---
kind: configuration_system
name: Environment-Based Configuration via .env and process.env
category: configuration_system
scope:
    - '**'
source_files:
    - .env.example
    - apps/backend/src/main.ts
    - apps/backend/src/modules/auth/auth.service.ts
    - apps/backend/src/common/guards/auth.guard.ts
    - apps/mobile-driver/src/api/client.ts
    - apps/mobile-passenger/src/api/client.ts
    - packages/shared-config/package.json
---

The KansRide monorepo uses a straightforward environment-variable-driven configuration system with no dedicated config-loading library or centralized ConfigService. The approach is:

- **Single source of truth**: `.env.example` at the repository root documents every required variable (NODE_ENV, APP_PORT, DATABASE_*, REDIS_*, JWT_* secrets, SMS_PROVIDER, MAPS_PROVIDER, LOG_LEVEL). Each app copies this into its own `.env` during setup.
- **Direct `process.env` reads**: Every consumer accesses values inline — e.g. `apps/backend/src/main.ts` reads `process.env.PORT`, `auth.service.ts` and `auth.guard.ts` read `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, mobile apps read `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL`. There is no wrapper, validation layer, or typed config object.
- **No runtime loader**: `dotenv` appears in `package-lock.json` but is not imported anywhere in the source; Node.js loads `.env` automatically only when started by tools that support it (e.g. Nest CLI `nest start --watch`). Production deployments must supply env vars through the host platform.
- **Shared package declared but empty**: `packages/shared-config` (`@kansride/config`) is listed as a dependency of backend, admin-web, and both mobile apps and depends on `zod` + `@kansride/types`, but the `src/` directory does not exist in the checked-out tree, so the package contributes no runtime code today.
- **Frontend vs. backend split**: Backend consumes server-only secrets directly from `process.env`. Frontend/mobile apps use Expo’s `EXPO_PUBLIC_*` prefix convention to bake variables into the bundle at build time.

**Conventions developers should follow**
1. Add new variables to `.env.example` and document them in README.md.
2. Read values directly from `process.env` (or `process.env.EXPO_PUBLIC_*` for Expo apps); do not introduce a separate config module until one is implemented in `packages/shared-config`.
3. Never commit `.env` files — they are gitignored (`.env`, `.env.local`, `.env.*.local`).
4. Provide sensible defaults inline (as seen with `|| 'dev-access-secret'`) for local development while enforcing production values via the deployment environment.