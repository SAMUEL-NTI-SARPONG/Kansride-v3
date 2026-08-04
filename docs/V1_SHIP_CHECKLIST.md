# KansRide V1 Pilot Ship Checklist

## Current state

- Current commit: `c3ceae5`
- Branch: `release/kansride-v1`
- Current milestone: Milestone 1 — backend/database/shared correctness validated
- Last updated: 2026-08-04

## Passed requirements

- [x] Backend/shared ride contracts, identity mapping, RBAC, cancellation, rating, history, dispatch offer filtering, private rooms, and privacy-safe public tracking are implemented and statically covered by existing recovery work.
- [x] Protected admin driver approval/rejection, user suspension, admin ride cancellation, and audit-log writes are implemented with transactional persistence.
- [x] Subscription payment outcomes are persisted in integer pesewas, provider references are unique, subscription links are recorded, and activation is transactional.
- [x] Provider configuration is explicit and fail-closed: deterministic mock mode is development-only; unimplemented live payment/maps modes cannot silently fall back.
- [x] Recent passenger and driver location foundations are present; current validation is pending below.
- [x] Admin and tracking production build scripts exist; current validation is pending below.
- [x] PostgreSQL migrations and Redis/in-memory fallback are present in the repository; live service validation is pending below.

## Failing or pending requirements

- [x] Baseline static validation passed on this branch; runtime and release evidence remain pending below.
- [ ] Live payment provider adapter and production credentials/owner activation remain external; mock mode is intentionally rejected in production.
- [ ] Local runtime migration/application and Postgres/Redis-backed verification remain blocked by services and credentials.
- [ ] Complete Postgres/Redis-backed ride integration journey and CI integration job are missing.
- [ ] Passenger/driver restart recovery, reconnect UX, watcher edge cases, and physical-device URL enforcement remain incomplete.
- [ ] Admin operational investigation/actions and configured live maps remain incomplete.
- [ ] Idempotent demo seed, environment doctor, `dev:all`, `test:integration`, and `verify:v1` workflows remain incomplete.
- [ ] Android development-build configuration and physical-device validation remain incomplete.

## External owner actions

- Provide valid PostgreSQL/PostGIS credentials or an approved CI/Codespaces runtime; current local evidence records `28P01`.
- Provide or approve Redis runtime access for dispatch, Socket.IO, and tracking validation.
- Select and provide credentials/activation ownership for any production SMS, payment, maps, WhatsApp, or USSD provider.
- Provision first admin and approve pilot driver accounts through controlled operations.
- Provide deployment access and confirm production URLs/CORS/secrets.
- Perform and confirm Android physical-device installation, permission, GPS, restart, reconnect, and network-loss checks.

## Latest validation results

- Static validation: `git diff --check` passed.
- Unit/invariant tests: `npm test` passed — 14 files, 88 tests; focused admin/payment tests passed — 8 tests.
- Type checks: backend, shared-db, and shared-config passed after Milestone 1 changes; baseline admin/tracking/mobile checks also passed.
- Backend build and lint passed; lint reported 12 pre-existing/non-blocking warnings and no errors.
- Production web builds: baseline admin-web and tracking-web passed; rerun at final gate after web changes.
- Runtime database/Redis validation: blocked pending services and credentials; no runtime claim made.
- Remote CI: release branch checkpoint was pushed; remote pipeline result not yet verified.
- Device validation: not run; no physical-device claim.

## Exact resume point

Milestone 1 is ready for its narrow backend checkpoint commit. Next, implement the repeatable Postgres/Redis-backed ride-journey integration suite and CI coverage. Preserve the existing `opencode.json` modification, `.commandcode/`, and protected generated Next files.
