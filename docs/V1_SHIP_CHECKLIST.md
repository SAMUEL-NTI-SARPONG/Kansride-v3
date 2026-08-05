# KansRide V1 Pilot Ship Checklist

## Current state

- Current commit: `c135c50`
- Branch: `release/kansride-v1`
- Current milestone: Release Sprint 1 implementation complete; external runtime gate pending
- Last updated: 2026-08-05

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
- [x] Admin ride search by UUID/passenger phone and protected ride investigation detail/timeline are implemented without exposing verification PINs.
- [x] Root `dev:all`, `seed:demo`, `doctor`, `test:integration`, and `verify:v1` commands are implemented with explicit failure behavior and no production reset path.
- [x] Demo seed is idempotent and provisions documented passenger, approved driver, subscription, and admin identities without passwords or secrets.
- [x] Android development-build and physical-device instructions are documented with package IDs, LAN URL configuration, and exact commands.
- [x] SMS, maps, and payment interfaces have deterministic mock/implemented development modes with contract tests and explicit production configuration failures.
- [x] Provider readiness ownership and activation steps are documented without secrets; unavailable WhatsApp/USSD boundaries are not fabricated.
- [x] Passenger and driver EAS profiles, valid placeholder icon assets, package IDs, and exact local/EAS Android build commands are configured.
- [x] Final local static gate passed: workspace lint (warnings only), type-checks, unit tests, backend build, admin build, tracking build, and `git diff --check`.
- [x] Sprint 1 driver location eligibility rejects invalid/ineligible updates, protects Redis availability, and delivers locations through all canonical live ride phases.
- [x] Sprint 1 passenger subscriptions require backend acknowledgement with timeout/error handling; continuation cancellation is explicit and body-safe.

## Failing or pending requirements

- [x] Baseline static validation passed on this branch; runtime and release evidence remain pending below.
- [ ] Remote CI result is not verified; GitHub CLI authentication is unavailable in this environment.
- [ ] Sprint 1 integration execution remains pending in this shell because explicit Postgres/PostGIS and Redis services are unavailable; CI/service-backed validation is the next proof point.
- [ ] Live MoMo/Google maps adapters and production provider credentials/owner activation remain external; mock payment is rejected in production.
- [ ] Android EAS/local build execution, installation, permissions, restart, network-loss, GPS, and pilot acceptance remain owner/device actions.
- [ ] Live map provider remains pending; no fake map was shipped.

## External owner actions

- Provide valid PostgreSQL/PostGIS credentials or an approved CI/Codespaces runtime; current local evidence records `28P01`.
- Provide or approve Redis runtime access for dispatch, Socket.IO, and tracking validation.
- Select and provide credentials/activation ownership for any production SMS, payment, maps, WhatsApp, or USSD provider.
- Provision first admin and approve pilot driver accounts through controlled operations.
- Provide deployment access and confirm production URLs/CORS/secrets.
- Perform and confirm Android physical-device installation, permission, GPS, restart, reconnect, and network-loss checks.

## Latest validation results

- `git diff --check`: passed.
- `npm test`: passed — 19 files, 101 tests.
- Focused Sprint 1 tests: passed — 3 files, 7 tests.
- `npm run lint`: passed with warnings only; no lint errors.
- Affected type-checks: backend and mobile-passenger passed; prior all-workspace checks remain green.
- `npm run build`: prior sequential shared/backend/admin/tracking build passed; Sprint 1 changes are type-checked and focused-tested.
- `npm run verify:v1`: prior static gates passed and stopped at integration because explicit Postgres/Redis services are unavailable.
- `npm run test:integration`: attempted and stopped honestly at missing explicit service configuration; no runtime pass claimed.
- `npm run doctor`: failed honestly on missing DATABASE_URL and reports the development Redis fallback.
- `npm run seed:demo`: production refusal and development `28P01` database failure verified; no seed data claimed.
- Expo configs: both resolve; local EAS/device execution not run. Remote CI: branch pushed, GitHub CLI authentication unavailable for result inspection.

## Exact resume point

Owner commands after provisioning valid Postgres/PostGIS and Redis are:

```powershell
npm run db:migrate --workspace=packages/shared-db
npm run seed:demo
npm run verify:v1
```

Then inspect the Sprint 1 CI run for the pushed `c135c50`, perform the Android device matrix in `docs/operations/V1_ANDROID_DEVICE_GUIDE.md`, activate approved providers, and deploy only after those external gates pass. Preserve the existing `opencode.json` modification, `.commandcode/`, and protected generated Next files.
