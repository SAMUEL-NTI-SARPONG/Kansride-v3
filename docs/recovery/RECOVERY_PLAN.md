# KansRide Recovery Plan

**Last verified:** 2026-07-26
**Plan basis:** current code, `PHASE-2-AUDIT.md`, and `PHASE-2-RECOVERY-LOG.md`
**Current next section:** Section C — public tracking security

## Recovery Objective

Recover KansRide to a coherent, testable Phase 2 baseline in which:

- identity values are resolved in the correct database domain;
- authentication and authorization protect every non-public operation;
- passenger, driver, admin, tracking, REST, database, dispatch, and real-time contracts agree;
- migrations can provision the schema;
- critical flows are statically and runtime validated;
- build, lint, test, demo, and release procedures are reproducible.

Recovery repairs the existing Phase 2 baseline. New product features should begin only after the recovery definition of done is met.

## Planning Rules

The audit’s task labels are retained where the repository supports them. The recovery log contains a historical label collision: “Task 1b” was used once for passenger-ID resolution, while the audit’s official Task 1b was `UsersService.getProfile`. Both are complete in current code, but future records must name the scope as well as the number.

Older audit findings must be reconciled before implementation. In particular:

- Audit Step 0a is no longer missing: migrations `0000` and `0001` exist.
- The audit’s statement that design-system components are absent is stale; the components exist, though application adoption is unverified and not a recovery blocker by itself.
- A task marked “complete” below is static unless runtime validation is explicitly recorded.

## Completed Recovery Work

| Audit/recovery area | Current status | Evidence summary |
| --- | --- | --- |
| Step 0a — migrations | Implemented; runtime pending | Drizzle SQL, journal, and snapshots exist through `0001_ride_rating_columns` |
| Step 0b — JWT environment alignment | Implemented | Shared schema, example names, and backend reads use access/refresh names |
| Step 0c — startup environment validation | Implemented | `main.ts` calls `getEnv()` before creating Nest |
| Step 1a — passenger profile on login | Implemented; runtime pending | OTP verification ensures passenger row idempotently |
| Passenger ID resolution before ride creation (historically also “1b”) | Implemented; runtime pending | `users.id` resolves to `passengers.id` |
| Audit Step 1b — real `/users/me` | Implemented; runtime pending | Database-backed user/profile lookup and live count |
| Step 1c backend admin security | Implemented; end-to-end admin access pending | Guarded controller and least-privilege route permissions |
| Step 2a — driver JWT identity | Implemented; runtime pending | `users.id` resolves to `drivers.id` |
| Step 2b — cancellation actor | Implemented; runtime pending | Role-aware status, `users.id` actor, cancellation events |
| Step 2c — rating correctness | Implemented; runtime pending | Transactional persistence, duplicate guard, live AVG |
| Step 2d — ride-history correctness | Implemented; runtime pending | Actor-scoped passenger/driver history, bounded pagination, deterministic ordering |
| Step 2e — normalize ride types | Implemented; runtime pending | Canonical client values and backend validation before fare/database work |
| Step 2f — normalize create-ride fare response | Implemented; runtime pending | Integer-pesewa persistence/transport/state fields and UI-boundary GHS formatting |
| Task 3a — broadcast committed ride state changes | Implemented; runtime pending | Typed canonical event, post-persistence emission, conditional transition writes, canonical client statuses |
| Task 3b — authenticated driver offers | Implemented; runtime pending | Deterministic eligibility, private delivery, explicit expiry, Redis indexing/cleanup, atomic acceptance |
| Section B — private realtime rooms | Implemented; runtime pending | Profile-derived ride ownership, permission-gated admin room, malformed-ID rejection, reconnect restoration |

The latest tagged checkpoint is `phase3-task3a-complete` at `4189034`.

## Operational Prerequisite: Restore Database Runtime Verification

This is a blocker, not a newly invented audit task number. The recovery log records local PostgreSQL authentication failure `28P01`.

Dependencies: every database-backed runtime acceptance test.

Acceptance:

- An approved local/test PostgreSQL with PostGIS is reachable using externally supplied valid configuration.
- `npm run db:migrate --workspace=packages/shared-db` applies the checked-in migrations.
- No tracked credential or environment default is silently changed to make the test pass.
- Recovery tasks completed statically are replayed through focused runtime checks.
- Exact environment-independent results are recorded without exposing credentials.

This prerequisite may be resolved in parallel with code inspection, but runtime completion cannot be claimed before it is satisfied.

## Phase A — Ride and Client Contract Recovery

### Task 2d — ride-history correctness (completed; runtime pending)

Current state: `GET /rides/my-rides` derives the correct passenger or driver profile from the authenticated user, applies bounded `limit`/`offset`, orders by `createdAt DESC, id DESC`, preserves the passenger array contract, and protects authenticated ride-detail ownership.

Dependencies: completed passenger/driver identity resolution; a design decision on route shape and permission semantics.

Acceptance:

- Passenger history derives `passengers.id` from JWT `users.id` before querying `rides.passengerId`.
- Driver history derives `drivers.id` from JWT `users.id` before querying `rides.driverId`.
- A user cannot read another passenger’s or driver’s history by supplying an identifier.
- Static routes are declared so they cannot be consumed as the `GET /rides/:id` parameter route.
- Pagination/limit behavior and response shape are explicit and compatible with clients.
- Missing profile behavior and role behavior are defined.
- RBAC names and ownership enforcement are least-privilege and tested statically.
- The passenger activity client’s expected route is either satisfied or changed in the same approved contract.
- Focused shared-auth/backend/client checks pass; database runtime tests remain clearly marked pending if `28P01` persists.

### Task 2e — normalize ride types (completed; runtime pending)

Current state: the passenger client sends `standard_tricycle` or `priority_tricycle` from the shared `RideType` union. The backend defaults only an omitted value, rejects every unsupported value with HTTP 400 before maps/database work, and uses one validated value for fare calculation and persistence.

Dependencies: completed Task 2d; coordinated backend and passenger-client contract.

Acceptance:

- Client and backend use values from the schema-supported set: `standard_tricycle`, `priority_tricycle`, `shared`, `parcel_delivery`.
- Unsupported `standard` / `comfort` values cannot reach the Drizzle insert unchecked.
- Validation returns a clear client error for invalid values.
- Fare multipliers and displayed ride labels map deliberately to the canonical values.

### Task 2f — normalize create-ride fare response (completed; runtime pending)

Dependencies: agreed money-unit contract.

Current state: fare values are numeric integer pesewas in persistence, backend calculations, shared contracts, API/event fields, and client state. Names identify the unit with a `Pesewas` suffix. The passenger create flow uses the backend response without a local fallback, and GHS strings are produced only by presentation code.

Acceptance:

- API and passenger client agree that persisted and transported fare amounts are pesewas, or expose a separately named display value with explicit conversion.
- `estimatedFarePesewas` and `fareBreakdown.totalFare` cannot be mistaken for GHS.
- Passenger and driver displays perform one tested conversion at the presentation boundary.
- Tracking and admin clients are checked for the same unit convention.

## Phase B — Real-Time Dispatch and Ride Events

### Task 3a — broadcast all ride state changes (completed; runtime pending)

Current state: every implemented lifecycle write returns its persisted row and emits one canonical `ride:update` after the write resolves. Creation targets the authenticated passenger; later transitions target the ride room. Cancellation retains its direct assigned-driver `ride:cancelled` notification. Conditional writes reject stale dispatch work and concurrent duplicate status, cancellation, or assignment attempts without emitting.

Dependencies: stable ride status payload and module dependency design.

Acceptance:

- A committed status change emits a consistent `ride:update` only after persistence succeeds.
- Cancellation retains its recovered semantics and reaches all intended participants without duplicate/conflicting payloads.
- Event failure handling does not falsely report a database transition as uncommitted.
- Passenger, driver, and tracking listeners agree on status names.

### Task 3b — emit driver offers (completed; runtime pending)

Dependencies: authenticated driver connection, valid subscription, canonical offer payload.

Current state: dispatch filters geo candidates against schema-supported user, driver, vehicle, subscription, recent-location, and active-ride rules; indexes live offers by ride and driver; emits typed offers only to addressed authenticated user sockets; restores pending offers on request; and removes competing or terminal offers.

