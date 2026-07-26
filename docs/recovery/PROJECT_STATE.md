# KansRide Project State

**Last verified:** 2026-07-26
**Operational status:** Phase 2 recovery in progress; static recovery work is complete through Task 2f
**Current branch:** `recovery/phase-2-opencode`
**Latest recovery implementation:** Task 2f at commit `d66b314`
**Latest tagged checkpoint:** tag `phase2-task2e-complete` at commit `87eea07`
**Context documentation checkpoint:** tag `phase2-context-docs-complete`

## Purpose

This document is the current operational source of truth for KansRide recovery. It records what is confirmed in the repository now, what remains limited or unverified, and the boundary for the next approved task.

Use `RECOVERY_PLAN.md` for recovery sequencing and acceptance criteria. Use `ARCHITECTURE_NOTES.md` for implementation-level architecture and invariants. The older `PHASE-2-AUDIT.md` and `PHASE-2-RECOVERY-LOG.md` remain historical evidence; where they conflict with current code or this document, re-inspect the repository and update this document.

## Confirmed Current State

### Product and recovery status

KansRide is an npm-workspaces monorepo for a Ghanaian tricycle ride-hailing platform. It contains passenger and driver mobile clients, an administrative web client, a public ride-tracking web client, and a NestJS backend.

The active recovery branch contains completed static recovery work through Task 2f. Work through this point has repaired backend environment startup, identity mapping, profile handling, authorization, cancellation, rating, actor-scoped ride history, canonical ride types, and the integer-pesewa fare contract. Database-dependent runtime verification remains blocked; therefore, “complete” recovery tasks below mean implemented and statically validated unless stated otherwise.

No completion percentage is assigned.

### Monorepo structure

The root `package.json` defines npm workspaces as `apps/*` and `packages/*`.

| Path | Workspace | Confirmed role |
| --- | --- | --- |
| `apps/backend` | `@kansride/backend` | NestJS REST API, Socket.IO gateway, dispatch, auth, rides, drivers, admin, persistence integration |
| `apps/admin-web` | `@kansride/admin-web` | Next.js administrative dashboard on development port 3001 |
| `apps/tracking-web` | `@kansride/tracking-web` | Next.js public ride-tracking client on development port 3002 |
| `apps/mobile-passenger` | `@kansride/mobile-passenger` | Expo Router passenger mobile application |
| `apps/mobile-driver` | `@kansride/mobile-driver` | Expo Router driver mobile application |
| `packages/shared-types` | `@kansride/types` | Shared TypeScript domain and API types |
| `packages/shared-config` | `@kansride/config` | Zod environment parsing, business constants, ride transitions |
| `packages/shared-db` | `@kansride/db` | Drizzle schema, PostgreSQL connection, and SQL migrations |
| `packages/shared-auth` | `@kansride/auth` | JWT, OTP, Ghana phone utilities, and RBAC |
| `packages/design-system` | `@kansride/ui` | React Native theme and reusable UI components |

The design-system currently exports `Button`, `TextInput`, `OTPInput`, `Card`, and `BottomSheet`, plus theme and colour primitives. No current application source import of `@kansride/ui` was found. This corrects the older audit’s now-stale statement that the component files were absent.

### Confirmed technology stack

- Node.js 24 is used by `.nvmrc` (`24.13.0`) and CI; the root engine requirement is Node.js 22 or newer.
- npm workspaces manage the monorepo.
- TypeScript 5.6 is configured across the repository.
- NestJS 10 provides the backend, with class validation, scheduling, and throttling.
- PostgreSQL with PostGIS is the database target.
- Drizzle ORM and Drizzle Kit define the schema and migrations.
- Redis is used for dispatch offers and driver geospatial indexing, with an in-memory service when `REDIS_URL` is absent.
- Socket.IO provides the `/rides` real-time namespace.
- Next.js 15 and React 18 provide the admin and tracking web clients.
- Expo SDK 52, Expo Router 4, React Native 0.76, Zustand, and TanStack Query provide the mobile clients.
- Provider abstractions exist for SMS, mapping/distance, and payments; mock implementations remain part of the current runtime design.

### Git checkpoint

The current recovery checkpoints are:

- `phase2-task2e-complete` points to `87eea07`, including the Task 2e implementation and its hash-recording documentation commit.
- Task 2f is implemented at `d66b314`; no Task 2f tag exists.
- `phase2-task2d-complete` remains immutable at `1eff349`.
- `phase2-task2c-complete` remains immutable at `db5576f`.
- `phase2-context-docs-complete` identifies the documentation-only commit containing this source-of-truth set.
- The working tree is expected to contain only the two protected untracked generated files listed below after task documentation is committed.
- No recovery release tag such as the audit-proposed `v0.2.0-phase2` exists.

