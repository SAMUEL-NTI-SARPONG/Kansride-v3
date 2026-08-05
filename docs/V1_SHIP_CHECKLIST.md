# KansRide V1 Pilot Ship Checklist

## Current state

- Current commit: `9a65b93`
- Branch: `release/kansride-v1`
- Current milestone: Sprint 3 controlled-pilot readiness; runtime/device/provider gates pending
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
- [x] Sprint 2 passenger cancellation presents curated reasons and sends the selected cancellation reason through the established authorized endpoint.
- [x] Sprint 2 passenger home uses real pickup/destination map markers and gates ride requests on a backend-authoritative fare estimate.
- [x] Sprint 2 passenger ride details, saved places, safety/tracking share, support channels, and profile dead-control cleanup are implemented.
- [x] Sprint 2 driver active-ride map/navigation and driver history/earnings surfaces are implemented.
- [x] Sprint 2 public tracking and admin live operations map surfaces are implemented with privacy-safe projections and stale/error states.
- [x] Sprint 2 focused cleanup and tests are complete; visible map placeholders in these surfaces are removed.
- [x] Sprint 2 final validation passed: 127 tests, all workspace type-checks, sequential builds, and workspace lint with warnings only.
- [x] Sprint 3 readiness documentation now covers staging startup, readiness, provider gates, Android builds, backups, rollback, and physical-device execution.
- [x] Controlled-pilot runbook and physical-device test package are linked from README and contain no credentials or private contact values.

## Failing or pending requirements

- [x] Baseline static validation passed on this branch; runtime and release evidence remain pending below.
- [ ] GitHub Actions result for the final Sprint 2 checkpoint is not verified because GitHub CLI authentication is unavailable in this environment.
- [ ] Service-backed integration/runtime execution remains pending locally until valid PostgreSQL/PostGIS and Redis services are available.
- [ ] Live MoMo/Google maps adapters, production provider credentials, and deployment access remain external.
- [ ] Android EAS/local build execution, installation, permissions, restart, network-loss, GPS, accessibility, and pilot acceptance remain owner/device actions.
- [ ] Production map tile/provider SLA remains external; development map surfaces are explicitly labeled/configurable.

## External owner actions

- Provide valid PostgreSQL/PostGIS credentials or an approved CI/Codespaces runtime; current local evidence records `28P01`.
- Provide or approve Redis runtime access for dispatch, Socket.IO, and tracking validation.
- Select and provide credentials/activation ownership for any production SMS, payment, maps, WhatsApp, or USSD provider.
- Provision first admin and approve pilot driver accounts through controlled operations.
- Provide deployment access and confirm production URLs/CORS/secrets.
- Perform and confirm Android physical-device installation, permission, GPS, restart, reconnect, and network-loss checks.

## Latest validation results

- `git diff --check`: passed.
- `npm test`: passed — 28 files, 127 tests.
- Focused Sprint 2 tests: passenger details/saved places/safety/support, driver navigation/history, tracking map, admin map, fare estimate, and Sprint 1 realtime tests passed.
- `npm run lint`: passed with warnings only; no lint errors.
- `npm run type-check`: passed for all configured workspaces.
- `npm run build`: completed for shared packages, backend, admin-web, and tracking-web; affected builds passed.
- Service-backed integration remains blocked locally; no runtime/device/provider success claimed.
- `npm run verify:v1`: static gates pass and service-backed integration remains pending without Postgres/Redis.
- `npm run doctor`: fails honestly without DATABASE_URL and reports the development Redis fallback.
- `npm run seed:demo`: production refusal and development `28P01` database failure verified; no seed data claimed.
- Expo configs resolve; local EAS/device execution and remote CI result were not claimed.

## Exact resume point

Owner commands after provisioning valid Postgres/PostGIS and Redis are:

```powershell
npm run db:migrate --workspace=packages/shared-db
npm run seed:demo
npm run verify:v1
```

Then inspect the final Sprint 2 CI run for the pushed `9a65b93`, perform the Android device matrix in `docs/operations/V1_ANDROID_DEVICE_GUIDE.md`, activate approved providers, and deploy only after those external gates pass. Preserve the existing `opencode.json` modification, `.commandcode/`, and protected generated Next files.
