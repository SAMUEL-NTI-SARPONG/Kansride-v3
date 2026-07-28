# KansRide — Engineering Readiness Report

**Date:** 2026-07-28
**Phase:** Engineering Readiness (planning only — no implementation)
**Authority:** consolidates verification of the Product Governance documentation against the repository, plus architectural risk, debt, blockers, and reusable assets. Sources of truth: `docs/recovery/` (engineering state), `docs/product/` + `.ai/` (direction & governance), and the repository itself (final truth).
**Scope:** analysis and planning only. No production code, API, auth, schema, migration, or business logic was modified.

---

## 1. Documentation-vs-Repository Verification (Task 1)

Method: every load-bearing claim in the product/recovery/governance set was traced to repository evidence (config files, schema, controllers, services, package manifests, CI). Results:

### 1.1 Verified accurate (no change needed)

| Claim | Evidence | Status |
| --- | --- | --- |
| Fare constants 200/150/10/300p, priority ×1.5 (ceil) | `shared-config/constants.ts`, `fare.service.ts` | ✓ |
| Subscription 1000p/24h, go-online gate, 5-min cron | `constants.ts`, `drivers.service.ts` | ✓ |
| Dispatch 2→5 km, ≤5 drivers, offer TTL 30 s, `no_driver_found` at 30 s | `constants.ts`, `dispatch.service.ts` (`OFFER_TTL_SECONDS=30`) | ✓ |
| OTP 6 digits, 10-min expiry, 3 attempts, 3 requests/15 min | `auth.service.ts` | ✓ |
| PIN 4 digits, 5 attempts/min route limit | `rides.controller.ts` (`@Throttle`) | ✓ |
| Tracking 256-bit token, SHA-256-keyed Redis grant, 6 h TTL | public-tracking service/gateway | ✓ |
| RBAC 30 permissions, 11 roles; admin-web admits 5 | `shared-auth/rbac.ts`, `admin-web/src/app/login/page.tsx` | ✓ |
| 21 ride statuses, 11 user roles | `schema/rides.ts`, `schema/users.ts` | ✓ |
| Admin controller exactly 5 read-only GETs | `admin.controller.ts` | ✓ |
| `payments` & `audit_logs` never written (dead tables) | no imports across backend `src` | ✓ |
| `@kansride/ui` unused; exports Button/TextInput/OTPInput/Card/BottomSheet + theme | `design-system/src/index.ts`, zero app imports | ✓ |
| `react-native-maps`, `expo-location`, `expo-task-manager` declared & unused | both mobile `package.json` + `app.json`; zero source imports | ✓ |
| Hardcoded pickup (`home.tsx:21`) & driver GPS (`location-store.ts:4-5`) | direct read | ✓ |
| Driver location staleness mismatch: dispatch 60 s vs shared-config 5 min | `dispatch.service.ts` `DRIVER_LOCATION_MAX_AGE_MS=60_000` vs `constants.ts` `LOCATION_STALE_THRESHOLD_MINUTES=5` | ✓ |
| Tracking 6-step progress, 21-status message map | `tracking-web/.../track/[token]/page.tsx` | ✓ |
| Haversine + MockSMS + MockPayment providers; Hubtel SMS seam | `providers/` | ✓ |
| Money integer pesewas, `Pesewas` suffix, one presentation-boundary conversion | schema/services/`admin-web/src/lib/currency.ts` | ✓ |
| Node 24 (`.nvmrc`), engine ≥22, TS 5.6, npm workspaces | manifests | ✓ |
| Migrations `0000` + `0001` exist, append-only | `shared-db/src/migrations/` | ✓ |
| Shared packages compile to `dist/index.js` (CommonJS); design-system ships source | package `main`/`exports` | ✓ |
| `ENGINEERING_RULES.md` restates invariants faithfully | cross-checked vs `ARCHITECTURE_NOTES.md` | ✓ |

### 1.2 Conflicts found and already corrected (prior Product Governance task)

| Conflict (was) | Correction (now) | Where |
| --- | --- | --- |
| "31 permissions" | 30 permissions, 11 roles | Audit C5, Admin header, Vision §6 |
| "8 console.log sites / 5 in socket.ts" | 7 sites / 4 in socket.ts | Audit §6, Performance P6 |
| "8 routes" (passenger) | 7 page routes (listed) | Passenger header |
| OTP limits cited to `shared-auth/otp.ts` | cited to `auth.service.ts` + 3/15-min limit | Passenger §2.4 |
| Dangling "roadmap doc" reference | `KANSRIDE_PRODUCT_ROADMAP.md` §10 | Audit C1, footer |

