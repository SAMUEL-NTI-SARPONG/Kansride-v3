# KansRide V1 Pilot Ship Checklist

## Current state

- Current commit: `344581443bf238a84bfcf48c451ab102d2a02a1`
- Branch: `release/kansride-v1`
- Current milestone: Milestone 0 — release baseline validated
- Last updated: 2026-08-04

## Passed requirements

- [x] Backend/shared ride contracts, identity mapping, RBAC, cancellation, rating, history, dispatch offer filtering, private rooms, and privacy-safe public tracking are implemented and statically covered by existing recovery work.
- [x] Recent passenger and driver location foundations are present; current validation is pending below.
- [x] Admin and tracking production build scripts exist; current build evidence is pending below.
- [x] PostgreSQL migrations and Redis/in-memory fallback are present in the repository; live service validation is pending below.

## Failing or pending requirements

- [x] Baseline static validation passed on this branch; runtime and release evidence remain pending below.
- [ ] Admin driver approval/rejection, user suspension, admin ride actions, and audit-log writes are missing.
- [ ] Durable subscription payment records, provider selection, and live-provider readiness are incomplete.
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
- Unit/invariant tests: `npm test` passed — 12 files, 80 tests.
- Type checks: backend, admin-web, tracking-web, mobile-passenger, and mobile-driver passed.
- Production builds: backend, admin-web, and tracking-web passed. Next build emitted only the documented missing ESLint Next plugin warning.
- Runtime database/Redis validation: blocked pending services and credentials; no runtime claim made.
- Remote CI: not yet run for this branch.
- Device validation: not run; no physical-device claim.

## Exact resume point

Milestone 0 is ready for its narrow checklist checkpoint commit. Next, implement Milestone 1 backend/database/shared correctness, beginning with protected admin mutations and audit-log persistence. Preserve the existing `opencode.json` modification, `.commandcode/`, and protected generated Next files.
