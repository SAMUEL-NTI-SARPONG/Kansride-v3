# KansRide V1 Pilot Ship Checklist

## Current state

- Current commit: `6d1248c`
- Branch: `release/kansride-v1`
- Current milestone: Milestone 7 — Android development-build readiness configured
- Last updated: 2026-08-04

## Passed requirements

- [x] Backend/shared ride contracts, identity mapping, RBAC, cancellation, rating, history, dispatch offer filtering, private rooms, and privacy-safe public tracking are implemented and statically covered by existing recovery work.
- [x] Protected admin driver approval/rejection, user suspension, admin ride cancellation, and audit-log writes are implemented with transactional persistence.
- [x] Subscription payment outcomes are persisted in integer pesewas, provider references are unique, subscription links are recorded, and activation is transactional.
- [x] Provider configuration is explicit and fail-closed: deterministic mock mode is development-only; unimplemented live payment/maps modes cannot silently fall back.
- [x] Recent passenger and driver location foundations are present; current validation is pending below.
- [x] Admin and tracking production build scripts exist; current validation is pending below.
- [x] PostgreSQL migrations and Redis/in-memory fallback are present in the repository; live service validation is pending below.
- [x] A separate Postgres/Redis integration command and CI service job cover authentication, two-driver offer race, lifecycle transitions, final fare, tracking privacy/revocation, cancellation authorization, and duplicate rating.
- [x] Passenger and driver active rides persist through restart, reconcile with authoritative ride detail, and restore socket subscriptions; passenger location/continuation failures have visible retry states.
- [x] Driver location emission never sends before a real fix, watcher/socket cleanup is handled on unmount/offline/logout, and restored online sessions roll back when location recovery fails.
- [x] Physical-device mode rejects missing or loopback mobile URLs; driver configuration advertises the implemented foreground-only location policy.
- [x] Admin web exposes pending-driver approval/rejection, user suspend/restore, and cancellable-ride actions with cache refresh and visible failures.
- [x] Tracking web exposes reconnect/stale/ended states without rendering raw driver coordinates or private tracking fields.
- [x] Root `dev:all`, `seed:demo`, `doctor`, `test:integration`, and `verify:v1` commands are implemented with explicit failure behavior and no production reset path.
- [x] Demo seed is idempotent and provisions documented passenger, approved driver, subscription, and admin identities without passwords or secrets.
- [x] Android development-build and physical-device instructions are documented with package IDs, LAN URL configuration, and exact commands.
- [x] SMS, maps, and payment interfaces have deterministic mock/implemented development modes with contract tests and explicit production configuration failures.
- [x] Provider readiness ownership and activation steps are documented without secrets; unavailable WhatsApp/USSD boundaries are not fabricated.
- [x] Passenger and driver EAS profiles, valid placeholder icon assets, package IDs, and exact local/EAS Android build commands are configured.

## Failing or pending requirements

- [x] Baseline static validation passed on this branch; runtime and release evidence remain pending below.
- [ ] Live payment/MoMo and Google maps adapters plus production credentials/owner activation remain external; mock mode is intentionally rejected in production.
- [ ] Local runtime migration/application and Postgres/Redis-backed verification remain blocked by services and credentials; the local integration probe failed at PostgreSQL `28P01` and no Redis listener was available.
- [ ] Remote CI integration job has not yet run on the pushed release branch.
- [ ] Real Android permission/GPS/background-foreground/restart/network-loss behavior remains pending physical-device validation; this milestone intentionally supports foreground-only driver location.
- [ ] Admin ride detail/search, live map provider, and browser/device runtime validation remain pending; no fake map was shipped.
- [ ] `doctor`, `seed:demo`, and `verify:v1` remain runtime-blocked locally until valid PostgreSQL/PostGIS and Redis services are available.
- [ ] Android development-build execution, installation, permissions, restart, network-loss, and GPS validation remain owner/device actions.

## External owner actions

- Provide valid PostgreSQL/PostGIS credentials or an approved CI/Codespaces runtime; current local evidence records `28P01`.
- Provide or approve Redis runtime access for dispatch, Socket.IO, and tracking validation.
- Select and provide credentials/activation ownership for any production SMS, payment, maps, WhatsApp, or USSD provider.
- Provision first admin and approve pilot driver accounts through controlled operations.
- Provide deployment access and confirm production URLs/CORS/secrets.
- Perform and confirm Android physical-device installation, permission, GPS, restart, reconnect, and network-loss checks.

## Latest validation results

- Static validation: `git diff --check` passed.
- Type checks: shared types/config/db/auth, backend, passenger/driver mobile, admin-web, and tracking-web passed through `verify:v1`.
- Unit/invariant tests: `npm test` passed — 16 files, 94 tests; focused provider tests passed — 3 tests.
- Expo config: both app configs resolved with the supported `npx expo config --json` command; passenger output also hit a local Expo telemetry `EPERM` rename warning after resolving, so no EAS/device execution is claimed.
- Backend build and lint passed; lint reported 12 pre-existing/non-blocking warnings and no errors.
- Web production builds: admin-web and tracking-web passed; Next emitted only the existing missing ESLint plugin warning.
- `npm run verify:v1` passed all static checks and stopped at `integration journey` because explicit Postgres/Redis services are unavailable; no runtime pass claimed.
- `npm run doctor` fails honestly without DATABASE_URL and reports the in-memory Redis development fallback; `npm run seed:demo` refuses production mode and reaches the database before failing with documented `28P01` credentials.
- CI: release branch trigger and Postgres/Redis integration job are checked in; remote result not yet verified.
- Device validation: not run; no physical-device claim.

## Exact resume point

Milestone 7 is ready for its narrow Android-readiness checkpoint commit. Next, run the final V1 release gate, inspect remote CI, and close only external runtime/provider/device/deployment blockers. Preserve the existing `opencode.json` modification, `.commandcode/`, and protected generated Next files.