### 1.3 Net verification result

After the prior corrections, **no remaining documentation-vs-repository conflicts were found**. The product/recovery/governance set is coherent with the repository. All cross-references resolve; all cited file paths exist; all numeric/contractual claims match code.

---

## 2. Engineering Readiness Assessment (Task 2)

### 2.1 Readiness Score

**Composite Engineering Readiness: 6.0 / 10** — "ready to begin V1 implementation **after Phase 0**, gated by external blockers and owner decisions." Completing Phase 0 (quality infrastructure + runtime enablement) raises readiness to ~8.0/10; resolving owner decisions D1/D2/D7 unlocks the critical path.

| Dimension | Score | Basis |
| --- | --- | --- |
| Architecture & contracts | 9 / 10 | Identity, money, transitions, dispatch, tracking all coherent and documented |
| Static recovery completeness | 8 / 10 | Sections A–G complete; runtime portion of G blocked |
| Documentation quality | 9 / 10 | Product + recovery + `.ai` governance complete and cross-verified |
| Client maturity | 4 / 10 | Early slices; C1–C5 defects; maps/GPS absent/hardcoded |
| Quality infrastructure (test/lint/CI) | 3 / 10 | No tests; lint broken (ESLint 9); CI ineffective (see §6) |
| Runtime verifiability | 2 / 10 | PostgreSQL `28P01` + no Redis listener (Blocker B1) |
| Decision clarity | 5 / 10 | 10 open owner decisions; 3 gate the critical path (D1/D2/D7) |
| Operational readiness | 2 / 10 | No secrets mgmt, monitoring, backups, or runbooks yet |

### 2.2 Repository Strengths

1. **Coherent backend with enforced invariants** — identity resolution, integer-pesewa money, 21-status state machine, conditional writes, post-persistence emission. (Highest-value asset; reuse for every new endpoint.)
2. **Provider abstraction seams** — `ISMSProvider`, `IMapsProvider`, `IPaymentProvider`: real providers land behind interfaces, no contract change.
3. **Secure public tracking** — token-scoped, minimized, terminal revocation; a genuinely well-designed capability.
4. **Typed payload contracts** — `RideUpdatePayload`, `AssignedDriverSummary`, `RideOfferPayload`, `PublicTrackingSnapshot` with a serializer that prevents leaking rows/PIN.
5. **Built design system** — `@kansride/ui` tokens + 5 components, ready to adopt.
6. **Exhaustive, verified documentation** — product set + recovery set + `.ai` governance; rare for this stage.
7. **Redis abstraction** — `RedisService`/`MemoryRedisService` swap cleanly for dev/prod.
8. **Proven client patterns** — driver reconnect + offer replay; tracking status system; admin typed React Query hooks + pesewa formatter.

### 2.3 Repository Weaknesses

1. **No automated tests** — zero test files; no `test` script in any workspace; root `npm test` runs nothing. Highest implementation risk.
2. **Lint broken** — ESLint 9 installed, `.eslintrc.json` is legacy v8 format; `next lint` deprecated. Lint job cannot gate quality.
3. **CI ineffective** — `ci.yml` runs only on `main`/`develop` (not the active `recovery/phase-2-opencode` branch); runs the broken lint + a root `tsc --noEmit` that the recovery docs call "not a valid all-app signal"; provisions PostGIS+Redis but only runs `nest build` (no migrations, no smoke, no tests); no mobile build job.
4. **Thin clients with critical defects** — C1 no map, C2/C3 hardcoded GPS, C4 mock payment, C5 no admin writes, dishonest empty/error states.
5. **Dead surface area** — `payments`/`audit_logs` tables never written; many RBAC permissions have no backing endpoints; `users.email`/`profilePhotoUrl` unsettable; statuses `driver_no_show`/`disputed` unreachable.
6. **No durable realtime delivery** — no outbox/replay, no Socket.IO Redis adapter; delivery is best-effort; reconnect replay covers only driver offers.
7. **Dispatch tuning duplicated** and inconsistent (60 s vs 5 min staleness) — divergence risk.
8. **No operational readiness** — no secrets management, observability, backups, or provisioning runbook; first-admin/driver approval is "out of band."
9. **Shared-package build-ordering hazard** — runtime needs `dist/`; `start:prod` breaks if packages aren't built first.
10. **Console noise + missing assets** — 7 passenger `console.log` sites; no app icon/splash assets (passenger).

### 2.4 Reusable Components (Task 6)