Acceptance:

- `DispatchService` emits `ride:offered` to each eligible offered driver.
- The payload contains the fields the driver client actually uses, with documented fare and distance units.
- Redis offer TTL remains authoritative for acceptance.
- No subscription, expired offer, or already-assigned ride can be accepted.
- Concurrent accept attempts assign at most one driver.

### Task 3c — enrich driver assignment

Dependencies: successful offer acceptance and a privacy-reviewed response shape.

Acceptance:

- The canonical `ride:update` payload for `driver_assigned` contains the exact driver/vehicle fields approved for passengers, or a separately approved compatibility event is deliberately restored.
- The passenger store consumes that payload without type casts or field-name mismatches.
- Private/internal driver data is not broadcast.

### Task 3d — decide public tracking socket authentication

Dependencies: explicit security decision; do not weaken the authenticated namespace incidentally.

Acceptance:

- Choose and document either a separate public tracking path or a scoped, short-lived tracking credential.
- Tracking web can subscribe to only the authorized ride.
- Anonymous clients cannot join arbitrary authenticated ride rooms.
- REST tracking and WebSocket privacy exposure are consistent.

## Phase C — Admin Web Recovery

### Task 4a — restore admin build

Dependencies: none.

Acceptance:

- The four dashboard pages use resolvable hook imports.
- Admin TypeScript check and Next.js production build pass.
- No unrelated dashboard refactor is included.

### Tasks 4b–4c — implement legitimate admin sign-in and route protection

Current backend decision: pre-provisioned administrative users authenticate through phone OTP. Current web page is an unwired email/password form.

Dependencies: explicit approval of the existing phone-OTP design or a replacement; a provisioning procedure for the first admin.

Acceptance:

- Login UI and backend authentication method agree.
- Only a pre-provisioned administrative role can enter the admin session.
- The token is stored/cleared consistently with the API client.
- `/dashboard/*` is gated and unauthenticated users are redirected.
- Backend RBAC remains authoritative even if client-side gating fails.
- Provisioning is documented without hardcoded accounts or secrets.

## Phase D — Passenger Application Contract Recovery

The audit labels these as Step 5a–5e. Reconcile them with Tasks 2d–2f to avoid editing the same contract twice.

Acceptance for the phase:

- OTP request and verification send `phoneNumber`; response mapping uses backend `phoneNumber`, `firstName`, and `lastName`.
- Resend uses the same request contract.
- Ride types and fare units match Tasks 2e–2f.
- Activity loads the approved Task 2d passenger-history route.
- Cancellation uses the backend’s approved HTTP method and continues to send the authenticated passenger identity only through the JWT.
- Socket status mapping uses actual schema names such as `driver_en_route`, `driver_arrived`, and cancellation variants.
- Authentication hydration gates both auth and main route groups, not only the root redirect.
- Passenger login → profile → ride request → live update → cancellation/completion → rating is validated end to end when the database is available.

## Phase E — Driver Application Contract Recovery

The audit labels these as Step 6a–6d.

Acceptance for the phase:

- Recovered driver endpoints are runtime verified after Task 2a and database access.
- Driver registration sends real vehicle/model fields; it does not map a person’s name into `vehicleModel`.
- Acceptance begins in the backend-confirmed `driver_assigned` state.
- Status progression matches `VALID_RIDE_TRANSITIONS`; intermediate states such as `waiting_for_passenger` and `passenger_verified` are handled deliberately rather than skipped.
- Ride updates use the authenticated actor expected by the state machine.
- Navigation is gated after token hydration.
- Driver subscribe → online → location → offer → accept → progress → complete is validated end to end.

## Phase F — Quality, Demo, and Release Recovery

These items retain the audit’s Step 7 labels; their order may be adjusted only after dependency review.

### Task 7a / E1 — seed data

Acceptance: an idempotent, environment-safe seed command creates only documented demo data, uses correct identity relationships, and refuses unsafe production use.

### Task 7b / E3 — reproducible local demo

Acceptance: a root development command or documented equivalent starts required services/apps; a demo guide lists prerequisites, ports, migrations, seed steps, and critical flows.

