# Local Services Validation Runbook

**Date:** 2026-07-28
**Phase:** Engineering Phase 0B — runtime validation surface
**Authority:** this runbook operationalises `docs/recovery/RECOVERY_PLAN.md`
"Operational Prerequisite: Restore Database Runtime Verification" and the
Phase 0B task instruction `create and execute safe PostgreSQL/Redis
validation steps where credentials and services permit; where blocked,
create an exact runbook with required environment variables, commands to
run, expected successful output, likely failure messages, and corrective
steps`.
**Scope:** executable repeatable steps to bring up + validate local
PostgreSQL (with PostGIS) and Redis so Phase 0B and later phases can
runtime-test migrations, rides, dispatch, tracking, and the backend
smoke. No secrets or full environment-file contents are recorded; an
`.env.example` already lives at the repository root.

## 1. Current machine state (as of 2026-07-28)

The following was confirmed interactively during Phase 0B:

| Check | Method | Result |
| --- | --- | --- |
| Port 5432 accepts TCP | `Test-NetConnection localhost -Port 5432 -InformationLevel Quiet` | True |
| Port 6379 accepts TCP | `Test-NetConnection localhost -Port 6379 -InformationLevel Quiet` | False |
| `psql` / `redis-cli` installed | `Get-Command psql`, `Get-Command redis-cli` | Not installed |
| Postgres reachable with `.env.example` creds | `node tools/probe-postgres.cjs "postgresql://postgres:change-me@localhost:5432/kansride"` (uses the hoisted `pg` package) | Failed with `28P01 password authentication failed for user "postgres"` |
| Postgres reachable with `postgres:postgres` | same probe | Failed with `28P01 password authentication failed for user "postgres"` |
| Postgres reachable with empty password | same probe | Failed (SASL: client password must be a string) |

This reconfirms **Blocker B1** from `docs/recovery/PROJECT_STATE.md`:
the listener that owns `:5432` is a real PostgreSQL server (it returns
the canonical `28P01` password-auth error, not just `ECONNREFUSED`), but
the credentials used by `.env.example` / the recovery branch are no
longer valid against the currently running instance. The recovery log
also notes that PostgreSQL 13 owns `:5432` while the documented
PostgreSQL 16 service is stopped on this machine; PostgreSQL 16 is
required because the checked-in migrations use the `postgis` extension
ship with PG16 / PostGIS 3.4 (the CI images use
`postgis/postgis:16-3.4`; see `.github/workflows/ci.yml`). Redis has no
listener at all.

The Phase 0B CI workflow that ships with this runbook (**commit
`ci: validate lint types tests builds and services`**) does run
migrations + the backend `/api/v1/health` smoke against a provisioned
`postgis/postgis:16-3.4` + `redis:7-alpine` pair, so the repository is
runtime-validated in CI on every push even while the developer's local
PostgreSQL remains blocked.

## 2. Required environment variables

These are read by `packages/shared-config/src/env.ts` (Zod) and
`packages/shared-db/src/database-env.ts`. Production additionally rejects
default JWT secrets — the runbook uses `NODE_ENV=development` so the
defaults are accepted for a local validation session.

| Variable | Required value / shape | Where it is read |
| --- | --- | --- |
| `NODE_ENV` | `development` (or `test`) | `getEnv()`, `RedisModule` selection |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:PORT/DB` | `getDatabaseUrl()`, `DatabaseModule` |
| `REDIS_URL` | `redis://HOST:PORT` (omit entirely to use the in-memory `MemoryRedisService`) | `RedisModule` |
| `JWT_ACCESS_SECRET` | any non-empty string for development | `JWTService`, `AuthGuard`, `EventsGateway` |
| `JWT_REFRESH_SECRET` | any non-empty string for development | `JWTService` |
| `APP_PORT` | defaults to 3000 | `getEnv()`, `main.ts` |
| `SMS_PROVIDER` | optional; defaults to `mock` | `ProvidersModule` |
| `MAPS_PROVIDER` | optional; defaults to `openstreetmap` (Haversine impl) | `ProvidersModule` |

The full set of recognised variables and their defaults is documented in
`packages/shared-config/src/env.ts`; see also `.env.example` at the
repository root for a copy-paste starter (with a placeholder password —
do NOT use `change-me` against a real-server instance).

## 3. Bring up the services locally

Pick ONE of the options below. Option A (Docker) is the shortest path
and matches what CI does, so it is recommended even for developers who
have a native PostgreSQL install.

### Option A — Docker (recommended, matches CI)

```powershell
# Postgres 16 + PostGIS 3.4 (matches .github/workflows/ci.yml exactly)
docker run -d --name kansride-pg `
  -e POSTGRES_USER=kansride `
  -e POSTGRES_PASSWORD=kansride `
  -e POSTGRES_DB=kansride `
  -p 5432:5432 `
  postgis/postgis:16-3.4

# Redis 7 (alpine)
docker run -d --name kansride-redis -p 6379:6379 redis:7-alpine
```

If `:5432` is already taken by a stale PostgreSQL 13 service (the box
this runbook was authored on), run the new container on a different host
port (`5433`) and put the matching port in `DATABASE_URL`:

```powershell
docker run -d --name kansride-pg `
  -e POSTGRES_USER=kansride -e POSTGRES_PASSWORD=kansride -e POSTGRES_DB=kansride `
  -p 5433:5432 postgis/postgis:16-3.4
