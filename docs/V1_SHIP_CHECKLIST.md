# KansRide V1 Pilot Ship Checklist

## Current state

- Current implementation checkpoint: `0974196` (focused release checkpoints pushed with this checklist)
- Branch: `release/kansride-v1`
- Current milestone: repository-owned V1 static gate complete; live payments deliberately deferred with `PAYMENT_PROVIDER=disabled`; deployment/device/provider gates pending
- Last updated: 2026-08-19

## Passed requirements

- [x] Backend/shared ride contracts, identity mapping, RBAC, cancellation, rating, history, dispatch offer filtering, private rooms, and privacy-safe public tracking are implemented and statically covered by existing recovery work.
- [x] Protected admin driver approval/rejection, user suspension, admin ride cancellation, and audit-log writes are implemented with transactional persistence.
- [x] Subscription payment outcomes are persisted in integer pesewas, provider references are unique, subscription links are recorded, and activation is transactional.
- [x] Provider configuration is explicit and fail-closed: deterministic payment mock mode is development/test-only, `disabled` is the production-safe controlled-pilot mode, and unimplemented live payment/maps modes cannot silently fall back.
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
- [x] GitHub Actions run `31043992160` for pushed checkpoint `223cc0e` passed all six jobs: lint/type-check, unit tests, shared builds, web builds, backend migration/health smoke, and the Postgres/Redis ride journey.

## Failing or pending requirements

- [x] Baseline static validation passed on this branch; runtime and release evidence remain pending below.
- [x] Railway-port commit `43f9b5f` and the focused payment/mobile-preview checkpoints are synchronized to `origin/release/kansride-v1` by the authorized release push.
- [ ] Local and target-environment service-backed execution remains pending until valid PostgreSQL/PostGIS and Redis configuration is supplied; the equivalent CI service jobs passed at `223cc0e`.
- [x] Live Mobile Money is deliberately deferred for V1; the controlled pilot uses `PAYMENT_PROVIDER=disabled`, which never simulates success and returns a controlled unavailable response for online payment initiation.
- [ ] Deployment access remains external/owner-gated. Google routing remains unimplemented and requires an owner decision only if selected for V1.
- [ ] Android EAS/local build execution, installation, permissions, restart, network-loss, GPS, accessibility, and pilot acceptance remain owner/device actions.
- [ ] Production map tile/provider SLA remains external; development map surfaces are explicitly labeled/configurable.

## External owner actions

- Provide valid PostgreSQL/PostGIS credentials or an approved CI/Codespaces runtime; current local evidence records `28P01`.
- Provide or approve Redis runtime access for dispatch, Socket.IO, and tracking validation.
- Select and provide credentials/activation ownership for the production SMS and maps choices. Live Mobile Money credentials are not required while the controlled pilot remains on `PAYMENT_PROVIDER=disabled`; WhatsApp and USSD remain outside V1 scope.
- Provision first admin and approve pilot driver accounts through controlled operations.
- Provide deployment access and confirm production URLs/CORS/secrets.
- Perform and confirm Android physical-device installation, permission, GPS, restart, reconnect, and network-loss checks.

## Latest validation results

- `git diff --check`: passed.
- Focused release implementation through `0974196` validated on 2026-08-18.
- `npm test`: passed — 29 files, 136 tests.
- Focused Sprint 2 tests: passenger details/saved places/safety/support, driver navigation/history, tracking map, admin map, fare estimate, and Sprint 1 realtime tests passed.
- `npm run lint`: passed with 37 warnings and no lint errors (12 backend, 18 driver, 7 passenger).
- `npm run type-check`: passed for all configured workspaces.
- `npm run build`: completed for shared packages, backend, admin-web, and tracking-web; affected builds passed.
- Local `npm run test:integration`: reached the integration suite and refused to run without `DATABASE_URL` and `REDIS_URL`, as designed.
- Local migration and `npm run doctor`: fail honestly because `DATABASE_URL` is absent; doctor reports the development Redis fallback.
- GitHub Actions run `31043992160` at `223cc0e`: passed all six jobs, including the PostGIS migration/backend health smoke and Postgres/Redis integration journey.
- The component commands used by `npm run verify:v1` pass through the static/build stages; its local service portion remains unavailable without Postgres/Redis configuration.
- `npm run seed:demo`: production refusal and development `28P01` database failure verified; no seed data claimed.
- Expo configs resolve; Passenger and Driver Android bundles opened successfully in Expo Go review sessions. EAS builds and the physical-device acceptance matrix remain pending.

## Exact resume point

After provisioning valid target Postgres/PostGIS and Redis, run:

```powershell
npm run db:migrate --workspace=packages/shared-db
npm run seed:demo
npm run verify:v1
```

Then perform the Android device matrix in `docs/operations/V1_ANDROID_DEVICE_GUIDE.md`, keep `PAYMENT_PROVIDER=disabled` for the controlled pilot, configure the approved SMS/maps choices, and deploy only after those external gates pass. Live payment implementation remains deferred to a separately approved post-V1 task. Preserve the existing `opencode.json` modification, `.commandcode/`, and protected generated Next files.
