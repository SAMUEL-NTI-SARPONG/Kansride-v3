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


| Requirement                                                                                                                                                                                                          | Present | Notes                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `CREATE EXTENSION IF NOT EXISTS postgis;`                                                                                                                                                                            | ✓       | Added manually (line 1); drizzle-kit cannot emit it because schema uses `numeric` for coords.     |
| 10 enums (user_role, user_status, vehicle_type, vehicle_status, ride_status, ride_type, payment_method, payment_status, payment_type, subscription_status)                                                           | ✓       | Lines 1-10 (after PostGIS).                                                                       |
| 9 tables (users, vehicles, drivers, passengers, rides, payments, driver_subscriptions, audit_logs, otp_requests)                                                                                                     | ✓       | All `CREATE TABLE IF NOT EXISTS`, UUID PKs `DEFAULT gen_random_uuid()`, correct columns/defaults. |
| All FKs (vehicles→users, drivers→users cascade, drivers→vehicles, passengers→users cascade, rides→passengers, rides→drivers, payments→rides, payments→users, driver_subscriptions→drivers cascade, audit_logs→users) | ✓       | 10 FKs, wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` blocks.                      |
| 6 indexes (idx_drivers_online_location, idx_rides_status_created, idx_rides_passenger, idx_rides_driver, idx_subs_driver_expiry, idx_otp_phone_expiry)                                                               | ✓       | All `CREATE INDEX IF NOT EXISTS`, btree.                                                          |
| Unique constraints (phone_number, license_number, registration_number, drivers.user_id, passengers.user_id)                                                                                                          | ✓       |                                                                                                   |
| Monetary amounts as integer pesewas                                                                                                                                                                                  | ✓       | `estimated_fare_pesewas`, `actual_fare_pesewas`, `amount_pesewas` all `integer`.                  |


**SQL inspection verdict: complete and correct.** The migration location
(`./src/migrations`) matches the path used by `migrate.ts` and
`drizzle.config.ts`. No competing migration system was introduced.

**Live DB run: NOT performed.** Blocked by local PostgreSQL credentials
(see "Unresolved issues").

### Unresolved issues

1. **PostgreSQL credentials** — Local PostgreSQL 13.22 is running on
  `localhost:5432` but rejects the default `postgres:postgres` credentials
   from `.env.example` with `password authentication failed for user  "postgres"` (SQLSTATE 28P01). The migration could not be applied to a
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


| File                                    | Change                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `.env.example`                          | Renamed the access-token variable to `JWT_ACCESS_SECRET`                           |
| `packages/shared-config/src/env.ts`     | Updated the schema, production-required variables, and insecure-default validation |
| `README.md`                             | Updated the JWT environment-variable table                                         |
| `docs/SETUP-WINDOWS.md`                 | Updated the Windows environment configuration example                              |
| `docs/recovery/PHASE-2-RECOVERY-LOG.md` | Recorded completion of Task 0b                                                     |


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

## Task 1a — Create passenger profile row on first successful passenger login

**Date:** 2026-07-22
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); runtime DB verification still blocked by local PostgreSQL credentials (see Task 0a, Unresolved issue #1).

### Original issue

The Phase 2 audit (§8 row 12; §13 Step 1, task 1a) found that the OTP
verification flow (`auth.service.ts` `verifyOTP`) finds-or-creates a row in
the `users` table but never creates a row in `passengers`. Because
`rides.passengerId` has a foreign key to `passengers.id` (not `users.id`),
and `passengers.userId` is a separate unique column referencing `users.id`, a
newly authenticated passenger could authenticate successfully but then fail
ride creation with a foreign-key / identity mismatch (no `passengers` row
exists).

### Pre-implementation inspection

- `apps/backend/src/modules/auth/auth.service.ts` (`verifyOTP`, lines 69-155):
find-or-creates `users` row (default role `passenger`), issues JWT
`{ userId, phoneNumber, role }`, returns `{ ...tokens, user: {...} }`.
No `passengers` row was created; no transaction was used.
- `packages/shared-db/src/schema/users.ts`, `passengers.ts`, `drivers.ts`,
`rides.ts`:
  - `users.id` uuid PK; `passengers.id` uuid PK (passenger's own id);
  - `passengers.userId` uuid, **unique** (`passengers_user_id_unique`),
  FK → `users.id` ON DELETE cascade;
  - `riders.passengerId` FK → `passengers.id` (not `users.id`);
  - `drivers.userId` also unique, and `drivers` requires `licenseNumber`.
- `packages/shared-db/src/migrations/0000_unusual_morlun.sql:80` confirms
`CONSTRAINT "passengers_user_id_unique" UNIQUE("user_id")` is already
present — no schema change or new migration required.
- `packages/shared-db` `drizzle-orm@0.35.3` exports `NodePgTransaction`,
and the typed `Database` (`NodePgDatabase<typeof schema>`) supports
`db.transaction(async (tx) => ...)`. The current OTP flow did not use a
transaction.
- Role behavior: first-time users are created with role `passenger`
(hardcoded at `auth.service.ts` original line 128). Passenger profiles are
therefore appropriate for `user.role === 'passenger'`. `driver_applicant`,
`driver`, and admin roles are not given a passenger profile automatically,
matching existing architecture (drivers require `licenseNumber`; admins
log in through a separate flow per Task 1c).

### Files changed

- `apps/backend/src/modules/auth/auth.service.ts` (only file changed).

### Implementation summary

In `verifyOTP`, after OTP verification:

1. Look up the `users` row by phone number.
2. **New user** (not found): wrap `INSERT INTO users` and
  `INSERT INTO passengers` in a single `db.transaction()` so user creation
   and passenger-profile creation succeed or fail atomically. The passenger
   insert uses `.onConflictDoNothing({ target: passengers.userId })` for
   safety against any race.
3. **Existing user**: update `isVerified` if needed (unchanged behavior);
  then, if `user.role === 'passenger'`, run a single idempotent
   `INSERT INTO passengers ... ON CONFLICT (user_id) DO NOTHING`.
4. The JWT payload, JWT env vars (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`),
  and the returned `user` response object are unchanged (backward
   compatible).

### Idempotency and concurrency

- `passengers.userId` has a UNIQUE constraint at the DB level
(`passengers_user_id_unique`), so duplicate passenger rows for one user
are physically impossible.
- `INSERT ... ON CONFLICT DO NOTHING` on that unique constraint means:
repeated OTP verification never creates a duplicate; an existing profile
is retained (not re-created, not updated).
- Concurrent passenger-profile creation for an existing user is safe because
the unique constraint on passengers.userId and ON CONFLICT DO NOTHING prevent
duplicate passenger profiles. Concurrent first-time verification requests may
still race while inserting the users row because Task 1a did not add conflict
handling to users.phoneNumber. That separate race condition was not changed or
runtime-tested by this task.

### Transaction usage

- A transaction is used **only** for the new-user branch, because it
performs two dependent writes (create user, then create passenger
profile) that must be atomic (a crash between them would leave a user
with no profile).
- The existing-user branch performs a single statement (the idempotent
passenger insert / conflict-no-op), so no transaction is needed there;
keeping it transaction-free avoids unnecessary lock scope and preserves
the existing code path's behavior.

### Validation commands and results

1. `npx tsc --noEmit -p packages/shared-db/tsconfig.json`
  → **PASS** (no output, exit 0).
2. `npx tsc --noEmit -p apps/backend/tsconfig.json`
  → **PASS** (no output, exit 0). No `any`, no non-null assertions were
   newly introduced (the existing `inserted[0]!` non-null pattern was kept
   unchanged inside the transaction).
3. `npm run build --workspace @kansride/backend` (`nest build`)
  → **PASS** (exit 0). Compiled `dist/modules/auth/auth.service.js` was
   inspected and contains the two `onConflictDoNothing({ target:  passengers.userId })` calls (one inside the transaction, one in the
   existing-user branch).
4. `git diff --stat apps/backend/src/modules/auth/auth.service.ts`
  → 44 insertions, 14 deletions; only that one file changed.

### Runtime verification status

**Not performed.** Local PostgreSQL (server running, port 5432) rejects the
default `postgres:postgres` credentials with `28P01 password authentication failed for user "postgres"` — the same blocker recorded in Task 0a,
Unresolved issue #1. No destructive operation was attempted and no
credentials were guessed. The following remain **statically verified but
not runtime-verified**:

- a new eligible user receives exactly one passenger profile;
- verifying again does not create a second passenger profile;
- `passengers.userId` points to `users.id`;
- the passenger profile has its own `passengers.id`;
- existing users and profiles are not damaged.

Static verification confirms the SQL shape (single insert + unique
constraint + ON CONFLICT DO NOTHING) and the schema guarantee these
properties, but a real database run is still required for final confirmation
once the PostgreSQL credential blocker is resolved.

### Unresolved issues

- PostgreSQL credentials blocker (carried over from Task 0a) — must be
resolved before runtime verification of Task 1a (and all subsequent
runtime tasks).
- The rides controller (`rides.controller.ts:30`) still passes
`req.user.userId` (which is `users.id`) as `passengerId` to
`createRide`, while `rides.passengerId` FK → `passengers.id`. Task 1a
ensures the `passengers` row exists, but the controller still uses the
wrong identifier; resolving the passenger-id source is the next task
(Task 1b / Step 2 territory) and is explicitly out of scope for 1a.

### Recommended next task

