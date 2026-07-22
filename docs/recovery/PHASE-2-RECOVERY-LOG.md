# KansRide Phase 2 Recovery Log

This log tracks each recovery task performed after the Phase 2 audit
(`docs/recovery/PHASE-2-AUDIT.md`) was approved.

---

## Task 0a — Generate and validate the missing Drizzle migrations

**Date:** 2026-07-18
**Branch:** `recovery/phase-2-opencode`
**Status:** Partially complete — migrations generated and validated by SQL inspection; live DB run blocked by local PostgreSQL credentials.

### Original blocker

The audit (§5, §6, §12) identified that `packages/shared-db/src/migrations/`
did not exist. `drizzle-kit generate` had never been run/committed, so
`npm run db:migrate` (`tsx src/migrate.ts`) would fail looking for
`./src/migrations`, and the backend could not be started against a real
PostgreSQL database. This was the root runtime blocker for verifying
Phase 2 tasks A1, B1-B4, and C1, and for any frontend integration work.

### Pre-flight verification

- Confirmed branch `recovery/phase-2-opencode`.
- Confirmed working tree clean except expected untracked files
  (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`,
  `docs/recovery/`).
- Read `packages/shared-db/drizzle.config.ts` (outputs to `./src/migrations`),
  `packages/shared-db/src/migrate.ts` (reads from `./src/migrations`) — paths
  align, no competing migration system.
- Read all 9 schema files (`users`, `vehicles`, `drivers`, `passengers`,
  `rides`, `payments`, `subscriptions`, `audit-logs`, `otp-requests`) and
  `db.ts` to catalog expected tables, enums, FKs, and indexes before
  generation.

### Files created

- `packages/shared-db/src/migrations/0000_unusual_morlun.sql` — initial
  migration SQL (210 lines after PostGIS addition).
- `packages/shared-db/src/migrations/meta/0000_snapshot.json` — Drizzle
  schema snapshot (31360 bytes).
- `packages/shared-db/src/migrations/meta/_journal.json` — migration
  journal (1 entry, `0000_unusual_morlun`).

### Files changed

- `packages/shared-db/package.json` — `drizzle-kit` devDependency
  `^0.28.0` → `^0.26.2` (compatibility fix; see "Dependency fix" below).
- `package-lock.json` — resolved `drizzle-kit` 0.28.1 → 0.26.2; also
  picked up a benign lock-sync for `@react-native-async-storage/async-storage`
  (already declared in `apps/mobile-driver/package.json` but missing from
  the committed lock).
- `packages/shared-db/src/migrations/0000_unusual_morlun.sql` — manually
  prepended `CREATE EXTENSION IF NOT EXISTS postgis;` (A1 spec requirement;
  drizzle-kit cannot auto-generate this because the schema uses `numeric`
  for coordinates rather than PostGIS types).

### Dependency fix (required to unblock generation)

`drizzle-kit@0.28.1` (installed per `^0.28.0`) requires
`drizzle-orm` `compatibilityVersion === 10`, but the installed
`drizzle-orm@0.35.3` (the maximum of the pinned `^0.35.0` range) reports
`compatibilityVersion: 9`. Generation aborted with
"This version of drizzle-kit requires newer version of drizzle-orm".

Per user direction, the conservative fix was applied: downgrade the
**dev-only** `drizzle-kit` to `^0.26.2` (the newest version that sets
`requiredApiVersion = 9`, matching drizzle-orm 0.35.x). The runtime
`drizzle-orm` dependency was left untouched at `^0.35.0` so the backend
runtime is unaffected. Note: `^0.26.2` resolves only to 0.26.x because
for 0.x packages the `^` operator does not cross the minor boundary.

### Commands run and exact results

1. `npx tsc --noEmit -p packages\shared-db\tsconfig.json` (pre-generate)
   → **PASS** (no output, exit 0).
2. `npx drizzle-kit --version` → `drizzle-kit: v0.28.1`, `drizzle-orm: v0.35.3`.
3. `node -e "const v=require('drizzle-orm/version'); ..."`
   → `compatibilityVersion: 9`, `npmVersion: 0.35.3` (confirmed root cause).
4. `npm run db:generate --workspace @kansride/db` (drizzle-kit 0.28.1)
   → **FAIL** — "This version of drizzle-kit requires newer version of
   drizzle-orm".
5. Edited `packages/shared-db/package.json` (`drizzle-kit: ^0.26.2`),
   removed stale lock entry, `npm install`
   → `drizzle-kit@0.26.2` installed at root.
6. `npm run db:generate --workspace @kansride/db` (drizzle-kit 0.26.2)
   → **PASS**. Output:
   ```
   9 tables
   audit_logs 9 columns 0 indexes 1 fks
   drivers 13 columns 1 indexes 2 fks
   users 11 columns 0 indexes 0 fks
   vehicles 11 columns 0 indexes 1 fks
   passengers 7 columns 0 indexes 1 fks
   rides 23 columns 3 indexes 2 fks
   payments 11 columns 0 indexes 2 fks
   driver_subscriptions 8 columns 1 indexes 1 fks
   otp_requests 8 columns 1 indexes 0 fks
   [✓] Your SQL migration file ➜ src\migrations\0000_unusual_morlun.sql 🚀
   ```
7. Manually prepended `CREATE EXTENSION IF NOT EXISTS postgis;` to the
   generated SQL (A1 spec requirement).
8. `npx tsc --noEmit -p packages\shared-db\tsconfig.json` (post-generate)
   → **PASS** (exit 0).
9. `npm run db:migrate --workspace @kansride/db` against
   `postgresql://postgres:postgres@localhost:5432/kansride`
   → **FAIL** — `error: password authentication failed for user "postgres"`
   (PostgreSQL SQLSTATE 28P01, FATAL, `auth.c:342`, server PostgreSQL 13.22).
   This is the known local-credential blocker; the DB is reachable (port
   5432 open) but the default password from `.env.example` does not match.
10. Secret scan of generated files
    (`Select-String -Pattern "password|secret|api_key|token|JWT_|PRIVATE_KEY"`)
    → no matches. Snapshot and journal JSON validated as parseable.

### Migration validation outcome

The generated SQL (`0000_unusual_morlun.sql`) was inspected line-by-line
against the A1 spec checklist:

| Requirement | Present | Notes |
|---|---|---|
| `CREATE EXTENSION IF NOT EXISTS postgis;` | ✓ | Added manually (line 1); drizzle-kit cannot emit it because schema uses `numeric` for coords. |
| 10 enums (user_role, user_status, vehicle_type, vehicle_status, ride_status, ride_type, payment_method, payment_status, payment_type, subscription_status) | ✓ | Lines 1-10 (after PostGIS). |
| 9 tables (users, vehicles, drivers, passengers, rides, payments, driver_subscriptions, audit_logs, otp_requests) | ✓ | All `CREATE TABLE IF NOT EXISTS`, UUID PKs `DEFAULT gen_random_uuid()`, correct columns/defaults. |
| All FKs (vehicles→users, drivers→users cascade, drivers→vehicles, passengers→users cascade, rides→passengers, rides→drivers, payments→rides, payments→users, driver_subscriptions→drivers cascade, audit_logs→users) | ✓ | 10 FKs, wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` blocks. |
| 6 indexes (idx_drivers_online_location, idx_rides_status_created, idx_rides_passenger, idx_rides_driver, idx_subs_driver_expiry, idx_otp_phone_expiry) | ✓ | All `CREATE INDEX IF NOT EXISTS`, btree. |
| Unique constraints (phone_number, license_number, registration_number, drivers.user_id, passengers.user_id) | ✓ | |
| Monetary amounts as integer pesewas | ✓ | `estimated_fare_pesewas`, `actual_fare_pesewas`, `amount_pesewas` all `integer`. |

**SQL inspection verdict: complete and correct.** The migration location
(`./src/migrations`) matches the path used by `migrate.ts` and
`drizzle.config.ts`. No competing migration system was introduced.

**Live DB run: NOT performed.** Blocked by local PostgreSQL credentials
(see "Unresolved issues").

### Unresolved issues

1. **PostgreSQL credentials** — Local PostgreSQL 13.22 is running on
   `localhost:5432` but rejects the default `postgres:postgres` credentials
   from `.env.example` with `password authentication failed for user
   "postgres"` (SQLSTATE 28P01). The migration could not be applied to a
   live database. The user chose "Generate only, skip DB run". To run the
   migration, either (a) set the correct password for the `postgres` user,
   (b) create a `kansride` database + dedicated role with known credentials
   and supply them via `DATABASE_URL`, or (c) provide a working
   `DATABASE_URL` env var. This must be resolved before Task 0a can be
   considered fully verified and before any runtime recovery task can begin.

2. **PostGIS availability** — The migration now requests
   `CREATE EXTENSION IF NOT EXISTS postgis;`. When the migration is run,
   the PostgreSQL instance must have PostGIS installed, and the connecting
   role must have `CREATE` privilege on the database (or PostGIS must
   already be installed). The audit noted the CI spec uses
   `postgis/postgis:16-3.4`; the local server is PostgreSQL 13.22, so
   PostGIS for PG13 is required. Whether PostGIS is installed locally is
   unknown (could not connect to check).

3. **drizzle-kit version** — `drizzle-kit` is now pinned to `^0.26.2`
   (down from `^0.28.0`). This is a dev-only tool; runtime `drizzle-orm`
   is unchanged at `^0.35.0`. Future schema changes will use 0.26.2's
   `drizzle-kit generate`. If the project later upgrades `drizzle-orm`
   to ≥0.36.0 (compatibilityVersion 10), `drizzle-kit` should be
   re-upgraded to 0.27+ in lockstep.

4. **PostgreSQL version mismatch** — Local server is 13.22; CI spec
   targets PG16. Not a blocker for migrations (the SQL is
   PG13-compatible), but worth noting for parity.

### Git commit

One commit created on `recovery/phase-2-opencode`:
- Message: `fix(db): generate initial Drizzle migrations`
- Hash: recorded at commit time (see `git log -1`).

### Recommended next task

**Task 0b — Align JWT environment variable names.**

The audit (§10, §11) found that the backend reads
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (in `auth.service.ts`,
`auth.guard.ts`, `events.gateway.ts`) but `.env.example` and
`packages/shared-config/src/env.ts` define `JWT_SECRET` /
`JWT_REFRESH_SECRET`. In development the backend silently falls back to
hardcoded `'dev-access-secret'` / `'dev-refresh-secret'`, allowing
anyone to forge JWTs. This must be resolved (pick one convention and
apply it consistently + add fail-fast) before any auth-dependent
recovery work (Step 1 onward).

Note: resolving the PostgreSQL credentials (Unresolved issue #1 above)
is a prerequisite for *runtime verification* of Task 0a and for all
subsequent runtime tasks, but it is an environment-setup task for the
user, not a code-recovery task. The recommended next **code** recovery
task is 0b.

---

*End of Task 0a entry.*

## Task 0b — Align JWT environment variable names

**Date:** 2026-07-20  
**Branch:** recovery/phase-2-opencode  
**Status:** Complete

### Original issue

The Phase 2 audit found that the backend reads `JWT_ACCESS_SECRET` and
`JWT_REFRESH_SECRET`, while `.env.example` and
`packages/shared-config/src/env.ts` defined `JWT_SECRET` and
`JWT_REFRESH_SECRET`.

The production validation in `packages/shared-config/src/env.ts` checked
`JWT_SECRET`, although the backend does not read that variable. This could
allow an incorrectly configured production deployment to pass validation while
the backend falls back to the insecure development access-token secret.
### Changes made

All active configuration was standardized on:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

The following files were updated:

| File | Change |
|---|---|
| `.env.example` | Renamed the access-token variable to `JWT_ACCESS_SECRET` |
| `packages/shared-config/src/env.ts` | Updated the schema, production-required variables, and insecure-default validation |
| `README.md` | Updated the JWT environment-variable table |
| `docs/SETUP-WINDOWS.md` | Updated the Windows environment configuration example |
| `docs/recovery/PHASE-2-RECOVERY-LOG.md` | Recorded completion of Task 0b |

The backend JWT implementation was not changed because it already uses
`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

### Validation

The following commands completed successfully:

- `npx tsc --noEmit -p packages/shared-config/tsconfig.json`
- `npx tsc --noEmit -p apps/backend/tsconfig.json`
- `npm run build --workspace @kansride/backend`

A repository search confirmed that active configuration files no longer use
the obsolete `JWT_SECRET` environment variable. Historical mentions remain in
the Phase 2 audit and recovery documentation because they describe the original
problem.

### Git commit

Planned commit message:

`fix(config): align JWT environment variables`

---

*End of Task 0b entry.*