**Backend / shared packages (reuse directly):**
- Identity model + profile resolution; `VALID_RIDE_TRANSITIONS` (transition authority).
- `FareService` (`FareBreakdown`, integer-pesewa); `formatGhsFromPesewas` (admin-web `lib/currency.ts`).
- `@kansride/auth`: `JWTService`, `OTPService`, Ghana phone utils, `RBACService`.
- `@kansride/db`: Drizzle schema, singleton pool, `migrate.ts`.
- Provider interfaces `ISMSProvider` / `IMapsProvider` / `IPaymentProvider` (+ mock/Haversine/Hubtel impls as templates).
- Redis abstraction (`RedisService` / `MemoryRedisService`) for TTL / geo / set needs.
- Lifecycle serializer `ride-event.payload.ts` (prevents leaking rows/PIN) — reuse for any new lifecycle event.
- Typed payloads: `RideUpdatePayload`, `AssignedDriverSummary`, `RideOfferPayload`, `PublicTrackingSnapshot`, `CreateRideResponse`.

**Design system (adopt before new UI):**
- `@kansride/ui`: `colors`, `theme` (spacing/radius/typography/shadows), `Button`, `TextInput`, `OTPInput`, `Card`, `BottomSheet`. Full API in `docs/product/KANSRIDE_COMPONENT_LIBRARY.md`.

