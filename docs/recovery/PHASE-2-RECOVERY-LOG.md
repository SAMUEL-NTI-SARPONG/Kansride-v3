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
  `createRide` throws `ForbiddenException` → HTTP `403
  {"statusCode":403,"message":"No passenger profile found for this
  account","error":"Forbidden"}`. This respects role separation and
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
`AdminController`**, per audit §13 Step 1, task 1c. (The audit's Task 1b,
"Fix `UsersService.getProfile`", can also be done here — both are
independent of Task 1b as scoped in this session's prompt.) Until the
PostgreSQL credential blocker is resolved, runtime verification of any
further backend changes remains static-only.

---

*End of Task 1b entry.*