### Task 7c / E2 — EAS/mobile build configuration

Acceptance: only if mobile distribution remains in scope, approved Expo/EAS configuration builds the intended platforms without checked-in secrets.

### Task 7d / E4 — project documentation

Acceptance: README/setup documentation matches actual commands, environment names, architecture, and supported flows; stale Phase 1 claims are removed or qualified.

### Task 7f — lint and automated tests

Acceptance:

- ESLint 9-compatible configuration makes relevant workspace lint scripts executable.
- Root quality scripts call valid workspace-level commands.
- Critical identity, RBAC, transition, cancellation, duplicate-rating, and history behavior has automated coverage.
- CI runs migration-aware integration tests against isolated services where appropriate.

### Task 7e / E5 — recovery release checkpoint

Dependencies: every recovery acceptance criterion, clean reviewed Git state, and explicit release approval.

Acceptance:

- Recovery changes are committed in reviewable task-scoped commits.
- CI and required runtime checks pass.
- Remote state is verified.
- A release tag name is reconciled with the existing `phase2-task2c-complete` checkpoint; the audit-proposed `v0.2.0-phase2` must not be created automatically.

## Dependency Summary

1. Database access unblocks runtime proof for all persistence work.
2. Task 2d completed owned ride retrieval for passenger activity and future driver history use.
3. Tasks 2e–2f established the canonical ride-type and money-unit contracts before broader passenger/driver UI fixes.
4. Tasks 3a–3c complete real-time ride flow before end-to-end mobile validation.
5. Task 3d requires a security decision independent of mobile authentication.
6. Admin build can be repaired independently; admin login and route gating depend on the authentication/provisioning decision.
7. Quality automation and demo/release work follow stable contracts.

## Per-Task Workflow

Every recovery task follows this sequence:

1. **Inspection:** verify Git state, read these three recovery documents, trace current code/schema/client paths, and identify the narrow file scope.
2. **Approval:** present findings, proposed behavior, acceptance criteria, files, risks, and validation commands. Wait for explicit approval.
3. **Implementation:** edit only the approved task; preserve unrelated user changes and protected generated files.
4. **Validation:** run focused type checks/builds/tests, runtime checks when available, `git diff --check`, focused diff review, and `git status --short`.
5. **Commit:** stop before staging or committing unless explicitly instructed. If instructed, stage exact paths only and create one task-scoped commit.

## Commit and Tagging Strategy

- One approved recovery task per commit.
- Use conventional, scope-specific subjects consistent with recent history, such as `fix(rides): ...`.
- Never use `git add .`; stage exact reviewed paths.
- Do not combine recovery logs, generated outputs, or unrelated refactors unless the task explicitly requires them.
- Tag only stable, reviewed checkpoints after explicit instruction.
- Keep `phase2-task2c-complete` and `phase2-task2d-complete` immutable.
- Reconcile the final release tag with repository history before creating it; do not assume the old audit’s proposed tag is still desired.

## Definition of Recovery Completion

Recovery is complete when all of the following are true:

- migrations provision an isolated PostgreSQL/PostGIS database;
- identity invariants are preserved across REST, database, and events;
- authentication, ownership checks, and RBAC are runtime verified;
- passenger and driver critical journeys work end to end;
- admin login, route protection, and least-privilege API access work;
- public tracking has an approved secure real-time design;
- dispatch offers, assignment, state changes, cancellation, and rating are reliable;
- all supported workspaces type-check and build;
- linting works and critical behavior has automated tests;
- setup/demo documentation is reproducible;
- CI passes and the repository is clean except explicitly accepted generated artifacts;
- a reviewed recovery checkpoint is committed and, if instructed, tagged.

## Post-Recovery Transition

After recovery completion, create a separately approved roadmap:

1. **Feature completion:** prioritize product gaps without mixing them into recovery commits.
2. **Integration testing:** expand API, database, WebSocket, and mobile/web journey coverage.
3. **Deployment readiness:** production environment design, secrets management, observability, backups, security review, scaling, and rollback.
4. **Launch preparation:** controlled pilot, operational runbooks, support/safety procedures, app distribution, analytics, and go/no-go criteria.

None of these post-recovery phases should be represented as already complete.