Recent recovery commits, newest first:

| Commit | Completed work |
| --- | --- |
| `d66b314` | Integer-pesewa create-ride response, client state, and fare presentation contract |
| `c49d639` | Canonical ride-type client contract and backend validation |
| `76ea4a3` / `1eff349` | Actor-scoped ride history and immutable-hash recovery record |
| `db5576f` | Atomic ride-rating persistence, duplicate-rating race protection, live driver-rating recomputation |
| `bf1f245` | Role-aware ride-cancellation actor and event handling |
| `0c4f698` | Real database-backed `UsersService.getProfile` |
| `7aabf9b` | Correct driver JWT identity resolution |
| `f78d0eb` | Least-privilege per-route admin RBAC |
| `8b9de22` | Passenger profile resolution before ride creation |
| `f804607` / `f9dba7d` | Passenger-profile-on-login recovery history |
| `5208e62` | Backend startup wired to shared environment validation |
| `c9220ed` | JWT environment variable alignment |
| `3bee9fa` | Initial Drizzle migration generation |

### Identity and database relationship rules

These are confirmed invariants:

| Value or column | Identifier domain |
| --- | --- |
| `req.user.userId` / JWT `userId` | `users.id` |
| `passengers.userId` | Foreign key mapping `users.id` to a `passengers` profile |
| `drivers.userId` | Foreign key mapping `users.id` to a `drivers` profile |
| `rides.passengerId` | `passengers.id`, never `users.id` |
| `rides.driverId` | `drivers.id`, never `users.id` |
| `rides.cancelledBy` | Authenticated actor’s `users.id`; UUID without a schema foreign key |
| `rides.ratedBy` | Rating actor’s `users.id`; foreign key to `users.id` |

Consequences:

- Passenger-domain operations must resolve `passengers.id` through `passengers.userId = req.user.userId`.
- Driver-domain operations must resolve `drivers.id` through `drivers.userId = req.user.userId`.
- Code must never directly compare `users.id` with `rides.passengerId` or `rides.driverId`.
- Ownership authorization requires both RBAC and the correct profile-ID comparison.

### Completed recovery work

Confirmed in current code and recovery history:

- Drizzle migrations now exist under `packages/shared-db/src/migrations`, including the initial schema and ride-rating columns.
- JWT environment names are aligned on `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- `apps/backend/src/main.ts` calls shared `getEnv()` before application creation.
- Successful OTP verification ensures a passenger profile for passenger-role users, including an idempotent existing-user path.
- Ride creation resolves `passengers.id` before writing `rides.passengerId`.
- `UsersService.getProfile` retrieves the real user, passenger/driver profile presence, and a live completed-ride count.
- `AdminController` uses `AuthGuard`, `RolesGuard`, and narrow per-route permissions.
- Driver HTTP endpoints use JWT `userId` and resolve `drivers.id` in `DriversService`.
- Ride cancellation maps passenger, driver, and `super_admin` roles to actor and cancellation status.
- `rides.cancelledBy` records `users.id`.
- Cancellation emits `ride:update` to the ride room and `ride:cancelled` directly to an assigned driver.
- Ride rating enforces completed status, passenger role, ride ownership, and integer values from 1 through 5.
- Per-ride rating persistence and `drivers.rating` recomputation run in one database transaction.
- A conditional update on `rated_by IS NULL` protects against concurrent duplicate ratings.
- The driver aggregate is recomputed from live `AVG(rides.rating)`.
- `GET /rides/my-rides` resolves passenger or driver profile identity from the authenticated user, applies bounded pagination, and orders deterministically.
- Authenticated ride-detail reads enforce passenger/driver ownership.
- Passenger ride creation sends canonical `standard_tricycle` or `priority_tricycle` values from the shared `RideType` contract.
- The backend defaults an omitted ride type to `standard_tricycle`, rejects unsupported values with HTTP 400 before database work, and uses the same validated value for fare calculation and persistence.
- Ride fare persistence, backend calculations, shared types, API/event fields, and client state use numeric integer pesewas with explicit `Pesewas` suffixes.
- `POST /rides` returns the backend-calculated `estimatedFarePesewas` and an explicitly named pesewa fare breakdown; the passenger app no longer substitutes a local estimate.
- Passenger, driver, tracking, and admin fare displays convert pesewas to `GHS` once at the presentation boundary and handle missing or invalid values without displaying `NaN`.

## Known Limitations

### Runtime blocker

`PHASE-2-RECOVERY-LOG.md` repeatedly records PostgreSQL SQLSTATE `28P01` (“password authentication failed” for the local `postgres` user). Database migrations and backend flows have therefore not been verified against the local PostgreSQL runtime after the recovery changes. Do not change tracked credentials or configuration as an incidental workaround; valid local database access must be supplied and approved separately.

### Confirmed incomplete or broken areas

- The current next recovery task is Task 3a: broadcast all committed ride state changes.
- Passenger auth requests use `phone` while the backend expects `phoneNumber`; passenger OTP response mapping also differs.
- Passenger cancellation calls `POST`, while the backend cancellation route is `PATCH`.
- Dispatch stores offers but does not emit `ride:offered`; the driver offer flow is therefore incomplete.
- Normal ride status updates do not broadcast `ride:update`; cancellation is the recovered exception.
- The driver status route does not pass the authenticated actor to `RidesService.updateStatus`, whose default actor is `system`; this does not match driver-only state transitions.
- `ride:driver-assigned` lacks the driver details expected by the passenger client.
- Tracking web connects to the authenticated `/rides` namespace without a token.
- Four admin dashboard pages still import `../../../../lib/hooks`, which does not resolve from their current paths.
- The admin login page is an unwired email/password form, while the recovered backend design uses pre-provisioned administrative users and the phone-OTP flow.
- No admin route middleware or equivalent dashboard session gate was found.
- Driver and passenger client state/status contracts still contain mismatches described in the recovery plan.
- The root has no orchestration `dev` script, and no workspace defines a `test` script.
- The installed ESLint 9 setup and legacy `.eslintrc.json` remain incompatible for backend linting.

## Pending Verification

The following claims must remain marked pending until executed in a working environment:

- Applying both migrations to an accessible PostgreSQL/PostGIS database.
- Runtime OTP login, profile creation, profile retrieval, ride creation, cancellation, and rating.
- Concurrent duplicate-rating behavior and transaction rollback behavior against PostgreSQL.
- Runtime RBAC responses using provisioned users for each relevant role.
- Redis-backed dispatch and Socket.IO end-to-end behavior.
- Current builds/type checks for all applications after future fixes.
- CI behavior; the checked-in workflow has not been verified by this documentation task.
- Remote push state and release readiness.

## Protected Untracked Files

These generated files were present before this task and must remain unmodified, unstaged, and uncommitted:

- `apps/admin-web/next-env.d.ts`
- `apps/tracking-web/next-env.d.ts`

## Current Recovery Boundary

Task 2f is complete at implementation commit `d66b314`. The next implementation boundary is Task 3a only after explicit approval. Do not begin dispatch offers, admin, authentication, navigation, or other client recovery work as part of Task 3a.

## Planned Work

Planned recovery resumes with Task 3a ride-state broadcasting, then continues through dispatch/events, admin access, passenger and driver client contracts, and quality/demo/release readiness. The dependency order and acceptance criteria are maintained in `RECOVERY_PLAN.md`. Planned items are not complete and must not be started without task-specific approval.

## Validation Practices

For recovery implementation work:

1. Inspect the exact call path, schema identifiers, client contract, RBAC permissions, and existing recovery entries before proposing edits.
2. Obtain approval for one bounded task and its file scope.
3. Run focused TypeScript checks for every affected workspace.
4. Run the relevant workspace build when source behavior or bundling changes.
5. Run `git diff --check`, inspect the focused diff, and run `git status --short`.
6. Where database behavior is involved, distinguish static validation from PostgreSQL runtime validation.
7. Do not claim runtime success while the `28P01` blocker persists.
8. Record exact commands and outcomes in the appropriate recovery record only when that file is in the approved task scope.

Common focused commands are documented in `ARCHITECTURE_NOTES.md`.

## Keeping This Document Current

Update this document only as part of an explicitly approved recovery task when any of the following changes:

- branch, `HEAD`, checkpoint tag, or protected working-tree state;
- a task moves between planned, implemented, statically validated, runtime validated, or blocked;
- an identity or schema invariant changes through an approved migration/design decision;
- a blocker is resolved or a new blocker is confirmed;
- the next approved task or task boundary changes.

Every update must:

- use current repository and Git evidence;
- update **Last verified**;
- distinguish confirmed facts, known limitations, pending verification, and planned work;
- avoid secrets and complete environment-file contents;
- avoid completion percentages;
- retain historical documents rather than rewriting their past observations.