**Client patterns (reuse, don't fork):**
- Driver socket reconnect + `driver:get-offers` pending-offer replay (`mobile-driver/src/api/socket.ts`) — pattern for passenger reconnect/restore.
- Tracking 21-status message map + 6-step progress (`tracking-web/.../track/[token]/page.tsx`) — status UX grammar for all surfaces.
- Admin typed React Query hooks + skeleton/error/empty triad (`admin-web/src/lib/hooks.ts`, dashboard pages) — list-page pattern.
- Zustand auth/ride stores + AsyncStorage token client (both mobile apps).

### 2.5 Technical Debt to Resolve Before Implementation (Task 7)

Ordered by "blocks safe implementation":

1. **Lint: migrate to ESLint 9 flat config** (replace `.eslintrc.json`). Without this, no UI work is lintable and CI lint is red.
2. **Type-check: add per-workspace `type-check` scripts** + a real root aggregate (composite project references). Root `tsc --noEmit` is not a valid all-app signal.
3. **Test runner skeleton** (Vitest or Jest) + first invariant tests (identity resolution, money integrity, transition validity, rating race, history ownership). No tests exist; every change ships unverified.
4. **CI: run on the active branch (or retire the branch-name mismatch), wire migrations + a DB/Redis smoke job, fix lint/typecheck, add a `test` job once tests exist.** Currently CI is decorative.
5. **Consolidate dispatch tuning** into `shared-config`; reconcile 60 s vs 5 min staleness. (Approved task only — `ENGINEERING_RULES.md` §6.3.)
6. **Shared-package build ordering**: document/automate "packages before apps" so `start:prod` and CI never use stale `dist/`.
7. **Strip / `__DEV__`-gate** the 7 passenger `console.log` sites.
8. **App icon + splash assets** (passenger; driver parity) — store-build blocker.
9. **Decide dead surface**: for each dead RBAC permission / dead table, either schedule the build or explicitly defer in the roadmap so implementers don't assume capability. (Roadmap already marks most as V1.1/V2 — keep current.)
10. **README accuracy** (Recovery Plan Task 7d): commands, env names, architecture, and supported flows should match reality; stale Phase 1 claims removed.

### 2.6 Blockers (Task 8)

| ID | Blocker | Type | Unblocks |
| --- | --- | --- | --- |
| **B1** | Local PostgreSQL `28P01` (auth) + PG13 on :5432 vs stopped PG16 + no Redis listener | External / infra | All runtime verification |
| **B2** | Owner decision **D1** (mobile map engine) | Owner decision | Map foundation, map-dependent screens |
| **B3** | Owner decision **D2** (MoMo provider) | Owner decision | Real subscription payment; commercial pilot |
| **B4** | Owner decision **D3** (operating-zone polygon) | Owner decision | Curated destinations + admin defaults precision |
| **B5** | Owner decision **D7** (first-admin & driver-approval runbook) | Owner decision | Any deployment's onboarding |
| **B6** | No automated tests + broken lint | Internal / quality | Safe iterative implementation (resolve in Phase 0) |

Owner decisions D4–D6, D8–D10 do not block V1 implementation start; they gate later items (contact channel, cash records, routing/traffic, SMS sender, retention, analytics).

---

## 3. Architectural Risks (Task 5)

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R1 | **No durable event delivery** (no outbox/replay; no Socket.IO Redis adapter) | Multi-instance backend drops/loses events; clients miss transitions | Add Redis adapter + transactional outbox before >1 backend instance; document best-effort delivery until then (already in `ENGINEERING_RULES.md` §4.5) |
| R2 | **No tests + broken lint** | Regressions during the V1 feature push | Phase 0 quality infra (Debt 1–4) must precede feature work |
| R3 | **Dead tables/dead permissions imply capability that doesn't exist** | Implementers build on assumed-but-absent APIs | Roadmap already tags **[BE]**; keep V1 scope explicit; contract checks before depending on an endpoint |
| R4 | **Shared-package dual nature** (src for editor, dist for runtime) | `start:prod` / CI uses stale or absent `dist/` | Automate package-first build ordering (Debt 6); CI already builds packages before apps |
| R5 | **Mock providers mistaken for production** | Pilot could run on `MockPaymentProvider` (every payment "succeeds") — C4 | Real MoMo behind interface (D2); health endpoint surfaces mock-vs-live (Roadmap V1.1 system-health) |
| R6 | **Dispatch tuning duplicated & inconsistent** | "No drivers" confusion; divergence when tuned | Debt 5 (approved task); flag on any dispatch edit |
| R7 | **PostGIS enabled but unused for dispatch** (numeric columns + Redis geo + straight-line Haversine) | Unfair fares/ETAs at scale | Acceptable V1 (documented); real routing via `IMapsProvider` at V1.1 (D6) |
| R8 | **Best-effort socket delivery + no client restore-state** | Committed transition may not reach a briefly-disconnected client; passenger restore is V1.1 | Add restore-active-ride (V1.1); outbox (R1) |
| R9 | **`28P01` + no Redis locally** | Runtime-unverified; schema/flow defects surface late | Resolve B1 first (Phase 0); never claim runtime success until then |
| R10 | **First-admin/driver approval out-of-band** | Unprovisionable production or un-auditable approvals | Owner runbook D5/D7; audit-log writes with first admin mutations (V1) |
| R11 | **`MemoryRedisService` dev/prod divergence** | Tracking links lost on restart; can't coordinate multi-process | Document dev-only; require `REDIS_URL` in any multi-instance deploy |
| R12 | **Unused heavy mobile deps** (`react-native-maps` if MapLibre chosen) | Bloated/conflicting builds | Coordinated dependency hygiene with D1 decision |

---

## 4. Completion Summary Metrics

- **Engineering Readiness score:** **6.0 / 10** (Phase 0 → ~8.0/10; decisions D1/D2/D7 unlock critical path)
- **Repository strengths:** coherent backend/invariants; provider seams; secure tracking; typed payloads; built design system; comprehensive verified docs; proven client patterns.
- **Repository weaknesses:** no tests; broken lint; ineffective CI; thin clients with C1–C5 defects; dead surface area; no durable realtime; no operational readiness.
- **Risks:** R1–R12 (lead: durable-delivery gap, quality-infra gap, dead-surface assumptions, stale-dist hazard).
- **Blockers:** B1 runtime (external); B2 D1 map engine; B3 D2 MoMo; B4 D3 zone; B5 D7 runbook; B6 tests/lint (internal).
- **Recommended implementation order:** see `IMPLEMENTATION_PLAN.md` §3 (Phase 0 → Phase 1 defects → Phase 2 launch caps → Phase 3 V1 gate).
- **Estimated engineering phases:** 6 (Phase 0 Foundations → 1 V1 Defects → 2 V1 Capabilities → 3 V1 Verify/Pilot → 4 V1.1 Depth → 5 V2 Growth → 6 Production Hardening).
- **First implementation milestone:** see `IMPLEMENTATION_PLAN.md` §5 — **M0 "Implementation-Ready Foundation"** = B1 resolved + ESLint 9 flat config + per-workspace typecheck + test runner skeleton with invariant tests + design-system token plumbing, all on a green pipeline.
- **No-production-code confirmation:** this task produced planning documents only. No production code, API, authentication, database schema, migration, or business logic was modified. See §5.

## 5. Code-Safety Confirmation

This Engineering Readiness task was **planning and analysis only**. Verification was performed by reading files and config manifests; no builds, installs, migrations, or code edits were executed. Specifically:

- No files under `apps/` or `packages/` were modified.
- No APIs, authentication, database schema, migrations, or business logic were touched.
- No packages were installed (`node_modules` untouched); no builds or `tsc` invocations were run.
- The protected untracked files `apps/admin-web/next-env.d.ts` and `apps/tracking-web/next-env.d.ts` remain untouched.
- Only new planning documents were created, under `docs/engineering/`.

Final repository state is reported in the completion summary.