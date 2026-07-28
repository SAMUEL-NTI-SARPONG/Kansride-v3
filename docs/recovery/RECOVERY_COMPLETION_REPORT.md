# KansRide Recovery Completion Report

**Last verified:** 2026-07-26  
**Branch:** `recovery/phase-2-opencode`  
**Disposition:** Static recovery complete; runtime action required

## 1. Executive Summary

The credential-free KansRide V1 recovery scope is implemented and statically validated. Identity, fare, lifecycle, dispatch, room authorization, public tracking, admin build/session, and mobile/backend contracts are internally coherent. The repository is not runtime-complete because valid local PostgreSQL authentication is unavailable, PostgreSQL 13/16 service selection is unresolved, and no Redis-compatible service is listening.

This checkpoint is suitable for continued internal engineering and controlled runtime validation. It is not ready for an internal alpha involving real journeys or for a controlled pilot.

## 2. Completed Recovery Work

- Shared startup validation, canonical environment loading, and runtime package entrypoints.
- Passenger profile creation and profile-scoped ride creation/history/detail/cancellation/rating.
- Real user profile retrieval, driver JWT identity resolution, and least-privilege admin RBAC.
- Canonical ride types and numeric integer-pesewa fare contracts.
- Transactional rating persistence and live driver-rating recomputation.
- Post-persistence lifecycle events and conditional single-winner assignment.
- Eligible-driver targeting, private expiring offers, acceptance revalidation, and cleanup.
- Authorized private ride/admin rooms with reconnect restoration.
- Token-scoped, minimized public tracking on a separate namespace.
- Admin-web import/build recovery and phone-OTP session integration.
- Passenger/driver auth navigation, request-method/shape alignment, safe assignment enrichment, passenger PIN verification, and completion fare finalization.

## 3. Current Architecture

KansRide is an npm-workspaces monorepo containing a NestJS/Drizzle backend, Expo passenger and driver clients, Next.js admin and public-tracking clients, and shared auth/config/database/type packages. PostgreSQL/PostGIS is authoritative persistence. Redis supports geo dispatch, expiring offers, and public tracking grants. Socket.IO has an authenticated `/rides` namespace and token-authenticated `/tracking` namespace.

See `ARCHITECTURE_NOTES.md` for module and route details.

## 4. Identity Invariants

- JWT `userId` is `users.id`.
- `passengers.userId` maps `users.id` to `passengers.id`.
- `drivers.userId` maps `users.id` to `drivers.id`.
- `rides.passengerId` stores `passengers.id`.
- `rides.driverId` stores `drivers.id`.
- `rides.cancelledBy` and `rides.ratedBy` store `users.id`.
- Ownership paths never compare JWT `users.id` directly with ride passenger/driver profile IDs.

## 5. Fare Contract

Fare values are integer pesewas in schema, backend calculations, REST, realtime events, shared types, and client state. Fields carry explicit `Pesewas` suffixes. UI code alone formats `GHS`. `POST /rides` returns the backend-authoritative `estimatedFarePesewas`; `priority_tricycle` retains its 1.5× multiplier. Completion stores `actualFarePesewas`, defaulting to the authoritative estimate when no separate actual adjustment exists.

## 6. Realtime Event Contract

Committed lifecycle writes emit one private `ride:update` only after a successful insert or conditional update. Failed, rejected, stale, and losing concurrent writes emit none. Creation targets the authenticated passenger user; subsequent private changes target the authorized ride room. Assignment may include the safe driver summary. Cancellation retains the assigned-driver direct notification. No private ride payload is globally broadcast.

Socket delivery is best effort. There is no outbox, replay, acknowledgement protocol, or multi-instance Socket.IO adapter.

## 7. Dispatch and Offer Contract

Eligible drivers must have a verified active driver-role user, active/online driver profile, location updated within 60 seconds, active tricycle, current subscription, and no active ride. Candidates are ordered by pickup distance then driver ID; at most five receive a private offer.

Offers contain canonical ride type, integer fare, required trip evaluation data, distance-to-pickup in meters, and ISO issue/expiry times. Redis TTL is 30 seconds. Offers are indexed by ride and driver and are removed on acceptance, competition loss, cancellation, decline, expiry/terminal failure, or stale recovery. Decline affects only that driver. Acceptance rechecks recipient, expiry, eligibility, and ride availability; a conditional database update permits one winner.

## 8. Public Tracking Contract

Only the owning passenger can issue/revoke a 32-byte random tracking capability. Redis stores only a SHA-256-keyed grant with a six-hour TTL. Raw ride IDs do not authorize access. REST and `/tracking` return dedicated minimized contracts and dedicated rooms. Public data excludes internal IDs, contacts, PIN, fare, exact trip endpoint coordinates, and cancellation actor. Terminal status is emitted once before grants are revoked and public sockets disconnected.

## 9. Admin Build and Session State

Admin TypeScript and production build pass. Pre-provisioned dashboard-capable staff use the common phone-OTP endpoints. The web client stores and refreshes the access/refresh pair, clears both on failure/sign-out, and redirects missing sessions from dashboard routes. Client gating is convenience only; per-route backend RBAC remains authoritative. First-admin provisioning is not public or automated.