**Task 1b — Make** `UsersService.getProfile` **perform a real DB fetch**
(returning `users` joined with `passengers`/`drivers` as appropriate), as
specified in the audit §13 Step 1, to replace the hardcoded TODO data and
unblock the mobile profile screens (downstream of Task 1a's passenger row).

---

*End of Task 1a entry.*

## Task 1b — Resolve the authenticated user's passenger profile ID before creating or querying passenger rides

**Date:** 2026-07-22
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); runtime DB verification still blocked by local PostgreSQL credentials (Task 0a, Unresolved issue #1).

### Original issue

The JWT payload carries `userId` = `users.id`, but the `rides` table has
`passengerId` foreign-keyed to `passengers.id` (a separate UUID primary key).
`RidesController.createRide` passed `req.user.userId` (`users.id`) straight
into `RidesService.createRide(..., passengerId)` and that value ended up in
`rides.passengerId`. Even after Task 1a guarantees the `passengers` row
exists, this would violate the FK constraint (`users.id` is not a row in
`passengers`) or, at best, write the wrong identifier. Audit §8 row 12, §13
Step 1 (task 1b), §14 Step 1.

### Files inspected

- `apps/backend/src/modules/rides/rides.controller.ts`
- `apps/backend/src/modules/rides/rides.service.ts`
- `apps/backend/src/modules/rides/rides.module.ts`
- `apps/backend/src/modules/auth/auth.service.ts` (Task 1a passenger-row guarantee)
- `apps/backend/src/modules/users/users.service.ts`
- `packages/shared-db/src/schema/{users,passengers,rides,drivers}.ts`
- `packages/shared-auth/src/jwt.ts` (`TokenPayload` = `{ userId, phoneNumber, role }`)
- `apps/backend/src/common/guards/{auth,roles}.guard.ts`
- Backend-wide grep for `req.user`, `passengerId`, `getPassengerRides`,
`createRide` to find every mixing of `users.id` and `passengers.id`
- `docs/recovery/PHASE-2-AUDIT.md` (route ownership) and
`docs/recovery/PHASE-2-RECOVERY-LOG.md`

### Files changed

- `apps/backend/src/modules/rides/rides.service.ts`
- `apps/backend/src/modules/rides/rides.controller.ts`

### Implementation summary

1. In `RidesService`, added a private `getPassengerProfileByUserId(authenticatedUserId)`:
  - `SELECT * FROM passengers WHERE passengers.userId = authenticatedUserId LIMIT 1`.
  - Throws `ForbiddenException('No passenger profile found for this account')` when no row.
  - Returns the full typed passenger row (typed by Drizzle's inferred select type — no `any`, no new non-null assertion).
2. Renamed `createRide`'s first parameter from `passengerId` → `authenticatedUserId` and resolved the real id internally: `const passenger = await this.getPassengerProfileByUserId(authenticatedUserId);` then `insert(rides).values({ passengerId: passenger.id, ... })`. The service API now *cannot* be tricked into writing `users.id` into `rides.passengerId`.
3. In `RidesController`, replaced the two `@Request() req: any` typings with a strict `AuthenticatedRequest extends Request { user: TokenPayload & { iat, exp } }` (imported `TokenPayload` from `@kansride/auth`), so `req.user.userId` is now typed, not `any`. The argument value passed to `createRide` is unchanged (`req.user.userId`); the controller still has no business knowing `passengers.id`.

### Identity mapping

```
JWT.user.userId  (== users.id)
   │
   └─► RidesService.getPassengerProfileByUserId(authenticatedUserId)
           │  SELECT passengers WHERE passengers.user_id = <userId>
           ▼
       passengers.id   (== passengers.user_id's owning row PK)
           │
           └─► rides.passenger_id  (FK → passengers.id)
```

The controller never sees or passes `passengerId`. The service accepts
only `authenticatedUserId` and resolves the FK-compliant id itself. The
existing `getPassengerRides(passengerId, ...)` service method keeps its
`passengerId` parameter (it is correct as-is); whoever wires Task 2d's
`my-rides` route must resolve the passenger id first (recommended pattern is
in place to reuse `getPassengerProfileByUserId` — made private for now per
Task 1b scope; can be exposed when Task 2d lands).

### Affected routes

- `POST /rides` — fixed: now resolves `passengerId` from the authenticated
user's `passengers` row before insert.

Not changed (no `passengerId`/`users.id` confusion was present):

- `GET /rides/:id` — keys on `rides.id` only.
- `GET /rides/:id/track` — `@Public()`; keys on `rides.id` only.
- `PATCH /rides/:id/status` — system/actor-agnostic; out of Task 1b scope.
- `POST /rides/:id/rate` — keys on `rides.id` only.
- `PATCH /rides/:id/cancel` — the `req.user.userId` is stored in the
free-form `cancelled_by` UUID column (not an FK to `passengers`). The
audit assigns the cancel-actor rework (hardcoded
`'cancelled_by_passenger'` and actor) to **Task 2b**, so `cancelRide`'s
actor behavior is intentionally untouched here.
- `GET /rides/my-rides` — **not added.** Audit §13 and §14 assign the
my-rides route to **Task 2d**. Task 1b does not introduce it. The
service method `getPassengerRides(passengerId, limit)` is left intact and
correct for Task 2d to wire up.
- `GET /users/me` — unchanged (audit Task 1b in *audit*-numbering is
`UsersService.getProfile`; this session's Task 1b is the
passenger-id-resolution slot, so `users.service.ts` is untouched here).

### Error behavior

- Authenticated user with no `passengers` profile (e.g., driver, admin,
dispatcher, or any role that should not create a passenger ride):
`createRide` throws `ForbiddenException` → HTTP `403 {"statusCode":403,"message":"No passenger profile found for this account","error":"Forbidden"}`. This respects role separation and
does not silently create a passenger row inside ride creation.
- Authenticated user with a `passengers` profile (the case Task 1a
guarantees for passenger-role OTP users): the existing profile is
reused (no duplicate creation, no duplicate select). Repeated rides
reuse the same `passengers.id`.
- Unauthenticated request: `AuthGuard` already returns `401` before
the service is reached; unchanged.

### Validation commands and exact results

1. `npx tsc --noEmit -p packages/shared-db/tsconfig.json` → **PASS**
  (no output, exit 0).
2. `npx tsc --noEmit -p apps/backend/tsconfig.json` → **PASS**
  (no output, exit 0). No `any`, no new non-null assertions introduced.
   `TokenPayload` import is `import type`, so no runtime coupling.
3. `npm run build --workspace @kansride/backend` (`nest build`)
  → **PASS** (exit 0).
4. Compiled-output inspection of `dist/modules/rides/rides.service.js`:
  - `getPassengerProfileByUserId(authenticatedUserId)` present;
  - `throw new common_1.ForbiddenException('No passenger profile found for this account')` present;
  - insert line reads `passengerId: passenger.id` (the resolved FK-compliant
  id), NOT `passengerId: authenticatedUserId`;
  - log line `Ride created ... for passenger ${passenger.id}` present.
5. `git diff --stat`: 2 files changed (+40 / −7).

### Runtime verification status

**Not performed.** Local PostgreSQL (server running, port 5432) still
rejects the default `postgres:postgres` credentials with
`28P01 password authentication failed for user "postgres"` — the same
blocker recorded in Task 0a, Unresolved issue #1 (re-confirmed during this
task: `DB UNREACHABLE: 28P01`). No destructive operation, no credential
guessing, no reseed/truncate was attempted.

The following properties are therefore **statically verified only**:

- `users.id` resolves to the correct `passengers.id` (verified by code:
the lookup is `WHERE passengers.user_id = authenticatedUserId` against
the unique-constrained column; `passengers.user_id → users.id` FK is in
the migration SQL `0000_unusual_morlun.sql:170`).
- ride creation stores `passengers.id` in `rides.passengerId` (verified
by compiled JS line `passengerId: passenger.id`).
- a non-passenger user receives `403 Forbidden` (verified by the
`ForbiddenException` path; role separation is preserved because only
passenger-role users get a passenger row per Task 1a).
- an absent passenger profile produces a clear, non-5xx error
(`ForbiddenException` with an explicit message).
- repeated requests do not create passenger profiles (no insert is
performed by `getPassengerProfileByUserId`; only reads).
- passenger ride history (`my-rides`) is not part of Task 1b, so no
behavior to verify here.

### Unresolved issues

- PostgreSQL credentials blocker (Task 0a #1, carried) — required for
any runtime verification of Task 1b and all subsequent runtime tasks.
- `PATCH /rides/:id/cancel` actor handling (hardcoded
`'cancelled_by_passenger'` + `cancelledBy = req.user.userId` free-form
uuid) — explicitly out of Task 1b scope and reserved for Task 2b.
- `GET /rides/my-rides` route — explicitly out of Task 1b scope; reserved
for Task 2d. `getPassengerRides(passengerId, limit)` is correct and
available for that task; when it is added, `@Get('my-rides')` must be
declared **before** `@Get(':id')` (route-order note recorded above).

### Recommended next task

**Task 1c — Decide the admin authentication model and add guards to
`AdminController**`, per audit §13 Step 1, task 1c. (The audit's Task 1b,
"Fix `UsersService.getProfile`", can also be done here — both are
independent of Task 1b as scoped in this session's prompt.) Until the
PostgreSQL credential blocker is resolved, runtime verification of any
further backend changes remains static-only.

---

*End of Task 1b entry.*

## Task 1c — Secure backend admin endpoints and establish a legitimate admin authentication path

**Date:** 2026-07-22
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); runtime DB verification still blocked by local PostgreSQL credentials (Task 0a, Unresolved issue #1).

### Original security issue

Phase 2 audit §11 #1-#3, §12 #6, §13 (Step 1, task 1c), §14:

- `AdminController` had **no guards, no `@RequirePermissions`, no `@Public`** — all five endpoints (`GET /admin/dashboard`, `/admin/drivers`, `/admin/rides`, `/admin/users`, `/admin/subscriptions`) were **publicly accessible**. Anyone on the network could enumerate users, drivers, rides, revenue, and subscriptions. Severity: HIGH.
- The admin-web app expected `Authorization: Bearer <localStorage admin_token>` (verified in `apps/admin-web/src/lib/api.ts:14-22`) but the backend had no admin login endpoint, and the admin-web login form (email/password) had no submit handler — there was no legitimate way to obtain `admin_token`, while the data was fully unauthenticated.

### Files inspected

- `apps/backend/src/modules/admin/admin.{controller,module,service}.ts`
- `apps/backend/src/modules/auth/auth.{controller,service,module}.ts`
- `apps/backend/src/common/guards/{auth,roles}.guard.ts`
- `apps/backend/src/common/decorators/{permissions,public}.decorator.ts`
- `apps/backend/src/modules/{rides,users,drivers}/*.controller.ts` (existing guard/decorator usage pattern — `@UseGuards(AuthGuard, RolesGuard)` + `@RequirePermissions(...)`, controller or method level)
- `packages/shared-auth/src/{rbac.ts,jwt.ts}`
- `packages/shared-db/src/schema/{users.ts,audit-logs.ts}`
- `apps/admin-web/src/lib/api.ts` (only to confirm the Bearer-JWT contract; **not modified**)
- Backend-wide grep for `@UseGuards`, `@RequirePermissions`, `admin`, `dispatcher` to enumerate existing guard/decorator conventions
- `docs/recovery/PHASE-2-AUDIT.md` and previous recovery-log entries

### Files changed

- `apps/backend/src/modules/admin/admin.controller.ts` (only backend file changed)
- `docs/recovery/PHASE-2-RECOVERY-LOG.md` (this entry)

### Selected authentication design: Option A

**Reuse the existing phone-OTP flow for pre-provisioned admin users.** No new admin login endpoint was added. Justification (verified by direct inspection of `auth.service.ts` `verifyOTP`):

1. **No public self-promotion.** The new-user branch hardcodes `role: 'passenger'` (line ~134). A first-time caller is *always* a passenger, never an admin. Therefore the public OTP route cannot give anyone an admin token. An admin token can only be issued to a user row that *already* has `role = admin` (provisioned out-of-band).
2. **Existing admin role is preserved.** The `else` branch (existing user) updates only `isVerified: true`; it never writes `role`. The admin's role stays admin in the DB.
3. **JWT carries role=admin.** `generateTokenPair({ userId, phoneNumber, role: user.role })` keeps `role` from the row (line ~172).
4. **No passenger row is created for admins.** The post-verify passenger insert is gated on `user.role === 'passenger'` (lines ~141, ~160). An admin's verifyOTP skips the passenger insert entirely.
5. **OTP rate limiting + verification are unchanged.** Task 1c does not touch OTP generation, rate limiting (3/15min), attempt counting, or expiry.

Reusing the OTP flow avoids inventing password auth (which would require new schema, hashing, provisioning, reset, and a security design — explicitly disallowed by the task). The admin-web email/password form mismatch is a **frontend** concern to be resolved in Task 4b; it does not require a backend endpoint.

### Authorization design implemented

- Controller-level `@UseGuards(AuthGuard, RolesGuard)` (matches the established pattern in `RidesController`, `DriversController`, `UsersController`). AuthGuard denies before RolesGuard denies, so unauthorized -> 401 and authenticated-but-unauthorized -> 403 are both correct.
- **Method-level** `@RequirePermissions(...)` — one permission per route (least privilege). A single controller-level permission is **not** used, because that would grant every role with that one permission access to every admin endpoint regardless of whether it has the narrower resource permission, rendering the existing `ROLE_PERMISSIONS` distinctions ineffective. The route-to-permission mapping is:
  - `GET /admin/dashboard`     -> `admin:view_analytics`
  - `GET /admin/drivers`       -> `admin:manage_drivers`
  - `GET /admin/rides`         -> `ride:view_all`
  - `GET /admin/users`         -> `admin:manage_users`
  - `GET /admin/subscriptions` -> `admin:manage_subscriptions`
  Each of these five strings is a member of the `Permission` union in `packages/shared-auth/src/rbac.ts` (lines 4, 12, 13, 15, 18). `RolesGuard` reads the method-level `'permissions'` metadata and calls `rbacService.hasAnyPermission(role, [perm])`; a missing permission returns `false` -> `ForbiddenException('Insufficient permissions')` -> **403**.
- No `@Public` decorator is used anywhere in the admin controller. There is **no** controller-level `@RequirePermissions` (deliberately removed during the Task 1c authorization correction).
- Business/SQL logic in `AdminService` is unchanged (requirement #17).
- No `any`, no new non-null assertions, no new env vars, no JWT / OTP / WebSocket / rides / drivers / fare / payment / subscription / schema / migration changes (requirements #4-#24). RBAC role mappings and the `Permission` union were not modified.
- No hardcoded password or credential was introduced (verified by diff-string scan: `git diff admin.controller.ts` had no matches for `password|secret|api_key|admin_token|JWT_|PRIVATE_KEY`).

### Protected routes and route-to-permission mapping

Each route is independently gated by its own `@RequirePermissions(...)`. The five `@Get` methods inherit only `@UseGuards(AuthGuard, RolesGuard)` from the class.


| Route                         | Method | Required permission          |
| ----------------------------- | ------ | ---------------------------- |
| `/api/v1/admin/dashboard`     | GET    | `admin:view_analytics`       |
| `/api/v1/admin/drivers`       | GET    | `admin:manage_drivers`       |
| `/api/v1/admin/rides`         | GET    | `ride:view_all`              |
| `/api/v1/admin/users`         | GET    | `admin:manage_users`         |
| `/api/v1/admin/subscriptions` | GET    | `admin:manage_subscriptions` |


### 401 / 403 / 200 behavior

- No token / invalid token / expired token -> `**AuthGuard` throws `UnauthorizedException` -> 401** (unchanged `auth.guard.ts`), for every `/admin/`* route.
- Valid JWT whose role lacks the **route-specific** required permission -> `RolesGuard.canActivate` -> `rbacService.hasAnyPermission(role, [perm])` returns `false` -> `ForbiddenException('Insufficient permissions')` -> **403**.
- Valid JWT whose role has the route-specific required permission -> `hasAnyPermission` returns `true` -> controller action proceeds (200 with unchanged endpoint SQL/query logic).
- The correction **removed** the previous single controller-level gate (`admin:view_analytics` for all five routes). Roles that have `admin:view_analytics` but lack the resource-specific permission (e.g. `finance_officer` and `auditor` for `/admin/drivers`, `/admin/users`, and `/admin/rides` for `finance_officer`) now correctly receive **403** on those endpoints. See the RBAC access matrix below for the per-route per-role outcome.
- finance_officer now correctly receives 403 on /drivers, /rides, and /users; auditor receives 403 on /drivers, /users, and /subscriptions, while retaining access to /dashboard and /rides according to the existing RBAC mapping.

### RBAC access matrix (verified statically)

For each route, `Y` = the role has the route's required permission (-> 200); `N` = it does not (-> 403). Source of truth: `ROLE_PERMISSIONS` in `packages/shared-auth/src/rbac.ts` (lines 45-96).


| Role             | /dashboard | /drivers | /rides | /users | /subscriptions |
| ---------------- | ---------- | -------- | ------ | ------ | -------------- |
| passenger        | N          | N        | N      | N      | N              |
| driver_applicant | N          | N        | N      | N      | N              |
| driver           | N          | N        | N      | N      | N              |
| dispatcher       | N          | N        | Y      | N      | N              |
| support_agent    | N          | N        | Y      | Y      | N              |
| finance_officer  | Y          | N        | N      | N      | Y              |
| safety_officer   | N          | N        | Y      | Y      | N              |
| ops_admin        | Y          | Y        | Y      | Y      | Y              |
| system_admin     | Y          | Y        | Y      | Y      | Y              |
| super_admin      | Y          | Y        | Y      | Y      | Y              |
| auditor          | Y          | N        | Y      | N      | N              |


Notable least-privilege consequences of the correction vs. the previous single-gate (`admin:view_analytics` for all five routes):

- `finance_officer` and `auditor` can view the dashboard but can **no longer** reach `/drivers`, `/users`, and (for `finance_officer`) `/rides`.
- `dispatcher`, `support_agent`, `safety_officer` are non-admin-tier roles but `ROLE_PERMISSIONS` grants `ride:view_all` to them; under method-level gating they CAN call `GET /admin/rides` and 403 on every other admin route. Under the previous single-`admin:view_analytics` gate they were forbidden from all five — also wrong, but the other way.
- `support_agent` and `safety_officer` have `admin:manage_users`, so they CAN reach `GET /admin/users` under the corrected gate even though they are not strictly admin-tier roles. This is the existing `ROLE_PERMISSIONS` mapping and was not modified in Task 1c (see "Outstanding RBAC mapping review" below).
- The earlier claim "all five admin roles pass; no non-admin role passes" is **retracted** as incorrect: it held only under the (now-removed) single-`admin:view_analytics` gate, which violated least privilege.

### Validation commands and exact results

1. `npx tsc --noEmit -p packages/shared-auth/tsconfig.json` -> **PASS** (no output, exit 0).
2. `npx tsc --noEmit -p packages/shared-db/tsconfig.json` -> **PASS** (no output, exit 0).
3. `npx tsc --noEmit -p apps/backend/tsconfig.json` -> **PASS** (no output, exit 0). No `any`, no non-null assertions introduced.
4. `npm run build --workspace @kansride/backend` (`nest build`) -> **PASS** (exit 0).
5. Compiled output inspection of `dist/modules/admin/admin.controller.js`:
  - Class-level `__decorate` for `AdminController` (lines 88-92) contains `(0, common_1.Controller)('admin')` and `(0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard)` and **no** `RequirePermissions` call.
  - `getDashboard` method decorator contains `(0, permissions_decorator_1.RequirePermissions)('admin:view_analytics')` (line 45).
  - `getDrivers` method decorator contains `(0, permissions_decorator_1.RequirePermissions)('admin:manage_drivers')` (line 52).
  - `getRides` method decorator contains `(0, permissions_decorator_1.RequirePermissions)('ride:view_all')` (line 62).
  - `getUsers` method decorator contains `(0, permissions_decorator_1.RequirePermissions)('admin:manage_users')` (line 72).
  - `getSubscriptions` method decorator contains `(0, permissions_decorator_1.RequirePermissions)('admin:manage_subscriptions')` (line 81).
  - No `Public()` decorator appears anywhere in the admin controller.
6. Static RBAC matrix verification (throwaway `.ts` validator via `npx tsx --tsconfig tsconfig.base.json`, then deleted): exercised `RBACService.hasAnyPermission(role, [perm])` for every (role, route-permission) pair (11 roles × 5 routes = 55 cells) and asserted each cell against the expected matrix derived from `ROLE_PERMISSIONS`. The validator printed the table reproduced above and exited 0 -> **STATIC RBAC MATRIX VERIFICATION PASSED** (all 55 cells matched).
7. Search for hardcoded credentials in the diff: no matches.

### Runtime verification status

**Not performed.** Local PostgreSQL still rejects the default `postgres:postgres` credentials with `28P01 password authentication failed for user "postgres"` (re-confirmed during Task 1c). No pre-provisioned admin account is available to test against either. No admin was created or promoted for testing (requirements #25 / #27). No destructive operation or credential guessing was attempted. All checklist items below are therefore **statically verified only**:

- admin OTP login succeeds — *static*: existing-user OTP path preserves `role`, issues JWT with `role=admin`, and does not create a passenger row for non-passenger roles (verified in `auth.service.ts`).
- JWT contains `role=admin` — *static*: `generateTokenPair` carries `user.role`.
- Each route returns 200 for a role with the route-specific permission — *static*: RBAC matrix validator confirmed every "Y" cell.
- Each route returns 403 for a role lacking the route-specific permission — *static*: RBAC matrix validator confirmed every "N" cell.
- Every `/admin/*` route returns 401 for no/invalid/expired token — *static*: `AuthGuard` throws `UnauthorizedException` independent of which method-level `@RequirePermissions` is applied.

These remain runtime-unverified pending the PostgreSQL credential blocker and an out-of-band-provisioned admin account.

### Outstanding RBAC mapping review (flagged, not actioned)

The five existing `ROLE_PERMISSIONS` entries were NOT modified in Task 1c (requirement #6 forbids touching RBAC role mappings). Two preexisting quirks now surface because the gate is per-route rather than blanket:

- `support_agent` and `safety_officer` are not admin-tier roles conceptually, but `ROLE_PERMISSIONS` grants `admin:manage_users` to both (lines 58, 66). Under the corrected method-level gate they can call `GET /admin/users`. Whether that is intended is a product/RBAC-design question for a later task — **not** to be changed inside Task 1c.
- `dispatcher`, `support_agent`, `safety_officer` can call `GET /admin/rides` via `ride:view_all`. Same reasoning.

These are noted for the record only.

### Unresolved frontend login mismatch

`apps/admin-web/src/app/login/page.tsx` has an email/password form with no submit handler, and `apps/admin-web/src/lib/api.ts` sends `Authorization: Bearer <localStorage admin_token>`. Since Task 1c chose Option A (reuse phone-OTP), the admin-web login UI must be reworked in **Task 4b** to use phone + OTP fields, call `POST /auth/request-otp` and `POST /auth/verify-otp`, store the issued JWT (`accessToken`) as `admin_token` in `localStorage`, and redirect to `/dashboard`. This frontend task was **not started** in 1c (requirements #18-#21) and is recorded here so it is not forgotten.

### Unresolved admin provisioning requirement

Task 1c does **not** provision or create any admin account (requirement #25). To actually log in as an admin, someone with DB access must insert a row into `users` with `role = 'ops_admin'` / `'system_admin'` / `'super_admin'` / `'finance_officer'` / `'auditor'`, `is_verified` irrelevant (OTP verify will set it true), and a real Ghana phone number. This is an operator action, not a code-recovery task, and is therefore **out of scope** here — but flagged so it is not confused with Task 1c completion. No seed script is added (requirements #4 / #25).

### Outstanding recovery item — the audit's official Task 1b

A previous session reused the label "Task 1b" for the passenger-id-resolution work (Task 2 territory in audit numbering). The audit's actual Task 1b is:

> **Fix `UsersService.getProfile`** — replace the TODO with a real DB fetch joining `users` + `passengers` (totalRides) or `drivers` (`apps/backend/src/modules/users/users.service.ts`).

This remains **unstarted** and is recorded here so it is not lost. It is independent of the admin work and can be done at any time.

### Recommended next task

**Task 2a — Fix driver-controller JWT field reads** (per audit §13 Step 2, task 2a): `drivers.controller.ts` reads `req.user.sub` and `req.user.driverId`, neither of which exist on the JWT payload (`{ userId, phoneNumber, role }`). Every `/drivers/`* endpoint throws at runtime. Change to `req.user.userId` and resolve `driverId` via `DriversService.getDriverProfile(userId)`. This unblocks the entire driver app and is the next-highest blast-radius item after the admin security hole. (Alternatively, the audit's Task 1b `UsersService.getProfile` real DB fetch can be done first — it is independent and small.)


## Task 2a — Correct driver-controller JWT identity handling

**Date:** 2026-07-23
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); runtime DB verification still blocked by local PostgreSQL credentials (Task 0a, Unresolved issue #1).

### Root cause

The JWT access token payload is fixed at `{ userId, phoneNumber, role }` (`packages/shared-auth/src/jwt.ts:10-14`) — it contains **no** `sub` and **no** `driverId` field. `DriversController` nonetheless read `req.user?.sub` (in `/register` and `/me`) and `req.user?.driverId` (in `/go-online`, `/go-offline`, `/location`, `/subscribe`, `/earnings`). Both reads resolved to `undefined` at runtime, so:

- `/register` and `/me` received `userId = undefined` and either threw a generic `Error('User ID not found in request')` (uncaught 500) or passed `undefined` into the service.
- `/go-online`, `/go-offline`, `/location`, `/subscribe`, `/earnings` all threw `Error('Driver ID not found in request')` (uncaught 500) before reaching the service.

Every authenticated driver endpoint was therefore broken regardless of role or JWT validity. Additionally the controller annotation `{ user?: { sub?: string; driverId?: string } }` was an `any`-ish ad-hoc shape unrelated to the actual verified payload, hiding the type error from tsc.

The deeper underlying issue: the JWT carries `users.id` (as `userId`), but driver-domain service methods (`setOnlineStatus`, `updateLocation`, `subscribe`, `getEarnings`) take `drivers.id`. These are two different UUIDs linked through `users.id ↔ drivers.userId` and `drivers.id` (a separate primary key). The controller had no way to convert one to the other, so it invented a `driverId` field on the JWT that the issuer never populates.

### Files inspected

- `apps/backend/src/modules/drivers/drivers.controller.ts`
- `apps/backend/src/modules/drivers/drivers.service.ts`
- `apps/backend/src/modules/drivers/drivers.module.ts`
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/common/guards/auth.guard.ts` (sets `request.user = payload`, a `TokenPayload & { iat; exp }`)
- `apps/backend/src/common/guards/roles.guard.ts`
- `apps/backend/src/common/decorators/permissions.decorator.ts`, `public.decorator.ts`
- `packages/shared-auth/src/jwt.ts` (TokenPayload declaration)
- `packages/shared-auth/src/rbac.ts` (driver_applicant / driver permission sets)
- `packages/shared-db/src/schema/drivers.ts` (`drivers.userId → users.id` unique FK; `drivers.id` separate PK)
- `packages/shared-db/src/schema/users.ts`, `packages/shared-db/src/schema/rides.ts` (`rides.driverId → drivers.id`)
- `apps/backend/src/modules/rides/{rides.controller,rides.service}.ts` (uses `req.user.userId` correctly; unaffected)
- `apps/backend/src/modules/users/users.controller.ts` (uses `req.user.userId` correctly; unaffected)
- `apps/backend/src/modules/admin/admin.service.ts`, `apps/backend/src/modules/events/events.gateway.ts`, `apps/backend/src/modules/rides/dispatch.service.ts` (all use `drivers.id`/`drivers.userId` correctly from DB rows; unaffected)
- Repository glob for `driver-locations*` (no such schema file)
- Backend-wide grep for `req.user.sub`, `req.user.driverId`, `req.user.userId`, `getDriverProfile`, `drivers.userId`, `driverId` to enumerate all affected sites.
- `docs/recovery/PHASE-2-AUDIT.md`, `docs/recovery/PHASE-2-RECOVERY-LOG.md`

### Files changed

- `apps/backend/src/modules/drivers/drivers.controller.ts` (+64/−28)
- `apps/backend/src/modules/drivers/drivers.service.ts` (+70)

No other backend module, frontend app, schema, or migration was modified.

### Affected routes

All seven endpoints in `DriversController` were affected by the incorrect JWT field reads. Each is corrected below.

| Route | Method | Guard | @RequirePermissions | Original incorrect read | Corrected read |
|---|---|---|---|---|---|
| `/drivers/register`    | POST  | AuthGuard+RolesGuard | `driver:register`     | `req.user?.sub` (→ users.id expected)         | `req.user.userId` (users.id) |
| `/drivers/go-online`   | POST  | AuthGuard+RolesGuard | `driver:go_online`    | `req.user?.driverId` (→ drivers.id expected)  | `req.user.userId` → service resolves drivers.id |
| `/drivers/go-offline`  | POST  | AuthGuard+RolesGuard | `driver:go_online`    | `req.user?.driverId`                          | `req.user.userId` → service resolves drivers.id |
| `/drivers/location`    | PATCH | AuthGuard+RolesGuard | `driver:go_online`    | `req.user?.driverId`                          | `req.user.userId` → service resolves drivers.id |
| `/drivers/subscribe`   | POST  | AuthGuard+RolesGuard | `driver:subscribe`    | `req.user?.driverId`                          | `req.user.userId` → service resolves drivers.id |
| `/drivers/me`          | GET   | AuthGuard+RolesGuard | (none)               | `req.user?.sub` (→ users.id expected)         | `req.user.userId` (users.id) |
| `/drivers/earnings`    | GET   | AuthGuard+RolesGuard | `driver:view_earnings`| `req.user?.driverId`                          | `req.user.userId` → service resolves drivers.id |

### Original incorrect JWT fields

- `req.user.sub` — never present in the JWT payload; the issuer (`auth.service.ts` `generateTokenPair` → `JWTService.generateAccessToken`) signs only `{ userId, phoneNumber, role }`.
- `req.user.driverId` — never present in the JWT payload; there is no field by that name in `TokenPayload`. The `drivers.id` is a separate DB-side primary key obtainable only by a `drivers.userId = users.id` lookup.

### Identity-resolution mapping

```
JWT.userId  ==  users.id
              -> drivers.userId  (unique FK, drivers.userId → users.id)
                 -> drivers.id   (separate uuid PK; required by setOnlineStatus,
                                  updateLocation, subscribe, getEarnings, and by
                                  rides.driverId / subscriptions.driverId FKs)
```

The controller now ALWAYS supplies `req.user.userId` (== `users.id`) to the service. For methods that need `drivers.id`, the service performs the lookup internally via the new private `resolveDriverByUserId(authenticatedUserId)` helper, then uses the resolved `drivers.id` for the underlying DB/Redis operations. Controllers stay thin and cannot mix identifier types (requirement #5).

### Route/service identifier requirements

Category A — expects `users.id` (use `req.user.userId` directly):
- `POST /drivers/register` → `DriversService.register(authenticatedUserId, data)`. The service inserts a new `drivers` row keyed on `userId`, and updates `users.role` to `'driver_applicant'`. No drivers.id lookup needed (it's a creation).
- `GET /drivers/me` → `DriversService.getDriverProfile(authenticatedUserId)`. The service already looks up by `drivers.userId` and returns `{ isDriver: false }` for users with no driver row. The `/me` contract is intentionally a soft-fail read (does not throw on missing driver profile) so that a just-registered `driver_applicant` (or even a passenger) can call `/me` and learn their status; this contract is preserved unchanged.

Category B — expects `drivers.id` (resolve via `resolveDriverByUserId(authenticatedUserId)` first, then pass `driver.id`):
- `POST /drivers/go-online`  → `setOnlineStatus(driver.id, true, location)`  (DB update + Redis geoAdd)
- `POST /drivers/go-offline` → `setOnlineStatus(driver.id, false)`          (DB update + Redis geoRemove)
- `PATCH /drivers/location`  → `updateLocation(driver.id, lat, lng)`        (Redis geoAdd + DB update)
- `POST /drivers/subscribe`  → `subscribe(driver.id, paymentMethod)`        (subscription insert + driver update; also looks up `users.phoneNumber` from `driver.userId`)
- `GET /drivers/earnings`    → `getEarnings(driver.id)`                     (rides query on `rides.driverId = drivers.id`)

Category C — neither; logging/audit only: not applicable — all reads are A or B above.

No column or service method documented to require `drivers.id` is supplied `users.id`, and vice versa.

### Missing-profile behavior

`DriversService.resolveDriverByUserId(authenticatedUserId)`:
- Queries `drivers` on `drivers.userId = authenticatedUserId`, `limit(1)`.
- If no row: throws `new NotFoundException(\`Driver profile not found for user ${authenticatedUserId}\`)`.

This applies to all five Category B endpoints. A user without a `drivers` row (passenger, `driver_applicant` whose registration has not completed, or any non-driver role that happens to pass RolesGuard — see "Role and permission behavior" below) receives **HTTP 404** with a clear message identifying the missing user. The choice of `NotFoundException` matches the existing convention in `setOnlineStatus` (`throw new NotFoundException('Driver not found')`) and `subscribe` (`throw new NotFoundException('User not found')`). `ForbiddenException` was considered but rejected: it would be misleading because the role/permission check has already passed by the time we look up the driver row; the missing-row condition is a resource-existence problem, not an authorization one.

`GET /drivers/me` is intentionally exempt from the NotFoundException change — its existing documented behavior is `{ isDriver: false }` for users with no driver row, and changing that to a 404 would break the `/me` contract relied on by driver_applicants who have no row yet. Soft-fail-on-`/me` is preserved.

### Role and permission behavior

Roles/permissions are enforced entirely by the existing `AuthGuard` (401 on missing/invalid/expired token) + `RolesGuard` (403 on missing permission), unchanged.

| Endpoint | Required permission | Roles that have it (per `ROLE_PERMISSIONS`) |
|---|---|---|
| `/drivers/register`    | `driver:register`      | `driver_applicant`, `driver`, `super_admin` |
| `/drivers/go-online`   | `driver:go_online`     | `driver`, `super_admin` |
| `/drivers/go-offline`  | `driver:go_online`     | `driver`, `super_admin` |
| `/drivers/location`    | `driver:go_online`     | `driver`, `super_admin` |
| `/drivers/subscribe`   | `driver:subscribe`     | `driver`, `super_admin` |
| `/drivers/me`          | (none — only AuthGuard)| any authenticated JWT |
| `/drivers/earnings`    | `driver:view_earnings` | `driver`, `super_admin` |

Consequences:
- **passenger token**: 403 on every endpoint EXCEPT `/me` (no permission metadata → RolesGuard passes). `/me` returns `{ isDriver: false }` (no driver row). No driver row is ever created for a passenger (requirement #10 preserved — `register` requires `'driver:register'` permission which passenger lacks).
- **driver_applicant token**: can call `/register` (only allowed role-specific permission besides super_admin) and `/me`. CANNOT call go-online/go-offline/location/subscribe/earnings (no `driver:go_online` / `driver:subscribe` / `driver:view_earnings`). Per audit instructions, driver_applicant is NOT treated as a fully approved driver (requirement #12 preserved); role mappings were not modified.
- **driver token**: passes RolesGuard on all driver endpoints. Each Category B endpoint resolves `drivers.id` via `drivers.userId = req.user.userId`; if for some reason the driver row was deleted after token issuance, the user gets 404 (`NotFoundException`) rather than a silent failure or a 500.
- **dispatcher, support_agent, finance_officer, safety_officer, ops_admin, system_admin, auditor**: each lacks the relevant driver permissions → 403 on all Category B endpoints. `system_admin` and `super_admin` were compared: `super_admin` has every permission and can hit any driver endpoint (intended RBAC); `system_admin` lacks driver permissions in `ROLE_PERMISSIONS` (lines 74-80) and therefore 403s — this is the existing mapping and was NOT changed.
- `@Public` is not present anywhere in `DriversController`; `@UseGuards(AuthGuard, RolesGuard)` remains at class level and is untouched.

### Validation commands and exact results

1. `npx tsc --noEmit -p packages/shared-auth/tsconfig.json` → **PASS** (no output, exit 0).
2. `npx tsc --noEmit -p packages/shared-db/tsconfig.json` → **PASS** (no output, exit 0).
3. `npx tsc --noEmit -p apps/backend/tsconfig.json` → **PASS** (no output, exit 0). Strict typing preserved: the ad-hoc `{ user?: { sub?: string; driverId?: string } }` annotation was replaced with a typed `AuthenticatedRequest = Request & { user: TokenPayload & { iat: number; exp: number } }`. No `any`, no new non-null assertions (requirement #18 / #19 satisfied — `req.user` is now non-optional because AuthGuard guarantees it).
4. `npm run build --workspace @kansride/backend` (`nest build`) → **PASS** (exit 0).

Static verification (focused):
- `grep` for `req.user?.sub` and `req.user?.driverId` in `src/modules/drivers` → **0 matches** (was 7 originally).
- `grep` for `req.user.userId` in `src/modules/drivers/drivers.controller.ts` → **7 matches** (one per endpoint), plus 1 in JSDoc.
- `grep` for `user.sub` and `user.driverId` in `dist/modules/drivers/*.js` (compiled) → **0 matches**.
- `grep` for `user.userId` in `dist/modules/drivers/drivers.controller.js` → **7 matches**.
- Backend-wide grep for `req.user?.sub` / `req.user?.driverId` → **0 matches**. No other controller was reading either field.
- Compiled `dist/modules/drivers/drivers.service.js` confirms the new `resolveDriverByUserId`, `goOnlineByUserId`, `goOfflineByUserId`, `updateLocationByUserId`, `subscribeByUserId`, `getEarningsByUserId` methods exist; each calls `resolveDriverByUserId(authenticatedUserId)` then delegates to the existing `drivers.id`-keyed method. The 404 throw (`NotFoundException('Driver profile not found for user ${authenticatedUserId}')`) is present (line 43 of compiled JS).
- Remaining `.driverId` references in the backend are all legitimate DB-column reads (`rides.driverId`, `subscriptions.driverId`, `ride.driverId` from joined rows) or local variables in unrelated modules — none read `req.user.driverId`.
- Diff scan for hardcoded credentials (`password|secret|api_key|admin_token|JWT_|PRIVATE_KEY`) → **0 matches**.
- `git status --short` confirms only `drivers.controller.ts` and `drivers.service.ts` were modified; no frontend, schema, or migration file touched; the three pre-existing untracked files (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`, `repository-tree.txt`) were not created or modified by this task.

No unit-test framework exists in the repository (no `*.spec.ts`, no `jest`/`vitest` configured in `apps/backend`), so no focused tests were added (per the "consistent with current repository patterns" instruction).

### Runtime verification status

**Not performed.** Local PostgreSQL still rejects the default `postgres:postgres` credentials with `28P01 password authentication failed for user "postgres"` (re-confirmed during Task 2a — same blocker as Task 0a Unresolved issue #1, Task 1c). No pre-provisioned driver account is available to test against either. No driver was created or promoted for testing (no credentials, no destructive DB operations — requirement #15/#16). All checklist items below are therefore **statically verified only**:

- an approved driver's `users.id` resolves to the correct `drivers.id` — *static*: `resolveDriverByUserId` queries `drivers.userId = authenticatedUserId`; the schema confirms `drivers.userId` is a unique FK to `users.id` (so the lookup is 1:1 and deterministic).
- driver profile endpoint returns the correct driver — *static*: `/me` calls `getDriverProfile(req.user.userId)`, which queries `drivers.userId` and returns the row's `id`/`isOnline`/`isActive`/`rating`/`completedRides`/`subscriptionExpiresAt`/`vehicle`.
- Category B update endpoints modify only that driver — *static*: `goOnlineByUserId`/`goOfflineByUserId`/`updateLocationByUserId`/`subscribeByUserId` each resolve the row then call the underlying method with `driver.id`; all underlying methods scope their `db.update(drivers).where(eq(drivers.id, driverId))` to the resolved `drivers.id`.
- missing driver profile produces the intended error — *static*: `resolveDriverByUserId` throws `NotFoundException('Driver profile not found for user ${authenticatedUserId}')`; NestJS maps it to HTTP 404.
- passenger token receives 403 — *static*: passenger does not have any of `driver:go_online`, `driver:subscribe`, `driver:view_earnings`, `driver:register`; RolesGuard throws `ForbiddenException('Insufficient permissions')`. `/me` returns `{ isDriver: false }` (403-free by design).
- no operation creates an unintended driver row — *static*: only `register` inserts into `drivers`, and it is gated on `'driver:register'` permission (passenger/dispatcher/etc. cannot call it); no Category B method inserts into `drivers`.

These remain runtime-unverified pending the PostgreSQL credential blocker and out-of-band-provisioned driver/admin accounts.

### Unresolved issues

1. **PostgreSQL `28P01` password authentication blocker** (Task 0a, Unresolved issue #1) — persists; all runtime verification of every backend task remains unavailable until resolved.
2. **`GET /drivers/me` soft-fail contract**: an unauthenticated-shape response (`{ isDriver: false }`) is intentional for non-driver roles. Some product designs would prefer a 403 (driver-only endpoint), but changing that would alter a public API contract and possibly break callers (driver-app login flow checks `/me`) — out of scope for Task 2a. The endpoint keeps its current "any authenticated role may call" behavior.
3. **`support_agent` / `safety_officer` having `admin:manage_users`** and `dispatcher`/`support_agent`/`safety_officer` having `ride:view_all` — preexisting `ROLE_PERMISSIONS` quirks surfaced in Task 1c, NOT changed here. These roles do NOT have any driver permission and therefore still 403 on every Category B `/drivers/*` endpoint, so Task 2a introduces no new least-privilege regression.

### Outstanding recovery item — the audit's official Task 1b

Still outstanding (NOT actioned in Task 2a): the audit's actual Task 1b is **`Fix UsersService.getProfile`** — replace the TODO with a real DB fetch joining `users` + `passengers` (`totalRides`) or `drivers` (`apps/backend/src/modules/users/users.service.ts`). A previous session reused the label "Task 1b" for the passenger-id-resolution work; the audit's Task 1b remained unstarted through Tasks 1c and 2a and remains unstarted here. It is small and independent and can be done at any time.

### Recommended next task

**Task 2b — Fix ride-cancellation actor handling** (per audit §13 Step 2, task 2b): `PATCH /rides/:id/cancel` currently hardcodes the cancellation reason as `'cancelled_by_passenger'` and writes `cancelledBy = req.user.userId` (a `users.id`) into `rides.cancelledBy`, which the schema documents as a free-form UUID but the audit wants resolved to the right actor class and a real reason. Tighten the cancellation reason/actor and ensure driver-initiated cancellation writes the correct enum/status and the correct driver-side metadata. Independent of Task 2a.

(Alternatively, the audit's Task 1b `UsersService.getProfile` real DB fetch can be done next — small and independent.)

## Audit Task 1b — Implement UsersService.getProfile (real DB fetch for GET /users/me)

**Historical task-number clarification (important):** A previous recovery session reused the label "Task 1b" for the unrelated **passenger-id-resolution-before-ride-creation** work (audit §13 Step 2 territory in some maps, but logged under "Task 1b" in this log's earlier entry). That earlier entry is preserved unchanged; its scope (fixing `createRide`'s `passengerId = req.user.userId` FK violation) is NOT what audit §13 Step 1 task 1b asks for. The **audit's** official Task 1b (audit §13 line 385, audit §8 row #7) is: "*Fix `UsersService.getProfile` — replace the TODO with a real DB fetch joining `users` + `passengers` (totalRides) or `drivers`.*" This entry implements that audit task. It is labeled **"Audit Task 1b"** throughout to disambiguate it from the earlier "Task 1b" entry which handled passenger identity resolution.

**Date:** 2026-07-23
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static). Runtime DB verification still blocked by local PostgreSQL `28P01 password authentication failed` (Unresolved issue #1, carried from Task 0a).

### Original TODO/problem

`apps/backend/src/modules/users/users.service.ts` was:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    // TODO: Fetch from DB
    return { id: userId, phoneNumber: '+233240000000', role: 'passenger', isVerified: true };
  }
}
```

`GET /users/me` therefore returned fake data with a hardcoded phone number for every authenticated JWT, regardless of who the caller was. `mobile-passenger/profile.tsx:31-33` reads `{ id, phone?, name?, totalRides? }` from this endpoint and writes it into the auth store; the passenger's profile screen thus always showed "+233240000000", no name, and no `totalRides` (since the placeholder omitted it). `mobile-driver/profile.tsx:43-48` reads `{ id, phoneNumber, firstName?, lastName?, role }` from `/users/me` (Driver-only fields come from a separate `/drivers/me` call), and got the same fake shape.

The audit's row #7 (audit §8) confirms what the frontend expects: "*real user profile (name, totalRides)*", against the backend's "*hardcoded TODO: `{ id, phoneNumber: '+233240000000', role, isVerified }`*".

### Files inspected

- `apps/backend/src/modules/users/users.controller.ts` — `/users/me` route; `req.user.userId` already used (unlike the driver controller, this was never broken).
- `apps/backend/src/modules/users/users.service.ts` — placeholder (see above).
- `apps/backend/src/modules/users/users.module.ts` — providers `[UsersService]`.
- `apps/backend/src/modules/auth/auth.service.ts` — `verifyOTP` creates users + passengers rows (Task 1a); confirmed `users` columns available; confirmed `count()` is imported from `drizzle-orm` here in the same project.
- `apps/backend/src/common/guards/auth.guard.ts` — sets `request.user = TokenPayload & { iat; exp }` after `verifyAccessToken`.
- `packages/shared-auth/src/jwt.ts` — `TokenPayload = { userId, phoneNumber, role }`; no `sub`, no `driverId`.
- `packages/shared-db/src/schema/users.ts` — `users` columns: `id, phoneNumber, email, firstName, lastName, role, status, isVerified, profilePhotoUrl, createdAt, updatedAt`. **No OTP columns on `users`** (OTP lives in a separate `otpRequests` table, keyed by phone number and never joined to this response).
- `packages/shared-db/src/schema/passengers.ts` — `passengers.id PK`, `passengers.userId` unique FK → `users.id` (onDelete cascade), `rating numeric(3,2)`, `preferredPaymentMethod`, `completedRides integer default 0`, timestamps. Verified `completedRides` is **not** incremented anywhere in the codebase (grep on `passengers.completedRides` returns only reads; no `set({ completedRides:` or `.increment(` update). → The column is **not authoritative**; the audit's instruction "use existing authoritative columns such as completedRides when present" applies only *if* present **and** maintained; requirement #6 explicitly says to fall back to a live DB count when no authoritative counter exists.
- `packages/shared-db/src/schema/drivers.ts` — `drivers.id PK`, `drivers.userId` unique FK → `users.id`, plus driver-domain columns. Driver details remain the responsibility of `GET /drivers/me` (Task 2a territory); not duplicated here.
- `packages/shared-db/src/schema/rides.ts` — `rides.passengerId FK → passengers.id`, `rides.status` (`completed` is one of the enum values), `rides.driverId`, timestamps. Provides the row source for the live `totalRides` count.
- `packages/shared-db/src/index.ts` and `packages/shared-db/src/schema/index.ts` — `export * from './schema'` re-exports `users`, `passengers`, `drivers`, `rides`. All imports `from '@kansride/db'` work as in other services.
- `apps/backend/src/database/database.module.ts` — `DATABASE_TOKEN` provider is `@Global()`. No need to import `DatabaseModule` into `UsersModule`. Verified pattern by reading `drivers.module.ts` which similarly relies on the global token.
- `apps/backend/src/modules/admin/admin.service.ts` — reference for the established `count()` result type coercion pattern: `const [userCount] = await this.db.select({ value: count() }).from(users); const totalUsers = userCount?.value ?? 0;` and `Number(revenueResult?.value) || 0` (lines 12-13, 32). Used as a precedent for safe-number conversion in this implementation.
- `apps/backend/src/modules/drivers/drivers.service.ts` — reference for the `resolveDriverByUserId(authenticatedUserId)` / `NotFoundException` pattern established in Task 2a; mirrored the JSDoc + identity-flow comment style.
- Callers of `GET /users/me` (full enumeration; backend-wide grep `users/me` found no in-tree backend callers — only the three mobile apps):
  - `apps/mobile-passenger/app/(main)/profile.tsx` — reads `{ id, phone?, name?, totalRides?, createdAt? }`; writes `{ id, phone, name, totalRides }` to `useAuthStore`.
  - `apps/mobile-passenger/src/stores/auth-store.ts` — `User = { id, phone?, name?, totalRides? }`.
  - `apps/mobile-driver/app/(main)/profile.tsx` — reads `{ id, phoneNumber, firstName?, lastName?, role }` from `/users/me`, plus `{ isDriver, driverId?, rating?, completedRides?, vehicle? }` from `/drivers/me`.
  - `apps/mobile-driver/app/(main)/home.tsx` and `subscription.tsx` — use `/drivers/me`, NOT `/users/me`.
- `docs/recovery/PHASE-2-AUDIT.md` (§8 row #7, §13 Step 1 task 1b line 385).
- `docs/recovery/PHASE-2-RECOVERY-LOG.md` (existing Task 1b entry preserved; existing Task 2a entry preserved; this entry appended).

### Files changed

- `apps/backend/src/modules/users/users.service.ts` — rewritten (+108 / −9 net).
- `apps/backend/src/modules/users/users.module.ts` — **unchanged** (`DatabaseModule` is `@Global()`; `UsersService` is already a provider).
- `apps/backend/src/modules/users/users.controller.ts` — **unchanged**; `req.user.userId` was already correct (this controller never had the bug Task 2a fixed in `DriversController`).

No frontend file, schema file, or migration file was modified.

### Response contract (final shape)

The response preserves every existing field callers may rely on (`id`, `phoneNumber`, `firstName`, `lastName`, `role`, `isVerified`) and adds the fields audit §8 row #7 demands (`name`, `totalRides`) plus optional `phone` (alias of `phoneNumber` to satisfy the passenger store's `User.phone`). It also adds explicit profile-existence flags `isPassenger` and `isDriver` so callers can branch.

```ts
{
  // Base user fields
  id: string;                                  // users.id
  phoneNumber: string;                         // users.phoneNumber
  firstName: string | null;                     // users.firstName
  lastName: string | null;                      // users.lastName
  name: string | undefined;                     // "firstName lastName" if any; else undefined
  phone: string;                                // alias of phoneNumber (for passenger auth store)
  email: string | null;                        // users.email
  role: UserRole;                              // users.role ('passenger'|'driver_applicant'|'driver'|...)
  status: UserStatus;                           // users.status ('active'|'inactive'|'suspended'|'banned')
  isVerified: boolean;                          // users.isVerified
  profilePhotoUrl: string | null;               // users.profilePhotoUrl
  createdAt: Date;                              // users.createdAt
  // Profile flags + ride count for callers
  isPassenger: boolean;                         // true iff a passengers row exists for users.id
  isDriver: boolean;                            // true iff a drivers row exists for users.id
  totalRides: number;                           // passenger-only; 0 when isPassenger is false
}
```

Mapping to each caller:

| Caller | Fields used | Present in new shape? |
|---|---|---|
| `mobile-passenger/profile.tsx` | `id`, `phone`, `name`, `totalRides`, `createdAt` | ✓ all present |
| `mobile-passenger/stores/auth-store.ts` `User` type | `id`, `phone?`, `name?`, `totalRides?` | ✓ all present |
| `mobile-driver/profile.tsx` (its own `UserProfile`) | `id`, `phoneNumber`, `firstName?`, `lastName?`, `role` | ✓ all present |
| `auth.service.ts verifyOTP` return shape (not in scope) | n/a — distinct endpoint | not affected |

The controller (`users.controller.ts:11`) still returns the service result directly; no DTO mapper is introduced (consistent with the rest of the codebase — most controllers return service objects verbatim).

### User/passenger/driver lookup flow

```
JWT.userId  ==  users.id  (validated by AuthGuard)
  → Q1: users.id = authenticatedUserId    (1 row; base user fields)
  → Q2 (parallel): rides JOIN passengers ON passengers.id = rides.passengerId
                    WHERE passengers.userId = authenticatedUserId
                      AND rides.status = 'completed'
                    → COUNT(*) AS total          (1 row; passenger's totalRides)
  → Q3 (parallel): passengers.userId = authenticatedUserId  (1 row id-only; isPassenger)
  → Q4 (parallel): drivers.userId = authenticatedUserId     (1 row id-only; isDriver)
```

`totalRides = isPassenger ? passengerRideCount : 0` — i.e. for users who somehow have completed rides without a current `passengers` row (e.g. the row was deleted), we still return the count if Q3 found a `passengers` row; if the row is absent, we force `totalRides = 0` even if Q2 happened to find rows (defensive).

Q2/Q3/Q4 run with `Promise.all` — fixed cost, three single-row queries, no N+1. Q1 must complete first because we need the `users` row, and because we must throw `NotFoundException` before doing further work if no user exists for the JWT.

### totalRides calculation

- `rides.passengerId` is a NOT-NULL FK → `passengers.id`.
- A passenger's `totalRides` is computed live as `COUNT(*)` over `rides` where `rides.passengerId = passengers.id` AND `rides.status = 'completed'`.
- "Completed" matches the passenger-app copy at `profile.tsx:78` (`"{n} rides completed"`).
- The `passengers.completedRides` column is **NOT** used: it exists with `default 0` but no code path increments it on ride completion (grep verified). Per audit's "use existing authoritative columns such as completedRides when present" the audit's qualifier "authoritative" is the operative word — when not maintained, the live DB count is required by requirement #6.
- Number coercion: Drizzle's `count()` in Node-PG returns the count as a `string` (the `bigint`/`numeric` result shape from `pg`'s driver). The implementation coerces with `Number(raw)` after null/undefined checks, then validates `Number.isFinite(value)` before returning. Pattern mirrors `admin.service.ts:13`/`:32` which uses the same `Number(...) || 0` idiom for sum/count results.

### Missing-user behavior (404)

If Q1 returns no row (the JWT's `userId` no longer corresponds to a `users` row, e.g. an admin hard-deleted the user after the token was issued):

```ts
throw new NotFoundException(`User not found for id ${authenticatedUserId}`);
```

→ HTTP `404` with body `{ "statusCode": 404, "message": "User not found for id <uuid>", "error": "Not Found" }`. No further queries run.

### Users with neither passenger nor driver profile

A user with no `passengers` row and no `drivers` row is a valid state:

- `dispatcher`, `support_agent`, `finance_officer`, `safety_officer`, `ops_admin`, `system_admin`, `auditor` — admin/staff roles that do not ride as passengers or drive.
- `driver_applicant` whose application has not yet been approved into a `drivers` row (Task 2a notes driver_applicants intentionally do not receive a `drivers` row from `/register`).
- A fully deleted passenger row but extant user.

Behavior: the response returns the base `users` fields with `isPassenger: false`, `isDriver: false`, `totalRides: 0`. **No passenger or driver row is created** (no `INSERT` in the service — `select`-only implementation; this is the strongest static guarantee). Requirement #8 satisfied.

`mobile-driver/profile.tsx` calls `/drivers/me` in parallel; that endpoint returns `{ isDriver: false }` for such users (Task 2a soft-fail contract), so the driver-app sees a graceful "Driver" placeholder name (`home.tsx:70` comment: "Driver profile not found — that's OK for new drivers").

### Sensitive-field exclusions

The `users` table itself does **NOT** contain any OTP-related columns — OTP metadata lives in the separate `otpRequests` table (keyed by `phoneNumber`, never selected here). The `users` row's columns are allsafe to return for a self-profile endpoint. For clarity, the implemented response shape excludes the following:

| Excluded field | Where it lives | Reason |
|---|---|---|
| `updatedAt` | `users.updatedAt` | internal-audit timestamp; not needed by callers; only `createdAt` is returned |
| OTP `codeHash`/`attempts`/`maxAttempts`/`expiresAt`/`verifiedAt` | `otpRequests.*` | never selected — separate table, keyed by phone, never joined here |
| OTP code plaintext | (never stored) | OTP codes are never persisted in plaintext; only a hash in `otpRequests.codeHash` |
| Password / password hash | (column does not exist) | the schema has no password columns; auth is OTP-only |
| JWT access/refresh secrets | env-only (`JWT_ACCESS_SECRET`) | never returned |
| Driver `licenseNumber`, `currentLatitude`, `currentLongitude`, `vehicleId` | `drivers.*` (selected only on `/drivers/me`) | driver-domain; not in `/users/me` response. Q4 selects only `drivers.id` for the `isDriver` flag — no other column is read into memory |
| Passenger `rating`, `preferredPaymentMethod`, `completedRides` (the unmaintained column) | `passengers.*` | passenger-domain; not in `/users/me` response. Q3 selects only `passengers.id` for the `isPassenger` flag |
| `rides.*` rows themselves | `rides` table | Q2 only computes `COUNT(*)`; no ride row is returned to the caller |

### Validation commands and exact results

1. `npx tsc --noEmit -p packages/shared-auth/tsconfig.json` → **PASS** (no output, exit `0`).
2. `npx tsc --noEmit -p packages/shared-db/tsconfig.json` → **PASS** (no output, exit `0`).
3. `npx tsc --noEmit -p apps/backend/tsconfig.json` → **PASS** (no output, exit `0`). No `any`, no new non-null assertions. `Inject`, `Database`, `eq`, `and`, `count` are imported directly from `@nestjs/common`, `@kansride/db`, `drizzle-orm`. `users`/`passengers`/`drivers`/`rides` imported from `@kansride/db` (matches the existing `drivers.service.ts:8` precedent).
4. `npm run build --workspace @kansride/backend` (`nest build`) → **PASS** (exit `0`).

### Focused static verification

- `grep -i 'TODO\|Fetch from DB' apps/backend/src/modules/users` → **0 matches** in source. The single text occurrence of "TODO" anywhere in the file is the JSDoc sentence "*Sensible fields ... cannot leak here*" — there is no `// TODO` comment and no placeholder string in the response. Verified.
- Compiled `dist/modules/users/users.service.js` confirms:
  - `users` lookup: `eq(db_1.users.id, authenticatedUserId)` ✓ (line 29)
  - `rides` join `passengers` on `passengers.id = rides.passengerId` ✓ (line 39)
  - `passengers.userId = authenticatedUserId` filter ✓ (line 40)
  - `rides.status = 'completed'` filter ✓ (line 40)
  - `passengers.userId = authenticatedUserId` lookup ✓ (line 49)
  - `drivers.userId = authenticatedUserId` lookup ✓ (line 55)
  - `NotFoundException('User not found for id ${authenticatedUserId}')` throw ✓ (line 33)
  - Count coercion: `Number(raw)` + `Number.isFinite(value)` ✓ (lines 42-44)
  - No `INSERT`/`UPDATE`/`DELETE` operation ✓
  - No `otpRequests`, `licenseNumber`, `currentLatitude`, or any sensitive-column reference in the compiled output ✓
- `git status --short`: only `apps/backend/src/modules/users/users.service.ts` modified. The three untracked files (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`, `repository-tree.txt`) are pre-existing (created by prior tasks/tooling) and were not created or modified by this task.
- No frontend/schema/migration file modified (`git status` filter for `mobile-passenger|mobile-driver|admin-web|tracking-web|shared-db/src/schema|shared-db/src/migrations` shows only the two pre-existing `next-env.d.ts` untracked files which this task did not touch).
- Backend-wide grep `users/me` → no in-tree callers beyond the three mobile apps already enumerated.

### Runtime verification blocker

**Not performed.** Local PostgreSQL still rejects `postgres:postgres` with `28P01 password authentication failed for user "postgres"` — same blocker recorded across Tasks 0a, 1a, 1b (passenger-id-resolution), 1c, 2a. Re-confirmed indirectly: no DB query was attempted in this task; the implementation is statically typed and compiles.

The following runtime scenarios therefore remain **statically verified only**:

1. passenger account:
   - `/users/me` returns base user data — *static*: Q1 selects `users` row by `authenticatedUserId`; new shape includes `id`, `phoneNumber`, `firstName`, `lastName`, `name`, `phone`, `email`, `role`, `status`, `isVerified`, `profilePhotoUrl`, `createdAt`.
   - `isPassenger` is true — *static*: Q3 queries `passengers.userId = authenticatedUserId`; the passenger row Task 1a creates during `verifyOTP` guarantees this returns a row.
   - `totalRides` matches the database — *static*: Q2 does `COUNT(*)` over `rides JOIN passengers ON passengers.id = rides.passengerId WHERE passengers.userId = authenticatedUserId AND rides.status = 'completed'`; with no DB to test against we cannot show the numeric match but the SQL is deterministic and the count coercion is safe.
2. driver account:
   - `/users/me` returns base user data — *static*: same as above (Q1 is universal).
   - `isDriver` is true — *static*: Q4 queries `drivers.userId = authenticatedUserId`; Task 2a's `register` creates the row.
   - Driver details themselves are not on `/users/me` — they live on `/drivers/me` per Task 2a's existing contract; this avoids duplicating Task 2a's work.
3. user with neither profile (e.g. `dispatcher`, `auditor`, `driver_applicant` not yet approved):
   - base profile returned safely — *static*: Q1 still returns the row (the user exists); Q3 and Q4 each return `null`; the response is the base shape with `isPassenger: false`, `isDriver: false`, `totalRides: 0`.
   - No row created — *static*: the service is select-only; zero `INSERT` operations in the compiled output.
4. nonexistent JWT user (deleted after issuance):
   - returns 404 — *static*: Q1 yields no row → `throw new NotFoundException('User not found for id ${authenticatedUserId}')` → HTTP 404. No further query runs (no wasted DB round-trips).

### Unresolved issues

1. **PostgreSQL `28P01` password authentication blocker** (Task 0a, Unresolved issue #1) — persists; all runtime verification remains unavailable. Same status as Tasks 1c and 2a.
2. **`passengers.completedRides` column drift** — the column exists, defaults to 0, is never incremented anywhere, so it can drift from the live `totalRides` count. This task uses the live count, leaving the column untouched. A later task could choose to deprecate the column OR add maintenance code (increment on ride completion) — out of scope for Audit Task 1b; flagged for the recovery audit's awareness.
3. **`/users/me` for `auditor`/`dispatcher`** returns `totalRides: 0` not because the user has zero completed rides but because they are not a passenger — the implementation explicitly forces `totalRides = 0` when `isPassenger === false` to avoid misleading data. This is intentional but frontends that show totalRides unconditionally will render "0 rides completed" for such roles; the passenger-app has role-gated access (no auditor/dispatcher logs into mobile-passenger), so this is a theoretical concern only.

### Recommended next task

**Task 2b — Fix ride-cancellation actor handling** (per audit §13 Step 2 task 2b). `PATCH /rides/:id/cancel` currently hardcodes `'cancelled_by_passenger'` and writes `req.user.userId` (a `users.id`) into `rides.cancelledBy`; tighten actor/reason per audit §8 row #9. Independent of Audit Task 1b.

### Out-of-scope items NOT touched (preserved)

- JWT payload, OTP behavior, passenger identity handling (Task 1b-in-the-prior-session), admin auth (Task 1c), driver controller identity handling (Task 2a), ride cancellation (Task 2b), rating (Task 2c), ride-history (Task 2d), dispatch/WebSocket (Task 3), fare, frontend, schemas, migrations. All preserved.
- `users.controller.ts` not modified (its `req.user.userId` read was already correct).

## Task 2b — Fix ride-cancellation actor handling

**Date:** 2026-07-24
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static). Runtime DB verification still blocked by local PostgreSQL `28P01 password authentication failed` (Unresolved issue #1, carried from Task 0a).

### Original problem

`PATCH /rides/:id/cancel` had four coupled defects:

1. **Hardcoded cancellation status** (`rides.service.ts` old line 145): `const cancelStatus = 'cancelled_by_passenger'` regardless of who called. A `super_admin` cancelling a ride in `emergency_hold` (where only `cancelled_by_admin` is allowed, per `ride-transitions.ts:74-77`) would be rejected by the state machine's actor check, and a driver could never trigger `cancelled_by_driver`.
2. **Hardcoded actor** (old line 146): `this.stateMachine.validateTransition(ride.status, cancelStatus, 'passenger')` — the actor string `'passenger'` was fixed, so even if the target status had been `cancelled_by_admin`, the state machine's `allowedActors.includes('passenger')` check would reject it for the `cancelled_by_admin` transition (allowedActors: `['admin']`).
3. **Authorization gap for drivers**: `rbac.ts` granted `ride:cancel` only to `passenger` and `super_admin`. The state machine defines `cancelled_by_driver` transitions (lines 37, 44 of `ride-transitions.ts`) with `allowedActors: ['driver']`, but a driver calling `PATCH /rides/:id/cancel` got HTTP 403 from `RolesGuard` before the service ran — the `cancelled_by_driver` branch was unreachable over HTTP.
4. **No WebSocket broadcast on cancellation**: the mobile-driver client subscribes to a `ride:cancelled` socket event (`apps/mobile-driver/src/api/socket.ts:113-117`, consumed at `apps/mobile-driver/app/(main)/home.tsx:93`), and the mobile-passenger `ride-store.ts:73-81` maps an incoming `cancelled` status via `ride:update`. The backend `EventsGateway` exposes `emitRideUpdate`/`emitToDriver` public methods (`events.gateway.ts:262-294`) but **no code path emitted `ride:cancelled`** — a backend-wide grep for `ride:cancelled` in `apps/backend/src/modules` returned only the consumer-side method names, never an emitter. Drivers learned of passenger cancellations only via polling.

A secondary observation (B2 in the design report): `rides.cancelledBy` is a free `uuid('cancelled_by')` column with **no FK** (`packages/shared-db/src/schema/rides.ts:34`). The controller passed `req.user.userId` (a `users.id`) into it. The column thus stores a `users.id` for every actor type. This is preserved as an intentional invariant (see "cancelledBy invariant" below).

### Files changed

| File | Change | Lines (net) |
|---|---|---|
| `apps/backend/src/modules/rides/rides.controller.ts` | Import `UserRole` from `@kansride/types`; pass `req.user.role as UserRole` into `cancelRide`. | +1 / −1 |
| `apps/backend/src/modules/rides/rides.service.ts` | Rewrite `cancelRide`: role→{actor, cancelStatus} map; `ForbiddenException` on unsupported role; state-machine validation retained as terminal/duplicate guard; `await` DB update before broadcasting; emit `ride:cancelled` via existing `EventsGateway` public methods. Inject `EventsGateway` via `forwardRef`. Add `CANCELLATION_ROLES` constant. | +53 / −8 |
| `apps/backend/src/modules/rides/rides.module.ts` | Import `EventsModule` via `forwardRef(() => EventsModule)` to resolve the `EventsGateway` injection (circular with `EventsModule`'s existing `forwardRef(() => RidesModule)`). | +3 / −1 |
| `packages/shared-auth/src/rbac.ts` | Add `'ride:cancel'` to the `driver` role's permission array. Single-token addition inside the existing `driver: [...]` literal. | +1 / −1 |

No frontend, schema, migration, payment, subscription, config, or Task 2c (rating) file was modified. `git diff --stat -- packages/shared-db/src/schema apps/mobile-passenger apps/mobile-driver apps/admin-web apps/tracking-web packages/shared-config` returned empty. The three pre-existing untracked files (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`, `repository-tree.txt`) were not created or modified by this task.

### Role-to-actor mapping (authoritative)

`CANCELLATION_ROLES` (`rides.service.ts:14-18`, `as const satisfies`):

| JWT role (`UserRole`) | State-machine actor | Target `RideStatus` | RBAC permission gate (`@RequirePermissions('ride:cancel')`) |
|---|---|---|---|
| `passenger` | `'passenger'` | `cancelled_by_passenger` | ✓ existing (rbac.ts:46) |
| `driver` | `'driver'` | `cancelled_by_driver` | ✓ added this task (rbac.ts:49) |
| `super_admin` | `'admin'` | `cancelled_by_admin` | ✓ existing (rbac.ts:82) |
| any other role | — | — | `ForbiddenException('Role "<role>" is not permitted to cancel rides')` thrown at the service layer (line 161) regardless of whether RolesGuard admitted the caller |

The map keys exactly match the three roles currently granted `ride:cancel` in `rbac.ts` (passenger, driver, super_admin). No default/catch-all branch maps unknown roles to admin — explicit mapping only, as required. The `as keyof typeof CANCELLATION_ROLES` narrowing makes the lookup return `{ actor, cancelStatus } | undefined`; the `if (!mapping)` branch throws `ForbiddenException` before any further work.

Per the state machine (`ride-transitions.ts`):
- `cancelled_by_passenger` is reachable from `requested`, `searching`, `driver_assigned`, `driver_en_route`, `waiting_for_passenger` (allowedActors `['passenger']`).
- `cancelled_by_driver` is reachable from `driver_assigned`, `driver_en_route` (allowedActors `['driver']`).
- `cancelled_by_admin` is reachable from `driver_assigned`, `emergency_hold` (allowedActors `['admin']`).
- All three `cancelled_by_*` states are **terminal** (`VALID_RIDE_TRANSITIONS['cancelled_by_*'] === []`, lines 80-82) — a second cancellation attempt throws `BadRequestException('Ride in terminal state "<status>" cannot transition to any other state')` from `state-machine.service.ts:14-17`. No additional duplicate-cancellation guard was added; the state machine remains the sole authority, as required.

### cancelledBy invariant (B2 resolution)

`rides.cancelledBy` stores `req.user.userId` (a `users.id`) for **every** actor type — passenger, driver, and super_admin. No resolution to `passengers.id` or `drivers.id` is performed. Rationale and invariants:

- The column is a free `uuid` with **no FK** constraint (`schema/rides.ts:34`), so storing `users.id` is type-safe at the DB level.
- `users.id` is the single canonical identifier carried in the JWT (`TokenPayload.userId`, `jwt.ts:11`) and is therefore the one identifier the controller can pass without additional DB lookups.
- Resolution to `passengers.id`/`drivers.id` would require extra `SELECT` queries per cancellation and would lose the ability to attribute admin cancellations (super_admin has neither a `passengers` nor `drivers` row).
- Downstream consumers do not JOIN on `cancelledBy`: `admin.service.ts:120` filters rides by `status IN ('cancelled_by_passenger','cancelled_by_driver','cancelled_by_admin')` and never references `cancelledBy` in a JOIN. No audit-log viewer in the current codebase resolves `cancelledBy` to a name.
- The event payload (see below) includes both `cancelledBy` (users.id) and `cancelledByRole` (the JWT role string), so consumers that wish to display "Cancelled by <role>" can do so without a JOIN.

This invariant is documented in the source comment at `rides.service.ts:184-187`.

### Event payload

Broadcast only after the DB `update` has `await`ed successfully (no try/catch wraps the update — a failure rethrows before the emit calls at lines 196-198):

```ts
{
  rideId: id,
  status: cancelStatus,            // 'cancelled_by_passenger' | 'cancelled_by_driver' | 'cancelled_by_admin'
  cancelledBy,                     // users.id (string)
  cancelledByRole: role,           // UserRole string from the JWT
  reason,                           // string | undefined
  cancelledAt: updatedAt.toISOString(),
}
```

Two emissions per cancellation:
- `eventsGateway.emitRideUpdate(id, payload)` → emits `ride:update` to all sockets in the `ride:<id>` room (existing method, `events.gateway.ts:262`). Consumed by `apps/mobile-passenger/src/api/socket.ts` `onRideUpdate` → `ride-store.ts:73-81` (`statusMap` includes `'cancelled'`).

  Note: the passenger `statusMap` keys on the bare string `'cancelled'`, but the backend emits the specific `cancelled_by_*` status. The passenger-side `statusMap[data.status] || currentRide.status` fallback (ride-store.ts:83) means an unrecognized `cancelled_by_passenger` value leaves the local status unchanged — the passenger app already sets `rideStatus='cancelled'` locally via `setRideStatus('cancelled')` immediately after its own `POST /rides/:id/cancel` succeeds (`ride/[id].tsx:99`), so the passenger sees the cancelled state regardless. This is a pre-existing frontend simplification (the type lists `cancelled` as a single status, `ride-store.ts:13`), unchanged by this task and out of scope per the "no frontend" constraint.

- `eventsGateway.emitToDriver(ride.driverId, 'ride:cancelled', payload)` → if the ride has a `driverId`, looks up the driver's `userId` and emits `ride:cancelled` to all of that user's connected sockets (`events.gateway.ts:279-294`). Consumed by `apps/mobile-driver/src/api/socket.ts:113-117` (`onRideCancelled`) and `apps/mobile-driver/app/(main)/home.tsx:93`. This resolves B3: drivers now receive realtime cancellation notifications.

`EventsGateway` itself was **not modified** — only called via its existing public API. The `EventsModule` already exported `EventsGateway` (events.module.ts:8) and already imported `RidesModule` via `forwardRef` (events.module.ts:6); adding the symmetric `forwardRef(() => EventsModule)` to `RidesModule` (rides.module.ts:10) closes the Nest circular-dependency pair so DI can resolve `EventsGateway` inside `RidesService`. This is module wiring only; no gateway behavior changed.

### Roles/permissions after the change

| Endpoint | Required permission | Roles that have it (post-change) |
|---|---|---|
| `PATCH /rides/:id/cancel` | `ride:cancel` | `passenger`, `driver`, `super_admin` |

- Before: `passenger`, `super_admin` only (2 roles).
- After: `passenger`, `driver`, `super_admin` (3 roles). The single addition is `'ride:cancel'` inserted as the second element of the `driver: [...]` array (rbac.ts:49). No other role's permissions were touched; no other permission was added or removed from `driver`.

Consequences:
- **passenger token**: cancels with actor `'passenger'` → status `cancelled_by_passenger`. Unchanged behavior, now correct via explicit map (previously worked by accident because the hardcoded values happened to match the passenger path).
- **driver token**: previously 403 at the RolesGuard; now passes the guard and cancels with actor `'driver''` → status `cancelled_by_driver`. State-machine still enforces that `cancelled_by_driver` is only reachable from `driver_assigned` or `driver_en_route` (ride-transitions.ts:37,44); a driver attempting to cancel from `requested`/`searching`/`waiting_for_passenger`/`in_progress`/`completed` will receive `BadRequestException` from `validateTransition` (no such transition is defined for actor `driver`). The `in_progress` → `emergency_hold` path remains the only in-trip interruption available to the driver (`ride-transitions.ts:63`), and that is a separate status, not a cancellation.
- **super_admin token**: cancels with actor `'admin'` → status `cancelled_by_admin`. Now works from `driver_assigned` and `emergency_hold` (the two states with an `admin`-actor `cancelled_by_admin` transition). A super_admin cancelling from `requested`/`searching` — where only the passenger actor is allowed to cancel — will be rejected by `validateTransition` with `Actor "admin" is not allowed to transition from "requested" to "cancelled_by_admin"` (state-machine.service.ts:28-32). This is correct: those pre-driver states are the passenger's exclusive cancellation domain.
- **all other roles** (`driver_applicant`, `dispatcher`, `support_agent`, `finance_officer`, `safety_officer`, `ops_admin`, `system_admin`, `auditor`): none has `ride:cancel` (rbac.ts unchanged for these), so `RolesGuard` returns 403 before the service runs. As a defense-in-depth measure, the service's `CANCELLATION_ROLES[role]` lookup would throw `ForbiddenException` for any of these roles if they somehow passed the guard (e.g. via a future RBAC edit that adds `ride:cancel` to a staff role without updating the service map).

### Validation commands and exact results

1. `npx tsc --noEmit -p apps/backend/tsconfig.json` → **PASS** (no output, exit `0`).
2. `npx tsc --noEmit -p packages/shared-auth/tsconfig.json` → **PASS** (no output, exit `0`).
3. `npx tsc --noEmit -p packages/shared-types/tsconfig.json` → **PASS** (no output, exit `0`).
4. `npx nest build` (from `apps/backend`) → **PASS** (no output, exit `0`).

`tsconfig.base.json` has `strict: true` and `noUncheckedIndexedAccess: true`. The `CANCELLATION_ROLES[role as keyof typeof CANCELLATION_ROLES]` lookup correctly types as `{ actor: string; cancelStatus: RideStatus } | undefined`; the `if (!mapping)` narrow makes the subsequent destructure safe without a non-null assertion. No `any` was introduced (the existing `cancelStatus as any` cast inside `db.update(rides).set({...})` is pre-existing and required by Drizzle's generated row type; same pattern as `dispatch.service.ts:61/74/101/124` and the pre-change `rides.service.ts`).

### Focused static verification

- `git diff --name-only` → exactly 4 files: `rides.controller.ts`, `rides.module.ts`, `rides.service.ts`, `rbac.ts`. No other repository path touched.
- `git diff --stat -- packages/shared-db/src/schema apps/mobile-passenger apps/mobile-driver apps/admin-web apps/tracking-web packages/shared-config` → empty (no frontend, schema, migration, or config change).
- `git diff -- packages/shared-db/src/migrations` → empty (no migration change).
- `rides.controller.ts:48` passes `req.user.role as UserRole` — confirms requirement (1). The cast is justified: `TokenPayload.role` is typed `string` (jwt.ts:13, because `@kansride/auth` does not import `@kansride/types` to avoid a workspace cycle), but `JWTService.verifyAccessToken` returns the JWT payload verbatim and the JWT is issued only by `auth.service.ts` which constructs it from `users.role` (a `UserRole`). The cast is the established pattern from Task 2a's `drivers.controller.ts` `AuthenticatedRequest`.
- `CANCELLATION_ROLES` keys (`rides.service.ts:14-18`) are exactly `passenger`, `driver`, `super_admin` — confirms requirement (2): explicit mapping of supported roles only, no default branch.
- `if (!mapping) throw new ForbiddenException(...)` (rides.service.ts:160-161) — confirms requirement (3).
- `cancelRide(id, cancelledBy, role, reason)` signature: `cancelledBy` is passed `req.user.userId` from the controller (controller:48), flows unmodified into `db.update(rides).set({ cancelledBy })` (service:176) — confirms requirement (4): `cancelledBy` remains `users.id`.
- `await this.db.update(rides)...` (service:172-180) precedes `this.eventsGateway.emitRideUpdate`/`emitToDriver` (service:196-198), with no `try/catch` around the update — confirms requirements (5) and (6): DB update before WebSocket emission; no broadcast if the update fails (the `await` rejection propagates up the call stack before the emit lines are reached).
- `rbac.ts:49` adds `'ride:cancel'` to the `driver` array; diff is `+1/-1` on that single line; `passenger` (line 46) and `super_admin` (line 82) arrays unchanged — confirms requirement (7): `ride:cancel` added only to the `driver` role.
- `this.stateMachine.validateTransition(ride.status, cancelStatus, actor)` (service:169) is the only transition validity check; no redundant terminal-state pre-check was added — confirms requirement (8): existing state-machine validation remains the duplicate/terminal-state guard.
- `events.gateway.ts` is **unchanged** (not in `git diff --name-only`). `EventsModule` exports `EventsGateway` (events.module.ts:8) and `RidesModule` now imports `EventsModule` via `forwardRef` (rides.module.ts:10), closing the symmetric circular-DI pair — no gateway protocol change, no new event method, only callers of the existing `emitRideUpdate`/`emitToDriver` public API.
- `ride:cancelled` emitter count in `apps/backend/src/modules`: was 0 before this task; now 1 call site (`rides.service.ts:198`). The corresponding `ride:cancelled` event name on the wire matches the one the mobile-driver client already listens for (`socket.ts:115`).
- Diff scan for hardcoded credentials (`password|secret|api_key|admin_token|JWT_|PRIVATE_KEY`) → **0 matches** in the diff.

No unit-test framework exists in the repository (no `*.spec.ts`, no `jest`/`vitest` configured in `apps/backend`, confirmed in Task 2a's log entry), so no focused tests were added — consistent with the current repository patterns.

### Runtime verification blocker

**Not performed.** Local PostgreSQL still rejects the default `postgres:postgres` credentials with `28P01 password authentication failed for user "postgres"` (same blocker recorded in Tasks 0a, 1a, 1b, 1c, 2a, Audit Task 1b). No pre-provisioned passenger/driver/admin account is available to exercise the cancellation path against a real DB. No data was created or mutated for testing (no credentials, no destructive DB operations — requirements #15/#16 carried from prior tasks). All checklist items below are therefore **statically verified only**:

- passenger cancels a `searching` ride → `cancelled_by_passenger`, `cancelledBy = passenger's users.id`, `ride:cancelled` emitted to ride room (no `driverId` yet, so no `emitToDriver`) — *static*: `CANCELLATION_ROLES.passenger` → `{ actor: 'passenger', cancelStatus: 'cancelled_by_passenger' }`; state machine allows `searching` → `cancelled_by_passenger` for actor `passenger` (ride-transitions.ts:26); `ride.driverId` is null at this state (no driver assigned), so the `if (ride.driverId)` branch (service:197) skips the driver emit.
- driver cancels a `driver_assigned` ride → `cancelled_by_driver`, `ride:cancelled` emitted to both ride room and the driver's own sockets — *static*: `CANCELLATION_ROLES.driver` → `{ actor: 'driver', cancelStatus: 'cancelled_by_driver' }`; state machine allows `driver_assigned` → `cancelled_by_driver` for actor `driver` (ride-transitions.ts:37); `ride.driverId` is non-null, so `emitToDriver` fires.
- driver attempts cancellation from `requested` (pre-dispatch) → `BadRequestException('Actor "driver" is not allowed to transition from "requested" to "cancelled_by_driver". Allowed: passenger')` — *static*: `requested` transitions (ride-transitions.ts:18-21) only include `cancelled_by_passenger` for actor `passenger`; `validateTransition` finds the matching `nextStates: ['cancelled_by_passenger']` entry, sees `cancelStatus = 'cancelled_by_driver'` is not in it, and falls through to the `Invalid transition` error (state-machine.service.ts:22-26). The 'Allowed:' suffix in the actor-mismatch path is not reached for this case; the user-facing error is the more precise `Invalid transition from "requested" to "cancelled_by_driver"`.
- super_admin cancels a ride in `emergency_hold` → `cancelled_by_admin`, actor `'admin'` — *static*: `CANCELLATION_ROLES.super_admin` → `{ actor: 'admin', cancelStatus: 'cancelled_by_admin' }`; `emergency_hold` → `cancelled_by_admin` allowedActors `['admin']` (ride-transitions.ts:76).
- passenger attempts to cancel an already-cancelled ride → `BadRequestException('Ride in terminal state "cancelled_by_passenger" cannot transition to any other state')` — *static*: `VALID_RIDE_TRANSITIONS['cancelled_by_passenger'] === []` (ride-transitions.ts:80); `validateTransition` short-circuits at state-machine.service.ts:14-17.
- driver_applicant / dispatcher / support_agent / safety_officer / ops_admin / system_admin / auditor token hits `PATCH /rides/:id/cancel` → HTTP 403 from `RolesGuard` (none has `ride:cancel`) before `RidesService.cancelRide` is entered — *static*: rbac.ts scans for `'ride:cancel'` yields only the three allowed roles; `RolesGuard` throws `ForbiddenException('Insufficient permissions')` for the others.

These remain runtime-unverified pending the PostgreSQL credential blocker and out-of-band-provisioned passenger/driver/admin accounts.

### Unresolved issues

1. **PostgreSQL `28P01` password authentication blocker** (Task 0a, Unresolved issue #1) — persists; all runtime verification of every backend task remains unavailable until resolved.
2. **No schema FK on `cancelledBy`** — the column remains a free `uuid`. A future audit may want to add an FK to `users.id` (or a polymorphic FK pattern if `passengers.id`/`drivers.id` attribution is later required). This is out of scope for Task 2b (explicitly forbidden: "Do NOT modify: schemas, migrations"), and the `users.id`-for-every-actor invariant makes a future single-target FK viable without schema work in this task.
3. **No broadcasted `ride:cancelled` for driverless rides (pre-dispatch cancellations)** — when a passenger cancels from `requested`/`searching` (no `driverId` assigned), only `emitRideUpdate` fires to the ride room; no `emitToDriver` is attempted. This is correct (no driver to notify), but it means the `apps/mobile-driver/app/(main)/home.tsx:93` `ride:cancelled` listener is only exercised for post-driver-assignment cancellations. Pre-dispatch passenger cancellations are invisible to drivers, which is the desired behavior (no driver was ever assigned).
4. **Frontend `ride-store.ts` status map** still lists only `'cancelled'` (not `'cancelled_by_passenger'`/`'cancelled_by_driver'`/`'cancelled_by_admin'`); passenger-side local state update on cancellation relies on the optimistic `setRideStatus('cancelled')` call in `ride/[id].tsx:99`, not on the socket payload. This is a pre-existing frontend simplification, unchanged here per the "no frontend" constraint.

### Out-of-scope items NOT touched (preserved)

- JWT payload, OTP behavior, passenger identity handling (Task 1b-in-the-prior-session), admin auth (Task 1c), driver controller identity handling (Task 2a), Audit Task 1b (`UsersService.getProfile`), ride rating (Task 2c), ride-history (Task 2d), dispatch/WebSocket (Task 3), fare, frontend (mobile-passenger / mobile-driver / admin-web / tracking-web), schemas, migrations, payment, subscription. All preserved.
- `events.gateway.ts` not modified (only called via its existing public `emitRideUpdate`/`emitToDriver` API).
- `state-machine.service.ts` not modified (only called).
- `ride-transitions.ts`, `ride.types.ts` not modified.
- `rides.controller.ts` `updateStatus`/`rateRide`/`getRide`/`trackRide`/`createRide` methods unchanged.

### Recommended next task

**Task 2c — Fix ride-rating handling** (per audit §13 Step 2 task 2c): `POST /rides/:id/rate` currently logs the rating but does not persist it (rides.service.ts:204-219). The ride must be in `completed` status to be rateable; the driver's `drivers.rating` and `drivers.completedRides` columns exist but are not updated. Tighten the rating flow to persist the rating and update the driver's aggregate. Independent of Task 2b.

(Note: per instruction, Task 2c is NOT to be begun here. This recommendation is for the next session.)

## Task 2c — Fix ride-rating persistence

**Date:** 2026-07-25
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static). Runtime DB verification still blocked by the local PostgreSQL `28P01 password authentication failed` (Unresolved issue #1, carried from Task 0a / 2b).

### Original problem

`POST /rides/:id/rate` had five coupled defects:

1. **Nothing persisted.** `rides.service.ts` (old lines 204-219) only validated `1 ≤ rating ≤ 5`, validated `ride.status !== 'completed'`, and then issued `this.logger.log(...)` — no `UPDATE` was ever issued against `rides`, so the rating was discarded on every request. The response `{ id, rating, comment }` was a fiction.
2. **Authorization gap.** `rides.controller.ts` (old lines 57-60) had `@Post(':id/rate')` with **no `@RequirePermissions`** decorator. Any authenticated role (passenger, driver, dispatcher, super_admin, auditor, etc.) could rate any ride. `req.user` was never forwarded to the service, so the service had no way to identify the rater.
3. **No duplicate-rating prevention.** With no persistence, there was no mutation on a second call, but the endpoint always returned 200. Once persisted, a duplicate call would overwrite the prior rating silently — there was no guard.
4. **Fractional ratings accepted.** `if (rating < 1 || rating > 5)` admits `4.5`, `Math.PI`, etc. The frontend (`apps/mobile-passenger/app/(main)/ride/[id].tsx:113-123`) sends an integer 1-5, but the API contract did not enforce integer-only.
5. **`drivers.rating` never recomputed.** The schema declares `drivers.rating numeric(3,2) default '5.00'` (`packages/shared-db/src/schema/drivers.ts:10`) but no code path ever recomputed it after a rating submission. A driver's aggregate rating stayed at the default `5.00` regardless of how many rides were rated. `drivers.completedRides` (`drivers.ts:16`) was similarly never incremented anywhere (confirmed by grep) — D2 decision: do not use it.

A secondary observation (D1 in the design report): no `ratings` table exists, and the audit-recommended approach (Option B1) is to add the rating columns directly to `rides` (one rider rates one ride, exactly once). Decision recorded in the task plan: no `ratings` table; columns on `rides` are `rating integer`, `rating_comment text`, `rated_at timestamptz`, `rated_by uuid → users.id`, all nullable.

### Files changed

| File | Change | Lines (net) |
|---|---|---|
| `packages/shared-db/src/schema/rides.ts` | Import `users`. Add four nullable columns to the `rides` table: `rating` (integer), `ratingComment` (text), `ratedAt` (timestamptz), `ratedBy` (uuid → `users.id` FK). | +6 / 0 |
| `packages/shared-db/src/migrations/0001_ride_rating_columns.sql` (new) | Hand-written migration (per Task 0a convention — `drizzle-kit@0.26.2` cannot auto-generate for this schema's `numeric` columns): `ALTER TABLE rides ADD COLUMN` ×4, then `ADD CONSTRAINT rides_rated_by_users_id_fk FOREIGN KEY (rated_by) REFERENCES users(id)`. Uses `--> statement-breakpoint` separators. | +5 / 0 |
| `packages/shared-db/src/migrations/meta/_journal.json` | Append `idx: 1` entry tagging `0001_ride_rating_columns` (version 7, breakpoints true). | +6 / 0 |
| `packages/shared-db/src/migrations/meta/0001_snapshot.json` (new) | Copy of `0000_snapshot.json` with `id`/`prevId` chain updated (`prevId` = 0000's `id`), four new columns added to the `public.rides.columns` block, and `rides_rated_by_users_id_fk` added to `public.rides.foreignKeys`. | new file |
| `packages/shared-auth/src/rbac.ts` | Add `'ride:rate'` to the `Permission` union type. Add `'ride:rate'` to the `passenger` role array. Add `'ride:rate'` to the `super_admin` role array (defense-in-depth: super_admin bypasses the passenger-only check below via role escalation, but the column invariant — only one rating per ride — still holds). | +3 / −1 |
| `apps/backend/src/modules/rides/rides.controller.ts` | Add `@RequirePermissions('ride:rate')` on `rateRide`. Pass `req.user.userId` and `req.user.role as UserRole` into the service. | +1 / −1 |
| `apps/backend/src/modules/rides/rides.service.ts` | Rewrite `rateRide(id, authenticatedUserId, role, rating, comment?)`: integer-only validation; `completed`-status check; passenger-role check; passenger-ownership check (resolves `passengers.id` via the reused `getPassengerProfileByUserId` helper); friendly `ConflictException` pre-check on `ride.ratedBy !== null`; **atomic transaction** wrapping three queries on `tx`: (a) conditional `UPDATE rides SET ... WHERE id = ? AND rated_by IS NULL` with `.returning({ id })` — `ConflictException` if 0 rows (concurrent-duplicate guard); (b) `AVG(rides.rating)` over `WHERE driverId = ride.driverId AND rating IS NOT NULL`; (c) `UPDATE drivers.rating` with the parsed/formatted value. Imports `ConflictException` from `@nestjs/common`; imports `avg, and, isNull, isNotNull` from `drizzle-orm`. | +95 / −10 +2 imports |

No frontend, payment, subscription, config, `events.gateway.ts`, `state-machine.service.ts`, `ride-transitions.ts`, or `ride.types.ts` file was modified. `git diff --stat -- apps/mobile-passenger apps/mobile-driver apps/admin-web apps/tracking-web packages/shared-config` returns empty. The three pre-existing untracked files (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`, `repository-tree.txt`) were not created or modified by this task.

### Authorization model (authoritative)

Two-layer authorization, defense-in-depth:

1. **RBAC layer (controller):** `@RequirePermissions('ride:rate')` is enforced by `RolesGuard`. Per `rbac.ts`, only `passenger` and `super_admin` carry `'ride:rate'`. All other roles (driver, dispatcher, support_agent, finance_officer, safety_officer, ops_admin, system_admin, auditor, driver_applicant) get HTTP 403 from the guard.
2. **Service layer (`rateRide`):**
   - `role !== 'passenger'` → `ForbiddenException('Only passengers may rate rides')`. This rejects a `super_admin` who passed RBAC. (Rationale: an admin rating a driver on a passenger's behalf is an admin support workflow, not the rating endpoint — it belongs in a future admin-override flow if ever needed.)
   - Resolve `passengers.id` from `authenticatedUserId` via `getPassengerProfileByUserId` (reused from Task 1b). If no passenger profile exists → `ForbiddenException('No passenger profile found for this account')`.
   - `ride.passengerId !== passenger.id` → `ForbiddenException('You can only rate your own rides')`.

RBAC alone is insufficient: `'ride:rate'` membership does not encode *which* ride a passenger may rate. The `ride.passengerId === passenger.id` check is the authoritative ownership boundary.

### Rating persistence & driver aggregate recomputation

All three database operations execute inside a single `this.db.transaction(async (tx) => { ... })` block. Every query inside uses `tx` — verified by static check that no `this.db.` reference appears inside the transaction block apart from the opening `this.db.transaction(...)` call. A failure of the AVG recomputation or the `drivers.rating` write rolls back the conditional ride UPDATE, so the ride rating is never persisted without the driver aggregate reflecting it (and vice versa).

Inside the transaction:

(a) Conditional UPDATE — authoritative concurrent-duplicate guard:
```ts
const updated = await tx
  .update(rides)
  .set({ rating, ratingComment: comment, ratedAt, ratedBy: authenticatedUserId, updatedAt: ratedAt })
  .where(and(eq(rides.id, id), isNull(rides.ratedBy)))
  .returning({ id: rides.id });
// 0 rows updated  → concurrent loser → throw ConflictException (rolls back the no-op)
// 1 row updated   → winner, proceed
```

(b) Driver aggregate recomputation (D2 — no `drivers.completedRides`, no running-average algorithm):
```ts
const [avgRow] = await tx
  .select({ value: avg(rides.rating) })
  .from(rides)
  .where(and(eq(rides.driverId, driverIdForLog), isNotNull(rides.rating)));
```
`avg()` over a Postgres `integer` column returns `numeric`, which the `node-postgres` driver surfaces as a **JavaScript string** (e.g. `"4.5000000000000000"`). The value is never a JS `number`. The conversion to a `numeric(3,2)`-safe string is explicit:
```ts
const avgString = avgRow?.value;                                  // string | null | undefined
if (typeof avgString === 'string' && avgString.length > 0) {
  const parsed = parseFloat(avgString);                           // number | NaN
  if (Number.isFinite(parsed)) {                                  // rejects NaN, Infinity
    const driverRatingValue = parsed.toFixed(2);                  // "5.00", "4.50", "3.33"
    await tx.update(drivers).set({ rating: driverRatingValue })
      .where(eq(drivers.id, driverIdForLog));
  } else {
    this.logger.warn(`AVG returned non-numeric for driver ${driverIdForLog}: ${JSON.stringify(avgString)}`);
  }
} else {
  this.logger.warn(`AVG null/empty for driver ${driverIdForLog} (unreachable after rating apply)`);
}
```
Explicit handling for each Postgres return shape:
- **Normal path** (`"4.500000..."`): `parseFloat` → `4.5`; `Number.isFinite` → true; `toFixed(2)` → `"4.50"` (matches `numeric(3,2)` formatting; Postgres accepts the string and rounds/fits to scale).
- **NaN path** (unparseable string): `parseFloat` returns `NaN`; `Number.isFinite(NaN)` is `false`; warn + skip driver write (the ride UPDATE still commits inside the tx — but practically, this path is unreachable because Postgres `AVG(integer)` over at least one non-null row cannot yield a non-numeric string).
- **Null path** (`avgRow?.value == null`): `AVG` returns SQL `NULL` only if every `rides.rating` for the driver is `NULL` — impossible immediately after the conditional UPDATE just set one. Logged defensively as "unreachable".
- **Empty-string path** (`""`): `length > 0` guard rejects; logged. Defensive only — Postgres `numeric` is never returned as `""` by the driver.

`Number.isFinite` (rather than `!Number.isNaN`) is used because it rejects both `NaN` and `Infinity` in one check, and is the standard guard for "writable finite number" ahead of a DB write. `toFixed(2)` deliberately produces a 2-decimal-place string so Postgres does not need to perform scale coercion on input (it would anyway, but this matches the `numeric(3,2)` column scale exactly, eliminating any rounding ambiguity).

This re-aggregates from **every** rated ride for that driver on every submission — O(n) in the driver's rated-ride count, but simple, correct, and avoids the running-average bookkeeping bugs that motivated D2.

### Duplicate-rating guard (two layers)

**Layer 1 — friendly pre-check (outside transaction):** `ride.ratedBy !== null` → `ConflictException('This ride has already been rated')`. Provided for the common case so a second rating attempt on a ride the caller already rated (with no concurrency) returns fast without entering a transaction at all.

**Layer 2 — authoritative conditional UPDATE (inside transaction):** the ride mutation is `UPDATE rides SET ... WHERE id = ? AND rated_by IS NULL` with `.returning({ id })`. Two concurrent requests cannot both match this predicate:

- Request A wins: row mutation occurs, `rated_by` is set to A's `authenticatedUserId`. `.returning()` yields 1 row.
- Request B's UPDATE happens after A has committed (snapshot isolation) or even races on the row lock: the `rated_by IS NULL` predicate no longer matches the same row; `.returning()` yields **0 rows**. B throws `ConflictException('This ride has already been rated')` from inside the transaction, so its no-op UPDATE rolls back.

The conditional UPDATE is the **authoritative** guard because the read-then-check of `ride.ratedBy` in Layer 1 is a TOCTOU race — between the `getRide(id)` read and a non-conditional UPDATE, two requests could both observe `ratedBy === null` and both reach the UPDATE. Layer 2 turns the mutation itself into the predicate evaluation, which Postgres serializes at the row level. Layer 1 is preserved only because it produces a friendlier fast-path for the overwhelmingly common non-concurrent case.

`ConflictException` (not `BadRequestException`) is chosen because the request itself is well-formed; it is the *resource state* that conflicts — a rating already exists for this ride. `ConflictException` was previously unused in the backend (grep for `ConflictException` returned 0 hits in `apps/backend/src`); it is available from `@nestjs/common` (same package as the existing `BadRequestException`).

The `ratedBy` column is set once and never cleared (no un-rate endpoint). `rated_by IS NULL` is therefore a stable idempotency sentinel.

### Frontend contract compatibility

`apps/mobile-passenger/app/(main)/ride/[id].tsx:113-123` calls `await post('/rides/${id}/rate', { rating })`. The request body shape is unchanged (`{ rating: number }`, optional `comment`). The successful response shape is unchanged: `{ id, rating, comment }`. No frontend modification required.

`apps/mobile-driver` has no rating UI (grep confirmed) and is unaffected.

### Validation performed

Five commands, re-run after the second-pass revisions; all four `tsc --noEmit` returns explicit exit code 0 and `nest build` returns explicit exit 0 (verified via `$LastExitCode`):

1. `npx tsc --noEmit -p packages/shared-db/tsconfig.json` → **exit 0** (validates new schema columns, new migration SQL/journal/snapshot consistency via schema re-export).
2. `npx tsc --noEmit -p packages/shared-auth/tsconfig.json` → **exit 0** (validates the new `'ride:rate'` token against the `Permission` union and the role arrays).
3. `npx tsc --noEmit -p packages/shared-types/tsconfig.json` → **exit 0** (unchanged; included for completeness as Task 2a pattern).
4. `npx tsc --noEmit -p apps/backend/tsconfig.json` → **exit 0** (validates the second-pass transaction body: `db.transaction(async (tx) => ...)`, conditional `UPDATE ... WHERE id = ? AND rated_by IS NULL .returning({ id })`, the 0-rows- ConflictException throw inside the transaction, transaction-scoped `tx.update(drivers)`, `isNaN`/`Number.isFinite` AVG-guarded write, and the `isNull`/`isNotNull` imports).
5. `npm run build --workspace apps/backend` (`nest build`) → **exit 0** (artifact build succeeds — runtime AST is well-formed).

### Static verification performed

- Confirmed `ConflictException` is exported by `@nestjs/common` and was previously unused in `apps/backend/src` (grep baseline).
- Confirmed `avg`, `and`, `isNull`, `isNotNull`, `sql` are all exported by `drizzle-orm` (runtime check via `node -e`).
- Confirmed `_journal.json` parses as JSON and the new entry is present at `idx: 1`; `prevId` chain (`0001.prevId` = `0000.id`) is valid; `version: 7`, `dialect: postgresql` are consistent across snapshots.
- Confirmed `0001_snapshot.json` parses as JSON; the `public.rides.columns` block contains the four new columns in order (`rating`, `rating_comment`, `rated_at`, `rated_by`); `public.rides.foreignKeys` contains `rides_rated_by_users_id_fk`.
- Confirmed the hand-written `0001_ride_rating_columns.sql` follows 0000 conventions: `ALTER TABLE "rides" ADD COLUMN` ×4 with quoted identifiers, `--> statement-breakpoint` separators, `ADD CONSTRAINT rides_rated_by_users_id_fk FOREIGN KEY ("rated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action` matching the FK naming pattern used in 0000 (e.g. `drivers_user_id_users_id_fk`).
- Confirmed `users.ts` does not import `rides`/`passengers`/`drivers` — no schema import cycle introduced by adding `import { users }` to `rides.ts`.
- Confirmed the transaction body uses `tx` exclusively — a static check across the `db.transaction(async (tx) => { ... })` block (lines 247–311) shows zero occurrences of `this.db.` other than the opening `db.transaction(...)` call. Atomicity is structurally enforced.
- Confirmed the conditional UPDATE uses `and(eq(rides.id, id), isNull(rides.ratedBy))` — exactly one row can match (the PK constraint ensures uniqueness on `id`).
- Confirmed the AVG numeric handling rejects NaN/Infinity/empty/null explicitly via `typeof avgString === 'string' && avgString.length > 0` and `Number.isFinite(parsed)`; the value written to `drivers.rating` is a 2-decimal-place string from `toFixed(2)`, matching `numeric(3,2)` scale exactly.
- Confirmed `getPassengerProfileByUserId` (reused from Task 1b) is called outside the transaction — it has no DB writes and would not be affected by the transaction's commit/rollback boundary.

### Runtime verification not performed

Per the standing blocker (Task 0a issue #1), local PostgreSQL refuses connections (`28P01 password authentication failed for user "postgres"`). The following runtime checks are deferred until DB is available:

- Submitting a rating for a `completed` ride → expect `200 { id, rating, comment }` and a row-update verifying `rating`, `rating_comment`, `rated_at`, `rated_by` are non-null in `rides`.
- Submitting a second rating for the same ride (serial, not concurrent) → expect `409 Conflict {"message":"This ride has already been rated"}`. The Layer 1 pre-check fires first; no transaction is entered; **no row mutation**.
- **Concurrent duplicate (Layer 2 path):** issue two `POST /rides/:id/rate` requests simultaneously against the same unrated completed ride. Exactly one should succeed with `200`; the other should receive `409 {"message":"This ride has already been rated"}` from inside the transaction. The ride row should have exactly one `rated_by` value, not the second caller's. Verifies the conditional-UPDATE race guard.
- Submitting a rating with `rating: 4.5` → expect `400 {"message":"Rating must be an integer between 1 and 5"}`.
- Submitting a rating for a ride whose `passengerId ≠ passengers.id resolved from req.user.userId` → expect `403 {"message":"You can only rate your own rides"}`.
- Driver aggregate: submit ratings of 4 → 5 → 3 for a driver's three completed rides; expect `drivers.rating` to converge to `4.00` (numeric(3,2) scale verified by `toFixed(2)` write path).
- Driver aggregate isolation: submit one rating for driver A and another for driver B; expect `drivers.rating` updates to apply only to each driver's column (the `WHERE driverId = ?` predicate is parameter-bound; no cross-contamination).
- Transaction rollback: artificially force the `drivers.rating` UPDATE to fail (e.g. by temporarily changing the column write to a too-large value or by removing the `CALLED ON NULL INPUT` setting). The conditional ride UPDATE must roll back — verify no `rating`/`rated_by` values persisted on the ride row.
- RBAC: a `driver`-role token hitting `POST /rides/:id/rate` → expect `403` from `RolesGuard` before the service runs.

### Schema decisions recap (D1-D5)

- **D1 (approved):** Rating columns on `rides`, no `ratings` table. ✓ Implemented.
- **D2 (approved):** Live `AVG()` recomputation, no `drivers.completedRides` use, no running-average algorithm. ✓ Implemented.
- **D3 (approved):** `'ride:rate'` permission added to `passenger` (RBAC) and `super_admin` (RBAC); service still enforces passenger-only + ownership. ✓ Implemented.
- **D4 (approved):** Integer-only ratings, reject fractional via `Number.isInteger(rating)`. ✓ Implemented.
- **D5 (approved):** New migration `0001_ride_rating_columns.sql` with journal + snapshot entries; `drizzle-kit` not run (per Task 0a). ✓ Implemented.
- **Duplicate rating:** `ConflictException` (not `BadRequestException`). ✓ Implemented.

### Files NOT changed (intentional)

- `apps/mobile-passenger/app/(main)/ride/[id].tsx` — request/response contract preserved; no frontend change required.
- `apps/mobile-driver/**` — no rating UI exists; unaffected.
- `packages/shared-db/src/schema/drivers.ts` — `drivers.rating` and `drivers.completedRides` columns unchanged; `rating` is overwritten via `UPDATE`, `completedRides` is left at its default per D2.
- `packages/shared-db/src/schema/passengers.ts` — `passengers.rating` is unrelated (passenger self-rating, not in scope); unchanged.
- `packages/shared-types/src/ride.types.ts` — `RideStatus` unchanged; rating is not a status transition.
- `apps/backend/src/modules/rides/state-machine.service.ts`, `ride-transitions.ts` — rating is not a state transition; state machine untouched.
- `apps/backend/src/modules/events/events.gateway.ts` — rating does not broadcast in this task (the passenger who rates already knows their own rating; the driver receives no real-time event for ratings — could be a future enhancement if driver push notifications are added).

### Revisions (second-pass corrections applied before commit)

Three correctness gaps were identified in the first-pass implementation and corrected before any commit:

1. **Concurrent-duplicate prevention (race condition).** The first pass read `ride.ratedBy`, checked `is null`, then ran an unconditional `UPDATE rides SET ... WHERE id = ?`. Two concurrent requests could both observe `ratedBy === null` and both commit a row mutation, with the second silently overwriting the first's `rating`/`ratedBy`/`ratedAt` values. **Fix:** kept the friendly pre-check on `ride.ratedBy !== null` (fast-path for the common case) but made the **authoritative** guard the conditional UPDATE itself: `WHERE id = ? AND rated_by IS NULL .returning({ id })`, run inside the transaction. If `.returning()` yields 0 rows, throw `ConflictException('This ride has already been rated')` from inside the transaction so Postgres rolls back the no-op and Nest's exception filter surfaces the 409.
2. **Atomicity of persistence + aggregate recomputation.** The first pass ran the ride UPDATE, then a separate SELECT for `AVG(rides.rating)`, then a separate UPDATE of `drivers.rating` — three independent statements on `this.db`. A failure of the AVG or the drivers UPDATE would leave the ride already-rated state committed without a matching driver aggregate (or, in the converse direction, a driver rating recomputation from a race-loser that the ride row's `rated_by` no longer reflects — though this is prevented by Layer 2's conditional UPDATE). **Fix:** wrapped all three statements in `this.db.transaction(async (tx) => { ... })`. Every query inside uses `tx`; the only `this.db.` reference in the block is the opening `this.db.transaction(...)` call (verified statically). A failure of the AVG recomputation or the driver UPDATE rolls back the conditional ride UPDATE, so a ride is never persisted as already-rated without a corresponding driver aggregate write.
3. **AVG numeric conversion safety.** The first pass cast the AVG result with `Number(avgRow.value)` and wrote `newDriverRating.toString()`. Two failure modes were possible:
   - `AVG(integer)` over Postgres returns `numeric`; the `node-postgres` driver serializes `numeric` as a **JS string** (e.g. `"4.5000000000000000"`), not a `number`. `Number("4.5000...")` happens to be `4.5`, so the value was correct, but the type system inferred `number` for what is actually `string | null`, masking future regressions.
   - `Number("") === 0` and `Number(null) === 0` (the latter via duck-typed coercion in some enclosing expressions); a future bug that produces empty/null/NaN could write `0` to a `numeric(3,2)` column whose minimum valid value is `1.00`, silently corrupting the driver's aggregate.
   **Fix:** explicit per-shape handling — `typeof avgString === 'string' && avgString.length > 0` rejects null/undefined/empty; `parseFloat(avgString)` rejects malformed strings; `Number.isFinite(parsed)` rejects `NaN` and `Infinity`; `parsed.toFixed(2)` produces a 2-decimal-place string that matches the `numeric(3,2)` column scale exactly, eliminating any Postgres-side scale coercion ambiguity. Each path logs distinctly.

All five validation commands were re-run after the revisions; all returned explicit exit 0 (see "Validation performed" above).

### Recommended next task

**Task 2d — Ride-history endpoints** (per audit §13 Step 2 task 2d): the `getPassengerRides`/`getDriverRides` service methods exist (`rides.service.ts:222-238`) but no controller routes expose them, and no RBAC `ride:view_own` or analogous permission covers "list my own rides" (current `ride:view` is broad/ambiguous). Independent of Task 2c.

(Note: per instruction, Task 2d is NOT to be begun here. This recommendation is for the next session.)

## Task 2d — Fix ride-history correctness

**Date:** 2026-07-26
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); database-backed verification remains blocked by the documented PostgreSQL `28P01` authentication failure.
**Implementation commit:** `76ea4a3` (`fix(rides): correct authenticated ride history queries`)

### Problem and root cause

The passenger activity screen called `GET /rides/my-rides`, but the backend exposed no matching route. The only history service methods accepted caller-supplied `passengers.id` or `drivers.id`, had no offset, trusted their limit, ordered only by `createdAt`, and selected complete ride rows. They therefore could not safely establish ownership from the authenticated JWT and would have exposed fields not required by a history list if wired directly.

The adjacent authenticated `GET /rides/:id` route also returned any ride to any passenger or driver with `ride:view`; it enforced permission membership but not ride ownership.

### Files changed

- `apps/backend/src/modules/rides/rides.controller.ts`
- `apps/backend/src/modules/rides/rides.service.ts`
- `docs/recovery/PHASE-2-RECOVERY-LOG.md`

No frontend, shared package, schema, migration, configuration, or generated file changed.

### Implemented behavior

- Added `GET /api/v1/rides/my-rides` before the dynamic `:id` route.
- The route accepts only authenticated callers with `ride:view` and derives identity exclusively from `req.user.userId` and `req.user.role`; it accepts no passenger or driver profile ID.
- Passenger requests resolve `passengers.id` through `passengers.userId = users.id` before filtering `rides.passengerId`.
- Driver requests resolve `drivers.id` through `drivers.userId = users.id` before filtering `rides.driverId`.
- A missing passenger profile produces the established explicit `ForbiddenException`; a missing driver profile produces an explicit `NotFoundException`. Roles other than `passenger` or `driver` are rejected by the history service. `driver_applicant` does not have `ride:view`; an inactive driver who still has the approved `driver` role may read their own history because the endpoint is read-only.
- Pagination defaults to `limit=20` and `offset=0`. `limit` must be a safe integer from 1 through 100; `offset` must be a safe integer from 0 through 10,000. Invalid, fractional, negative, zero-limit, non-numeric, unsafe, or excessive values return `BadRequestException`.
- Results use deterministic `createdAt DESC, id DESC` ordering and include every status, matching the passenger screen's chronological “Your Rides” activity contract rather than introducing a new lifecycle filter.
- The response remains a JSON array. It contains only the fields consumed by the mobile history contract, converts Drizzle numeric coordinates to JavaScript numbers, and exposes `fare` in GHS from `actualFarePesewas ?? estimatedFarePesewas`. It excludes the verification PIN, actor IDs, cancellation reason, rating metadata, and other full-row fields.
- Hardened authenticated `GET /api/v1/rides/:id`: passengers may view only rides whose `passengerId` matches their resolved passenger profile; drivers may view only rides whose `driverId` matches their resolved driver profile. Existing `super_admin` access remains available. Internal service calls continue using the unchanged raw `getRide` method.
- Existing cancellation, rating, dispatch, public tracking, driver earnings, and admin ride-list paths were not changed.

### Validation results

- `npm run build --workspace @kansride/backend` — PASS.
- `npx tsc --noEmit -p apps/backend/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/mobile-driver/tsconfig.json` — PASS.
- Focused search found no corrected history comparison between authenticated `users.id` and `rides.passengerId` or `rides.driverId`.
- No configured backend unit-test framework or focused test suite exists, so no automated test file was added.
- `git diff --check` — PASS before staging.

### Runtime limitations and remaining risks

No database-backed HTTP scenarios were run. The standing repository blocker is PostgreSQL SQLSTATE `28P01`; credentials and database configuration were intentionally left unchanged. Passenger/driver ownership, missing-profile errors, pagination rejection, ordering, and response serialization therefore remain runtime-unverified.

The driver mobile app currently has no ride-history list caller; it can use the role-aware route later without a profile ID. `/drivers/earnings` already resolves `drivers.id` from the JWT user and remains unchanged. The `drivers.completedRides` and `passengers.completedRides` columns remain unmaintained and are not used by this history endpoint.

## Task 2e — Normalize canonical ride types

**Date:** 2026-07-26
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); database-backed verification remains blocked by the documented PostgreSQL `28P01` authentication failure.
**Implementation commit:** `c49d639` (`fix(rides): normalize canonical ride types`)

### Selection and reconciliation

Task 2e was selected because both `RECOVERY_PLAN.md` and the audit's Step 2 order place ride-type normalization immediately after completed Task 2d. The recovery log also ended with Task 2d complete. `PROJECT_STATE.md` and `RECOVERY_PLAN.md` still described Task 2d as next, but current code and commits `76ea4a3` / `1eff349` proved that statement stale; the source-of-truth documents were advanced to Task 2f after this implementation.

### Defects and root cause

- **N1 — High:** `apps/mobile-passenger/app/(main)/home.tsx` sent `standard` or `comfort`, while the shared type, Drizzle schema, and migration allow only `standard_tricycle`, `priority_tricycle`, `shared`, and `parcel_delivery`. Every passenger request therefore reached PostgreSQL with an invalid enum value.
- **N2 — High:** the controller, service, and fare service accepted a free-form string, and persistence used `data.rideType as any`. An arbitrary client could bypass compile-time types and receive an opaque database failure instead of a client error.
- **N3 — Medium:** the premium client option was labelled and stored as `comfort`, but the only premium fare rule is the 1.5× multiplier for `priority_tricycle`. The UI value, persisted enum, and fare rule had no common identifier.

The root cause was a passenger-local duplicate union that diverged from `@kansride/types`, combined with no runtime validation before the database enum became the last line of defense.

### Implementation

- The passenger home screen and active-ride store now use the shared `RideType` union.
- The visible options deliberately map `Standard` to `standard_tricycle` and `Priority` to `priority_tricycle`; the request and local active-ride state retain those canonical values.
- `RidesController` and `FareService` now type the field as `RideType`.
- `RidesService` validates the runtime value against all four schema-supported values before passenger lookup, maps, fare calculation, insert, or dispatch.
- Only an omitted value defaults to `standard_tricycle`. Legacy `standard` / `comfort`, null, empty, non-string, case-mismatched, or otherwise unsupported values produce `BadRequestException` with the allowed values.
- Fare calculation and persistence use the same validated value. The unsafe ride-type `as any` cast was removed.
- The existing `priority_tricycle` 1.5× fare multiplier is preserved. `shared` and `parcel_delivery` remain valid API/schema values but are not newly exposed in the passenger selector.
- No identity, RBAC, ride-history, cancellation, rating, status-transition, event, schema, or migration behavior changed.

### Files changed

Implementation commit:

- `apps/backend/src/modules/rides/fare.service.ts`
- `apps/backend/src/modules/rides/rides.controller.ts`
- `apps/backend/src/modules/rides/rides.service.ts`
- `apps/mobile-passenger/app/(main)/home.tsx`
- `apps/mobile-passenger/src/stores/ride-store.ts`

Documentation-only follow-up:

- `docs/recovery/PHASE-2-RECOVERY-LOG.md`
- `docs/recovery/PROJECT_STATE.md`
- `docs/recovery/RECOVERY_PLAN.md`
- `docs/recovery/ARCHITECTURE_NOTES.md`

### Validation

- `npx tsc --noEmit -p packages/shared-types/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/backend/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json` — PASS.
- `npm run build --workspace @kansride/backend` — PASS.
- Focused in-memory `npx tsx --tsconfig apps/backend/tsconfig.json -` smoke — PASS. It verified the omitted default and all four canonical values reach both fare calculation and persistence unchanged, while `standard`, `comfort`, empty, null, non-string, object, and case-mismatched inputs fail with status 400 before database access.
- No workspace defines a test script and no configured unit-test framework exists.
- `git diff --check` — PASS before documentation commit.

### Runtime limitations and next task

No PostgreSQL-backed `POST /rides` request was run because the standing SQLSTATE `28P01` authentication blocker remains. Credentials and database configuration were not changed. Persistence against the real enum and the end-to-end passenger request remain runtime-unverified.

The next incomplete task is **Task 2f — normalize the create-ride fare response**. It must reconcile pesewa transport fields with the passenger's GHS display without changing money semantics incidentally. Task 2f was not started here.

## Task 2f — Normalize the create-ride fare response

**Date:** 2026-07-26
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); database-backed verification remains blocked by the documented PostgreSQL `28P01` authentication failure.
**Implementation commit:** `d66b314` (`fix(rides): normalize create-ride fare response`)

### Selected fare contract

- Database and backend calculation: numeric integer pesewas.
- REST and event payloads: numeric integer pesewas with explicit `Pesewas` suffixes.
- Shared TypeScript contracts and mobile/web state: numeric integer pesewas with the same names.
- UI display: one conversion at the presentation boundary to `GHS 0.00`; invalid or missing values render `--`.
- `POST /rides` remains authoritative. Its `estimatedFarePesewas` and pesewa-suffixed `fareBreakdown` replace any client-side value after creation.

This contract follows the existing integer columns in `packages/shared-db/src/schema/rides.ts`, the pesewa constants in `packages/shared-config/src/constants.ts`, and the existing payment/subscription convention. No schema or migration change was required.

### Defects and root cause

- **F1 — High:** `apps/mobile-passenger/app/(main)/home.tsx` read `response.estimatedFare`, but `RidesService.createRide` returned `estimatedFarePesewas`. The missing field caused the client to ignore the backend-calculated fare.
- **F2 — High:** the passenger then fell back to a local GHS formula (`5 + distance × 3`) and stored it as `estimatedFare`. That formula differed from `FareService`, omitted duration, and did not recompute for `priority_tricycle`, so the active ride could show a non-authoritative fare.
- **F3 — Medium:** `FareService` and `fareBreakdown` used ambiguous names such as `totalFare` even though every value was in pesewas. Shared `Ride` fields repeated the ambiguity.
- **F4 — Medium:** ride history converted to GHS in the backend and returned a generic `fare`, unlike other integer-pesewa transport fields.
- **F5 — Medium:** tracking, admin ride/revenue, driver offer/state, and driver earnings contracts transported pesewas under unitless names. Their displays usually divided by 100 correctly, but the payload contract did not make the unit enforceable.
- **F6 — Low:** several displays formatted raw values directly or substituted zero. A missing, fractional, negative, or `NaN` value could be misrepresented instead of producing a safe placeholder.

The root cause was a correct database convention that was not carried through shared response types and client state. Local frontend interfaces independently assigned names and presentation units.

### Implementation

- Added shared `FareBreakdown` and `CreateRideResponse` contracts with numeric pesewa-suffixed fields.
- Renamed fare-calculation components to explicit pesewa names while preserving integer `Math.ceil` rounding, the GHS 3.00 minimum, and the existing 1.5× priority multiplier.
- Persisted and returned the same `totalFarePesewas` value from `POST /rides`.
- Removed the passenger's provisional local formula and fallback. The active ride now stores `response.estimatedFarePesewas` and uses the backend-echoed canonical ride type.
- Changed passenger history to transport `farePesewas` and convert only in the activity screen.
- Normalized tracking, admin, driver offer/state, and driver earnings payload names to explicit pesewa fields, updating every discovered caller.
- Standardized affected displays on `GHS` and guarded formatting against invalid or missing numeric input.
- Preserved ride creation identity resolution, dispatch triggering, canonical ride types, cancellation, rating, history authorization/pagination/order, statuses, schema, and migrations.

### Files changed

- `packages/shared-types/src/ride.types.ts`
- `apps/backend/src/modules/rides/fare.service.ts`
- `apps/backend/src/modules/rides/rides.service.ts`
- `apps/backend/src/modules/drivers/drivers.service.ts`
- `apps/backend/src/modules/admin/admin.service.ts`
- `apps/mobile-passenger/app/(main)/home.tsx`
- `apps/mobile-passenger/app/(main)/ride/[id].tsx`
- `apps/mobile-passenger/app/(main)/activity.tsx`
- `apps/mobile-passenger/src/stores/ride-store.ts`
- `apps/mobile-driver/src/api/socket.ts`
- `apps/mobile-driver/src/stores/driver-store.ts`
- `apps/mobile-driver/app/(main)/home.tsx`
- `apps/mobile-driver/app/(main)/earnings.tsx`
- `apps/tracking-web/src/app/track/[rideId]/page.tsx`
- `apps/admin-web/src/lib/hooks.ts`
- `apps/admin-web/src/lib/currency.ts`
- `apps/admin-web/src/app/dashboard/page.tsx`
- `apps/admin-web/src/app/dashboard/rides/page.tsx`
- `apps/admin-web/src/app/dashboard/subscriptions/page.tsx`

### Validation

- `npm run build --workspace=packages/shared-types` — PASS.
- `npx tsc --noEmit -p packages/shared-types/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/backend/tsconfig.json` — PASS.
- `npm run build --workspace=apps/backend` — PASS.
- `npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/mobile-driver/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/tracking-web/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/admin-web/tsconfig.json` — FAIL only on the four previously documented `../../../../lib/hooks` import errors and their resulting implicit-`any` errors. No Task 2f fare-type error was reported; the Task 4a imports were intentionally not changed.
- Focused in-memory create-response probe — PASS. It verified standard minimum fare (300 pesewas), a decimal-distance/time standard fare (402 pesewas), the same priority fare at 1.5× (603 pesewas), integer persistence, numeric response type, matching breakdown total, and absence of the ambiguous legacy response names.
- Focused display probe — PASS for `300 → GHS 3.00`, `603 → GHS 6.03`, and invalid/missing inputs → `--`.
- A direct compiled-JavaScript probe was unsuitable because the workspace package entry points use source ESM imports; the equivalent `tsx` probe passed when rerun outside the sandbox after its worker initially received `EPERM`.
- No workspace defines a test script and no configured test framework exists, so no permanent test file was added.
- `git diff --check` and `git diff --cached --check` — PASS before the implementation commit.

### Runtime limitations and next task

No PostgreSQL-backed `POST /rides`, history, tracking, earnings, or admin request was run because the standing SQLSTATE `28P01` authentication blocker remains. Credentials and database configuration were not changed. End-to-end persistence and serialization therefore remain runtime-unverified.

The next verified recovery item is **Task 3a — broadcast all ride state changes**, as ordered by `RECOVERY_PLAN.md` after completion of Tasks 2e–2f. Task 3a was not started here.

## Task 3a — Broadcast all committed ride state changes

**Date:** 2026-07-26
**Branch:** `recovery/phase-2-opencode`
**Status:** Complete (static); database-backed Socket.IO verification remains blocked by the documented PostgreSQL `28P01` authentication failure.
**Implementation commit:** `57f14de` (`fix(realtime): broadcast committed ride state changes`)

### Event inventory and defects

- **E1 — High — `RidesService.updateStatus`:** the database status changed, but the method emitted no event. Arrival, start, intermediate, and completion changes were invisible until a refresh. Correct behavior is one canonical update after the write succeeds.
- **E2 — High — `DispatchService.dispatchRide` / timeout paths:** `searching`, `driver_offered`, and `no_driver_found` were persisted without events. `searching` was also written after offers were created, allowing it to overwrite `driver_offered`. Correct behavior is ordered conditional persistence followed by one event per successful transition.
- **E3 — Critical — `DispatchService.driverAcceptRide`:** a read followed by an unconditional update allowed concurrent drivers to pass the availability check and assign the same ride. The gateway could then broadcast multiple successful assignments. Correct behavior is one conditional assignment winner and zero events for losers.
- **E4 — High — `RidesController.updateStatus` / `RidesService.updateStatus`:** the route did not pass JWT identity or role, so the service used actor `system`; valid driver transitions failed, and assignment ownership was not checked. Cancellation also lacked passenger/driver ownership checks. Correct behavior is profile-ID resolution and authorization before persistence or emission.
- **E5 — Medium — `EventsGateway.handleDriverAcceptRide`:** acceptance emitted a separate `ride:driver-assigned` shape before the accepting driver had joined the room. Passenger code listened to both that event and `ride:update`, creating incompatible update paths. Correct behavior is one typed `ride:update`, with the successful driver joined before room emission.
- **E6 — Medium — mobile listeners:** passenger and driver stores expected simplified statuses such as `en_route`, `arrived`, or `cancelled`, while the backend persists canonical enum values. The driver’s local acceptance state also skipped `driver_assigned` and configured intermediate states. Correct behavior is canonical socket input with deliberate local UI mapping.
- **E7 — Medium — mutation/event failure reporting:** an exception during synchronous socket emission could surface as a failed request after the database had already committed. Correct behavior is to log delivery failure without representing the committed mutation as rolled back.
- **E8 — Medium — `DispatchService.offerToDrivers`:** the ride became `driver_offered` even when every nearby driver lacked an active subscription. Correct behavior is to enter that state only after at least one Redis offer is stored.

### Implemented persistence and emission boundaries

| Mutation | Persistence boundary | Event and recipient |
| --- | --- | --- |
| Create ride | `INSERT ... RETURNING` resolves with status `requested` | One `ride:update` to the authenticated passenger’s user sockets |
| Begin dispatch | Conditional `requested → searching` update returns a row | One `ride:update` to `ride:{rideId}` |
| Store eligible offers | At least one Redis offer is stored, then conditional `searching → driver_offered` returns a row | One lifecycle `ride:update` to the ride room; Task 3b still owns driver-targeted `ride:offered` |
| Accept ride | Conditional update requires an offerable status and `driver_id IS NULL` | Gateway joins the winning driver socket, then emits one `ride:update` with `driver_assigned` |
| No driver found | Conditional update from `searching` / `driver_offered` returns a row | One `ride:update` to the ride room |
| Driver/admin status update | Ownership/actor validation, then compare-and-set update on the previously read status | One `ride:update` to the ride room |
| Cancel ride | Role, ownership, and transition validation, then compare-and-set update | One `ride:update` to the ride room plus the retained `ride:cancelled` notification to the assigned driver |
| Driver location | Redis geo update succeeds; debounced driver-row write succeeds when due | Existing `ride:driver-location` to the active ride room; this is location telemetry, not a ride-status transition |

Ride decline only deletes an offer and does not change `rides.status`, so it emits no lifecycle update. Task 2c rating runs in a database transaction but does not change lifecycle status, so it also emits no lifecycle update. No lifecycle mutation currently uses a database transaction; the resolved conditional write is its commit boundary.

### Payload and client contract

`RideUpdatePayload` is shared by the backend and both mobile clients. The serializer selects only:

- `rideId`, canonical `status`, optional `previousStatus`;
- assigned `driverId` and canonical `rideType`;
- integer `estimatedFarePesewas` and nullable integer `actualFarePesewas`;
- ISO `createdAt` and `updatedAt`;
- cancellation metadata only for cancellation events.

The compatibility `reason` field remains alongside `cancellationReason`; no unitless fare field was restored. Coordinates, passenger identifiers, verification PINs, ratings, and full database rows are not broadcast.

Passenger state maps canonical statuses into its reduced presentation states and ignores an event for a different active ride. The duplicate `ride:driver-assigned` listener was removed. Driver state now begins at `driver_assigned`, follows the configured intermediate statuses, consumes the shared payload, and reads current Zustand state inside the socket callback rather than a stale render closure.

### Room and authorization behavior

- Creation is user-targeted because the ride room normally has no subscribers before `POST /rides` returns.
- Subsequent lifecycle events are scoped to `ride:{rideId}`; no private ride payload is globally broadcast.
- The accepting driver is role-checked, resolved through `drivers.userId = JWT users.id`, and joined to the room only after winning the conditional assignment.
- Driver status and cancellation operations compare the resolved `drivers.id` with `rides.driverId`. Passenger cancellation compares resolved `passengers.id` with `rides.passengerId`.
- The existing `ride:subscribe` handler still permits any authenticated socket to request an arbitrary ride room. This authorization gap was not redesigned because Task 3d owns the public/private tracking decision; it remains a documented security risk.
- No admin room or admin realtime consumer exists. Tracking web still cannot authenticate to the `/rides` namespace.

### Files changed

- `packages/shared-types/src/ride.types.ts`
- `apps/backend/src/modules/rides/ride-event.payload.ts`
- `apps/backend/src/modules/rides/rides.controller.ts`
- `apps/backend/src/modules/rides/rides.service.ts`
- `apps/backend/src/modules/rides/dispatch.service.ts`
- `apps/backend/src/modules/events/events.gateway.ts`
- `apps/mobile-passenger/src/api/socket.ts`
- `apps/mobile-passenger/src/stores/ride-store.ts`
- `apps/mobile-passenger/app/(main)/home.tsx`
- `apps/mobile-passenger/app/(main)/ride/[id].tsx`
- `apps/mobile-driver/src/api/socket.ts`
- `apps/mobile-driver/src/stores/driver-store.ts`
- `apps/mobile-driver/app/(main)/home.tsx`

No schema, migration, database credential, environment configuration, admin source, or tracking source file changed.

### Validation

- `npm run build --workspace=@kansride/types` — PASS.
- `npx tsc --noEmit -p apps/backend/tsconfig.json` — PASS.
- `npm run build --workspace=@kansride/backend` — PASS.
- `npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/mobile-driver/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/tracking-web/tsconfig.json` — PASS.
- `npx tsc --noEmit -p apps/admin-web/tsconfig.json` — FAIL only on the four previously documented missing `../../../../lib/hooks` imports and their resulting implicit-`any` errors. Task 3a changed no admin file.
- `npm test --workspaces --if-present` — PASS with no test scripts executed. No workspace has a configured unit-test framework.
- Temporary `npx tsx` mocked event probe — PASS. It covered successful and failed creation; successful driver en-route, arrival, start, and completion transitions; conditional-update conflict and persistence failure with zero events; cancellation recipients; successful acceptance with one event; rejected acceptance with zero events; and integer-pesewa payload fields. The temporary probe was removed before staging.
- `git diff --check` and `git diff --cached --check` — PASS before the implementation commit.
- Schema and migration diff — empty.

### Runtime limitations and remaining risks

No PostgreSQL/Redis/Socket.IO end-to-end run was completed because PostgreSQL still rejects the local credentials with SQLSTATE `28P01`. Credentials and database configuration were not changed. Transaction/conditional-write behavior therefore remains runtime-unverified against PostgreSQL.

Socket.IO delivery is best effort: there is no outbox, acknowledgement, replay, or multi-instance Redis adapter. A successful database change can be logged when delivery throws, but it cannot be replayed automatically. Room membership authorization, tracking authentication, assignment enrichment, offer indexing/cleanup, and actual `ride:offered` delivery remain incomplete.

The next verified recovery task is **Task 3b — emit driver offers**. Task 3b was not started here.

## Autonomous Section A / Task 3b — Authenticated driver offer delivery

**Date:** 2026-07-26
**Status:** Implemented and statically validated; runtime database/Redis verification remains pending.
**Implementation commit:** `bd4abe3` (`fix(dispatch): deliver authenticated driver ride offers`)

### Defects

- **A1 — Critical:** Redis offers had no `ride:offered` producer.
- **A2 — High:** eligibility checked only subscription and sliced geo results before filtering.
- **A3 — High:** no ride/driver offer indexes existed, preventing deterministic cleanup and reconnect recovery.
- **A4 — High:** acceptance trusted key existence without validating recipient, expiry, or current eligibility.
- **A5 — Medium:** offer distance had an ambiguous unit and no explicit expiry or shared canonical type.
- **A6 — High:** the driver app created an active ride optimistically before acceptance succeeded.
- **A7 — Medium:** decline did not validate ownership and could not return an exhausted offer round to searching.

### Implementation

- Added shared `RideOfferPayload` and `RideAcceptResult`.
- Deterministically filters geo candidates by distance and ID, then requires verified active driver user, active/online driver, recent non-null location, active tricycle, current subscription, and no active assigned ride.
- Stores TTL-bound offers plus ride and driver Redis indexes; cleanup covers acceptance, competing offers, cancellation, decline, expiry/terminal failure, and stale recovery.
- Emits `ride:offered` only to the addressed driver’s authenticated user sockets after `driver_offered` persists.
- Replays still-valid pending offers via authenticated `driver:get-offers`.
- Revalidates offer recipient, expiry, eligibility, and ride availability before the existing atomic assignment.
- Uses explicit `distanceToPickupMeters`, canonical `rideType`, integer `estimatedFarePesewas`, and ISO expiry. No passenger contact, user ID, or verification PIN is exposed.
- Driver acceptance now waits for `ride:accept-result`; decline removes only that driver’s offer.

### Validation

- Shared-types build — PASS.
- Backend TypeScript check and production build — PASS.
- Driver mobile TypeScript check — PASS.
- Focused mocked dispatch probe — PASS for targeting, minimized payload, pending recovery, acceptance, competing rejection, cleanup, decline-to-searching, and pesewa/unit fields.
- `git diff --check` — PASS; schema/migration diff empty.

### Runtime limitation

PostgreSQL/Redis/Socket.IO end-to-end delivery remains pending Section E–G service recovery. No credentials or configuration were changed.

## Autonomous Section B — Private realtime room authorization

**Date:** 2026-07-26
**Status:** Implemented and statically validated; runtime Socket.IO verification remains pending.
**Implementation commit:** `9b89f47` (`fix(realtime): authorize private socket room membership`)

### Defects and implementation

- **B1 — Critical:** `ride:subscribe` allowed any authenticated user into any private ride room. It now loads only ride ownership IDs, resolves the JWT user through `passengers.userId` or `drivers.userId`, and permits only the owning passenger or assigned driver.
- **B2 — High:** mobile connection helpers returned before connection, so initial joins were dropped and reconnect lost membership. Both clients now await connection, remember intended ride IDs, and resubscribe on reconnect.
- **B3 — Medium:** malformed IDs could reach database handlers, no leave handler existed, and admin membership had no contract. UUID validation runs before queries, `ride:unsubscribe` is implemented, and `admin:rides` requires explicit live-operations permissions.

Targeted offers remain direct user-socket events and do not grant unassigned drivers private ride-room access. Public tracking remains outside the private room contract for Section C.

### Validation

- Backend TypeScript and build — PASS.
- Passenger and driver TypeScript checks — PASS.
- Focused mocked room probe — PASS for owner passenger, assigned driver, unrelated-user rejection, malformed input without DB access, permission-gated admin join, and leave.
- `git diff --check` — PASS.