# DATABASE_URL becomes postgresql://kansride:kansride@localhost:5433/kansride
```

The native PostgreSQL 13 listener that owns `:5432` here rejects every
credential we tried (28P01). Do not try to repoint the existing service
to a known password; bring up the matched PG16 container instead, then
clean it up after the session.

### Option B — native services

If you already run PostgreSQL 16 with the `postgis` extension installed,
ensure a `kansride` database exists and a role with a known password:

```sql
CREATE ROLE kansride LOGIN PASSWORD '<<your-local-password>>';
CREATE DATABASE kansride OWNER kansride;
\c kansride
CREATE EXTENSION IF NOT EXISTS postgis;
```

For Redis, install and start the system service (`redis-server` on Linux,
`brew services start redis` on macOS, or the Windows-native port). The
phase 0B smoke uses the standard port 6379 — keep the default unless you
override `REDIS_URL`.

### Option C — no Redis (in-memory fallback)

If only PostgreSQL is available, leave `REDIS_URL` UNSET. The backend's
`RedisModule` selects `MemoryRedisService` automatically when
`REDIS_URL` is empty. This is dev-only; do not use it in production (it
cannot survive a process restart and cannot coordinate multiple backend
instances — see `docs/recovery/ARCHITECTURE_NOTES.md` "Redis and Provider
Boundaries").

## 4. Apply migrations

From the repository root (the migration script loads the root `.env`
automatically):

```powershell
npm run db:migrate --workspace=packages/shared-db
```

### Expected successful output

```text
Running database migrations...
Migrations completed successfully.
```

### Likely failure messages and corrective steps

| Message | Likely cause | Corrective step |
| --- | --- | --- |
| `DATABASE_URL is required. Copy .env.example to the repository-root .env and set local credentials.` | No `.env` at the repository root, or `DATABASE_URL` missing from it. | Create `.env` (NOT committed — it is in `.gitignore`) at the repo root with the `DATABASE_URL` line for your local instance. The `.env.example` file is the template. |
| `error: password authentication failed for user "postgres"` (`28P01`) | Credentials in `.env.example` (`change-me`) do not match the local PG instance; OR a stale PostgreSQL 13 still owns `:5432`. | Bring up the matched PG16 container on a free port (Option A); set `DATABASE_URL` to match the container user/host/port. Do not overwrite `.env.example`. |
| `error: relation "drizzle_migrations" already exists` (`42P07`) | The migration journal was created by a previous (possibly broken) attempt on a stale database. | Drop and recreate the test database, or run on a fresh database. Do NOT run a destructive operation against a database with real data. (Phase 0 is local-only; production data lives elsewhere.) |
| `error: type "ride_status" already exists` (`42710` is a warning, but `42710` as error means a partial earlier run) | A previous migration was interrupted. | Same corrective step as above; migrations are append-only history (`docs/recovery/ARCHITECTURE_NOTES.md`) — never edit `0000_*` / `0001_*` to skip steps. |
| `error: extension "postgis" is not available` | Wrong PostgreSQL distribution or PostGIS not installed. | Use a `postgis/postgis:16-3.4` container (Option A). The native PG13 instance on this box lacks the matched PostGIS. |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres stopped / wrong port. | Restart the PG16 container; confirm `Test-NetConnection localhost -Port 5432 -InformationLevel Quiet` returns True for the right port. |

## 5. Verify PostGIS installed and migration journal

Run the included probe script (uses the hoisted `pg` npm package, no
`psql` required):

```powershell
node tools/probe-postgres.cjs "$env:DATABASE_URL"
```

### Expected successful output

```text
server_version: 16.x
postgis_installed: 1
```

If `postgis_installed` is `0`, the `postgis` extension was not created by
the migration (the probe returns 0 silently); re-run
`npm run db:migrate --workspace=packages/shared-db` and probe again.

To inspect the migration journal directly:

```powershell
node -e "const {Pool}=require('pg'); const p=new Pool({connectionString: process.env.DATABASE_URL}); p.query('SELECT hash, created_at FROM drizzle_migrations ORDER BY created_at').then(r=>{console.log(r.rows);}).finally(()=>p.end());"
```

Expected: two rows for `hash` of `0000_unusual_morlun.sql` and
`0001_ride_rating_columns.sql` (Drizzle stores the SHA-256-ish hash).

## 6. Verify Redis connectivity (when REDIS_URL is set)

There is no `redis-cli` requirement; use the Node `ioredis` package
available from `apps/backend`'s dependency tree:

```powershell
node -e "const Redis=require('ioredis'); const r=new Redis(process.env.REDIS_URL); r.set('kansride:smoke','ok').then(()=>r.get('kansride:smoke')).then(v=>{console.log('redis:'+v); r.quit();});"
```

### Expected successful output

```text
redis:ok
```

### Likely failure messages

| Message | Likely cause | Corrective step |
| --- | --- | --- |
| `Error: connect ECONNREFUSED 127.0.0.1:6379` | Redis not started. | Start `redis:7-alpine` (Option A) or your native redis daemon. |
| `MAXCLIENTS` / `NOPROTO` errors | Wrong port / wrong redis variant. | Confirm `REDIS_URL` points at the runbook's Redis port. |

If you intentionally use the in-memory fallback (Option C), skip this
step entirely.

## 7. Backend startup smoke

Build the shared packages and the backend, then boot it:

```powershell
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/shared-config
npm run build --workspace=packages/shared-db
npm run build --workspace=packages/shared-auth
npm run build --workspace=@kansride/backend
node apps/backend/dist/main.js
```

Leave `DATABASE_URL` and `REDIS_URL` set in the shell environment
(or in the `.env` file). The process stays in the foreground; in a second
shell, hit the public health endpoint:

```powershell
curl -sf http://127.0.0.1:3000/api/v1/health
```

### Expected successful output

```json
{"status":"ok","service":"kansride-api","timestamp":"2026-07-28T...Z"}
```

### Likely failure messages and corrective steps

| Message | Likely cause | Corrective step |
| --- | --- | --- |
| `Nest can't resolve dependencies of the AuthModule (...) (...)` | DatabaseModule / RedisModule could not initialise. | The most common cause is that `getEnv()` failed or the database pool could not open at least one connection during provider init. Confirm Section 4 + Section 6 pass first. |
| `[ENV] Missing required environment variables in production: ...` | `NODE_ENV=production` is set and a JWT secret still holds the default value. | Set `NODE_ENV=development` for local validation, or supply unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` in `.env` if validating the production start path. |
| `Error: connect ECONNREFUSED 127.0.0.1:6379` during `RedisModule` init | `REDIS_URL` is set but Redis is down. | Start Redis (Option A) or unset `REDIS_URL` to use the in-memory fallback. |
| Process exits with `28P01 password authentication failed for user "postgres"` | `DATABASE_URL` credentials rejected. | Reissue / reset the local role to match `DATABASE_URL`; do not modify `.env.example`. |

To stop the backend, send `Ctrl+C` in the foreground shell (the
`OnModuleDestroy` hook closes the Postgres pool). For an automated
background smoke (used in CI), see `.github/workflows/ci.yml::build-backend
Start backend and smoke /api/v1/health` — the same approach works locally
with `Start-Process` or a `&` backgrounded shell.

## 8. Smoke end-to-end sanity (optional, after Sections 4–7 pass)

These runbook steps exercise the recovery-flow surface without writing
real OTP consumers (mock SMS provider is the default). They require:
valid `DATABASE_URL`, `REDIS_URL` (or absent), and a running backend
from Section 7. Each subsequent command should be run after creating a
real passenger `users` row in the database through the OTP flow (the
mock SMS provider logs the OTP code to stdout).

```powershell
# 1. Request an OTP for a Ghana phone number.
curl -sS -X POST http://127.0.0.1:3000/api/v1/auth/request-otp `
  -H 'content-type: application/json' `
  -d '{\"phoneNumber\":\"0540000000\"}'
# Read the OTP from the backend's console log (MockSMSProvider logs INFO).

# 2. Verify the OTP, receive tokens.
curl -sS -X POST http://127.0.0.1:3000/api/v1/auth/verify-otp `
  -H 'content-type: application/json' `
  -d '{\"phoneNumber\":\"0540000000\",\"otpCode\":\"<<otp>>\"}'
```