## 10. Database and Redis State

- PostgreSQL 13 is running on `127.0.0.1:5432`; PostgreSQL 16 is installed but stopped.
- TCP accepts connections, but valid authentication is unavailable. No password was guessed, reset, printed, or committed.
- No Redis-compatible process or CLI was found; port 6379 is closed.
- The backend can start far enough to serve its basic health endpoint with a deliberately invalid test database identity because that endpoint does not query PostgreSQL. This is not database validation.

## 11. Static Validation Matrix

| Check | Result |
| --- | --- |
| Shared types/config/database/auth builds | PASS |
| Backend TypeScript and production build | PASS |
| Passenger mobile TypeScript | PASS |
| Driver mobile TypeScript | PASS |
| Admin web TypeScript and production build | PASS |
| Tracking web TypeScript and production build | PASS |
| Drizzle journal/snapshot/SQL consistency | PASS |
| Focused dispatch, room, tracking, event, and integration probes | PASS |
| `git diff --check` at task checkpoints | PASS |
| Automated unit/integration suite | NOT AVAILABLE — no workspace test script |
| Lint | BLOCKED — ESLint 9 and legacy configuration are incompatible |

## 12. End-to-End Test Results

The complete journey was traced and compiler/mocked-probe validated from OTP contracts through profile mapping, create/fare, offer/accept, private rooms, assignment, arrival, PIN verification, start, completion, history, rating, duplicate protection, public tracking, and cleanup. No database-backed end-to-end journey ran. Therefore none of these flows is claimed as runtime-passing.

## 13. Unresolved External Blockers

1. Valid PostgreSQL credentials and an explicit PostgreSQL 16 versus 13 service decision.
2. A running Redis 7 or compatible local service.
3. Controlled local creation/provisioning of passenger, approved driver, and administrative test identities.
4. External SMS/payment provider behavior beyond existing development mocks.

## 14. Remaining Product and Release Work

- Execute and automate the runtime matrix in isolated services.
- Add idempotent development seed/provisioning tooling with production refusal.
- Add ESLint 9 flat configuration and real automated unit/integration tests.
- Add root service orchestration and verify CI.
- Define multi-instance Redis/Socket.IO adapter and durable event-delivery expectations.
- Reconcile completed-ride counters and rarely used lifecycle states.
- Complete production CORS, secrets, providers, observability, backups, incident response, EAS/mobile builds, and operational launch controls.

## 15. Internal-Alpha Readiness

**NOT READY.** Static contracts pass, but persistence, Redis dispatch, live sockets, migrations, and a complete local journey have not run.

## 16. Controlled-Pilot Readiness

**NOT READY.** Runtime validation, production providers/security, monitoring, deployment, test coverage, and operational controls are incomplete.

## 17. Exact Local Startup Sequence

Run from the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit the ignored `.env` locally. Replace placeholders, URL-encode reserved password characters inside `DATABASE_URL`, and never commit or print the file. Start the selected PostgreSQL/PostGIS service and Redis-compatible service, then:

```powershell
npm install
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/shared-config
npm run build --workspace=packages/shared-db
npm run build --workspace=packages/shared-auth
npm run db:migrate --workspace=packages/shared-db
npm run dev --workspace=apps/backend
```

In separate terminals:

```powershell
npm run dev --workspace=apps/admin-web
npm run dev --workspace=apps/tracking-web
npm run start --workspace=apps/mobile-passenger
npm run start --workspace=apps/mobile-driver
```

Expected ports are backend 3000, admin 3001, tracking 3002, PostgreSQL 5432, and Redis 6379. Follow `docs/SETUP-WINDOWS.md` for service setup.

## 18. Test Account and Setup Rules

- Use only local test phone numbers and the development/mock SMS path.
- A new passenger is created by successful OTP verification and receives a passenger profile.
- A passenger can submit a driver application; it remains inactive and changes the account to `driver_applicant`. Re-authenticate after submission.
- Approve the test driver only through a controlled administrative/local provisioning procedure: the user role must be `driver` and the driver profile active before dispatch.
- Pre-provision an administrative staff user out of band, then authenticate through phone OTP. Do not add a public role-promotion path.
- Do not put phone numbers, OTPs, passwords, tokens, or connection strings in this report or Git.

## 19. Rollback and Checkpoints

- Starting checkpoint: `phase3-task3a-complete` at `4189034`.
- Section implementations: `bd4abe3`, `9b89f47`, `8ed1962`, `d6d9d44`, `4dc613a`, and `6dc409f`.
- Each implementation has a neighboring recovery documentation checkpoint.
- Final static checkpoint tag: `kansride-recovery-static-complete` after final documentation commit.
- Existing tags are immutable; rollback should use normal non-rewriting Git history, not reset/rebase.

## 20. Recommended Next Phase

Run a credentialed local-runtime validation sprint: reconcile PostgreSQL 16, enable PostGIS and Redis, apply the existing migrations, provision isolated test roles, execute the full ride-flow matrix, and create narrowly scoped fixes for runtime-only defects. After that passes, begin quality automation and internal-alpha preparation.
