---
kind: error_handling
name: NestJS Exception Filter and Guard-Based Error Handling
category: error_handling
scope:
    - '**'
source_files:
    - apps/backend/src/common/filters/http-exception.filter.ts
    - apps/backend/src/common/guards/auth.guard.ts
    - apps/backend/src/common/guards/roles.guard.ts
    - apps/backend/src/modules/auth/auth.service.ts
    - apps/backend/src/modules/rides/rides.service.ts
    - apps/backend/src/main.ts
    - apps/mobile-driver/src/api/client.ts
    - apps/mobile-passenger/src/api/client.ts
    - packages/shared-config/src/env.ts
---

The KansRide monorepo uses a NestJS-based backend with a centralized exception filter and guard-driven error propagation pattern. Errors are raised as built-in `HttpException` subclasses (`UnauthorizedException`, `ForbiddenException`, `BadRequestException`) from guards and services, then normalized by a single global `AllExceptionsFilter` into a consistent JSON envelope.

**System overview**
- Global HTTP exception filter: `apps/backend/src/common/filters/http-exception.filter.ts` — catches every unhandled exception, maps `HttpException` instances to their HTTP status (defaulting to `500 Internal Server Error`), logs via Nest's `Logger`, and returns `{ success: false, statusCode, message, timestamp }`.
- Guards throw domain-specific exceptions early:
  - `AuthGuard` throws `UnauthorizedException` for missing/invalid/expired JWT tokens.
  - `RolesGuard` throws `ForbiddenException` when the user lacks required permissions.
- Services throw `BadRequestException` for input validation failures (e.g., rating range in `rides.service.ts`).
- ValidationPipe is registered globally in `main.ts` with `whitelist: true` and `transform: true`, so invalid DTOs are rejected before reaching controllers.
- Mobile apps (`mobile-driver`, `mobile-passenger`) wrap `fetch` in a thin `apiClient` that converts non-`2xx` responses into a plain `Error` carrying either the server message or `HTTP <status>`.
- Shared config package (`packages/shared-config/src/env.ts`) validates environment variables at startup using Zod and fails fast by throwing descriptive `Error`s for missing/unsafe production secrets.

**Architecture and conventions**
- No custom error class hierarchy exists; the codebase relies on Nest's built-in `HttpException` subclasses rather than sentinel errors or typed error unions.
- There is no `try/catch` around service calls — errors bubble up to the global filter, keeping controller/service code free of boilerplate.
- The filter does not include a stack trace in the response body (only in logs), which avoids leaking internals to clients.
- Frontend/mobile error handling is minimal: callers catch `Error` and surface messages to users; there is no shared error-response type contract between client and server beyond the filter's shape.
- No `panic`/`recover` equivalent is used (this is TypeScript/Node.js); process crashes are left to the runtime.

**Rules developers should follow**
1. Throw Nest `HttpException` subclasses (`UnauthorizedException`, `ForbiddenException`, `BadRequestException`, etc.) instead of raw `throw new Error(...)` from controllers/services/guards.
2. Do not swallow exceptions with empty `catch {}`; let them propagate to the global filter.
3. Use the global `ValidationPipe` for DTO validation — avoid manual field checks where possible.
4. In mobile apps, rely on the `apiClient` helper to normalize network errors; do not call `fetch` directly in business logic.
5. Add environment checks through `getEnv()` in `shared-config` rather than ad-hoc `process.env` reads with bare `throw`s.