Future Phase 0+ tasks will replace this section with an automated
runtime matrix; this runbook stops at the smoke level so credentials
controlled external-step (test users, driver approval) remain out of
scope.

## 9. Tear-down

```powershell
docker stop kansride-pg kansride-redis
docker rm kansride-pg kansride-redis
```

Do NOT remove a native PostgreSQL or Redis service that was already
running — only stop the containers you started in Section 3.

## 10. Status ledger (Phase 0B)

| Outcome | Phase 0B state on this machine | CI state (`.github/workflows/ci.yml`) |
| --- | --- | --- |
| PostgreSQL TCP listener present | Yes (`:5432`) | Service provisioned: `postgis/postgis:16-3.4` |
| PostgreSQL reachable with `.env.example` creds | No (`28P01`) | N/A — CI uses its own credentials (`postgres:postgres`) |
| Migrations apply | Blocked locally | Yes (CI `build-backend` step: `npm run db:migrate --workspace=packages/shared-db`) |
| PostGIS extension available | Blocked locally | Yes (CI migrations include `CREATE EXTENSION IF NOT EXISTS postgis`; migration success proves this) |
| Redis listener present | No (`:6379`) | Service provisioned: `redis:7-alpine` |
| Redis set/get round trip | Blocked locally | Implicit (the backend starts cleanly + RedisModule selects `RedisService`; full set/get smoke lives in the integration test layer that follows Phase 0B) |
| Backend `/api/v1/health` smoke | Blocked locally | Yes (CI `build-backend` step curls `http://127.0.0.1:3000/api/v1/health` after migration + build) |

Blocker B1 remains open. CI now meaningfully runs the same surface.