# KansRide — Implementation Plan

**Date:** 2026-07-28
**Phase:** Engineering Readiness (planning only — no implementation)
**Scope:** dependency graph, implementation order that minimizes rework, engineering phases to production, and the first implementation milestone. Derived from `docs/product/KANSRIDE_PRODUCT_ROADMAP.md` (release scope) and `docs/recovery/RECOVERY_PLAN.md` (recovery workflow), with engineering sequencing added.
**Constraints:** planning only. **[BE]** items require separately-approved backend tasks; owner-decision items are blocked until decided (`ROADMAP.md` §10). No code changes are authorized by this document.

---

## 1. Guiding Principle (minimize rework)

Build **foundations before features**: runtime enablement, quality infrastructure, design-system adoption groundwork, and the map foundation must land before screen-by-screen feature work. This prevents building screens twice — once against a placeholder and again against the real foundation. Where a screen is touched, the design system is adopted in the same change (no big-bang refactor), but the token/component groundwork must precede the first screen.

Sequencing sources (do not contradict): Roadmap §8 (maps/GPS first; admin write path in parallel; design-system adoption rides with touched screens; MoMo gates commercial pilot) and `AGENTS.md` (one approved task at a time; recovery workflow for **[BE]** items).

## 2. Dependency Graph (Task 3)

Workstreams (V1 scope from Roadmap §4). Arrows mean "must precede" or "gates".

```
Owner decisions:  D1 (map engine) ─┐           D2 (MoMo) ─┐        D3 (zone) ─┐
                                   │                      │                   │
                                   ▼                      ▼                   ▼
Phase 0 ── WS0a Runtime enablement (B1) ──┐ (runtime verification of everything below)
      └── WS0b Quality infrastructure (B6)─ lint flat config, per-ws typecheck, test skeleton, CI fix
      └── WS0c Design-system groundwork ─── token plumbing into both apps + web tailwind, base components
      └── WS0d Map foundation ────────────── (gated by D1) KansStyle, markers, camera, live wiring

Phase 1 ── WS1a Driver GPS wiring (C2) ──── depends on WS0d (nav visual)
      ├── WS1b Passenger GPS + permission (C3) ── depends on WS0c (PermissionPanel), WS0d (map)
      ├── WS1c Honest-state sweep (H3/H4/H6/H7/H8/H9) ── depends on WS0c (Toast/Banner/EmptyState skeletons)
      ├── WS1d console.log cleanup + app icon/splash (K)
      └── WS0a/b/c/d themselves close

Phase 2 ── WS2a Admin write path [BE] ──── independent of mobile; approve/reject + suspend + ride investigation + audit writes
      ├── WS2b Real MoMo provider [BE] ──── gated by D2; subscription payment states
      ├── WS2c Safety/Support screens ──── depends on WS0c; static content + deep links (no [BE] in V1)
      ├── WS2d Driver history tab + ride detail ── depends on WS0c; backend /my-rides (driver) exists
      └── WS2e Fare estimate range ─────── depends on WS0d (map) for pickup; constants-only (no [BE])

Phase 3 ── WS3 V1 verification & pilot gate ── depends on B1 + all V1 workstreams
              (end-to-end runtime matrix, a11y checklist, perf budgets, provisioning runbook D7)

Later:    WS4 V1.1 operational depth   |   WS5 V2 growth   |   WS6 production hardening
```

### 2.1 Edge list (explicit dependencies)

| From | To | Why |
| --- | --- | --- |
| D1 | WS0d | Engine choice precedes map implementation |
| D2 | WS2b | Provider choice precedes real payment |
| D3 | WS2e (curated destinations) | Zone polygon refines destination list |
| WS0a (B1) | runtime verification of *all* | No runtime claim until Postgres/Redis live |
| WS0b (B6) | all feature work (safe iteration) | Lint + typecheck + tests gate every change |
| WS0c | WS1b, WS1c, WS2c, WS2d | Permission/Toast/Banner/EmptyState components first |
| WS0d | WS1a, WS1b, WS2e | Map visual precedes GPS nav + pickup map |
| WS0d | Phase 1 GPS visual | nav mode needs the map |
| WS2a | pilot driver onboarding | drivers can't be approved otherwise (C5) |
| WS2b | commercial pilot | cash-only pilot possible without it, but driver fee uncollected |
| WS3 | launch | release gate (Roadmap §9) |

### 2.2 Independence (parallelizable)

- **WS2a (admin write path [BE])** is independent of all mobile work — parallel track.
- **WS2b (MoMo [BE])** is independent once D2 is decided — parallel track.
- **WS0a (runtime)** and **WS0b (quality infra)** can proceed in parallel with **WS0c/WS0d foundations** (different owners/files).

## 3. Implementation Order (Task 4 — minimizes rework)

Strict sequence within the critical path; parallel where noted.

1. **Resolve B1 locally** (PostgreSQL/PostGIS credentials + version + Redis) — runbook only; not code. Unblocks all runtime verification.
2. **ESLint 9 flat config** + **per-workspace `type-check` scripts** + **root aggregate typecheck** — make changes lintable/typeable.
3. **Test runner skeleton** + **first invariant tests** (identity resolution, money integrity, transition validity, rating race, history ownership).
4. **CI fix** (active branch; migrations + smoke; later `test` job).
5. **Design-system groundwork** — token plumbing into both mobile apps + web Tailwind; wire `@kansride/ui` base components; a11y role/label props on adoption.
6. **Map foundation** (gated by D1) — KansStyle day/night, marker grammar, camera, live wiring over existing socket contracts.
7. **Driver GPS wiring** (C2) — `expo-location` → location store → socket; stationarity gating; GPS-off gate.
8. **Passenger GPS + permission flows** (C3) — current-location pickup, manual fallback, permission denied/off.
9. **Honest-state sweep** — offline/reconnect/error/empty-vs-error, session-expired global handler, console.log cleanup (7 sites), app icon/splash.
10. **Admin write path [BE]** (parallel with 7–9) — driver approval queue + approve/reject, user suspend, ride investigation, audit-log writes.
11. **Real MoMo provider [BE]** (gated by D2, parallel) — behind `IPaymentProvider`; subscription payment states.
12. **Safety + Support screens** — emergency numbers, PIN/share explainers, ops line, FAQ (no [BE] for V1).
13. **Driver history tab + ride detail from history** — reuse activity pattern; backend already supports driver `/my-rides`.
14. **Fare estimate range** before request — constants-only; never overrides backend fare.
15. **V1 gate verification** — end-to-end runtime matrix; a11y checklist; perf budgets; provisioning runbook (D7); pilot go/no-go.

Rework avoided: steps 2–6 are foundations; steps 7–14 build screens once atop them. Building screens earlier (e.g., passenger home before the map foundation) would require rework — explicitly disallowed by the Roadmap §8 sequencing.

## 4. Engineering Phases to Production (Task 13)

| Phase | Name | Scope | Exit gate |
| --- | --- | --- | --- |
| **0** | Foundations & quality infrastructure | B1 runtime runbook; ESLint 9 flat config; per-workspace typecheck; test runner + invariant tests; CI fix; design-system token plumbing; map foundation (D1) | Green pipeline; invariant tests pass; design-system wired; map renders |
| **1** | V1 defect fixes | Driver GPS (C2); passenger GPS+permission (C3); honest-state sweep (H3/H4/H6/H7/H8/H9); console.log cleanup; app icon/splash | No fake data/positions; offline+error states on all live screens; icon/splash present |
| **2** | V1 launch capabilities | Admin write path [BE] (C5); real MoMo [BE] (C4, D2); safety/support screens; driver history + ride detail; fare estimate | Drivers approvable; subscriptions payable; safety/support reachable |
| **3** | V1 verification & pilot | End-to-end runtime matrix; a11y checklist; perf budgets; provisioning runbook (D7); pilot go/no-go | Roadmap §9 V1 gate met |
| **4** | V1.1 operational depth | Socket-driven admin live map/feed; restore-active-ride; documents [BE]; masked contact (D4); analytics/incidents basics [BE]; SMS notifications; name capture [BE] | Roadmap §9 V1.1 gate met |
| **5** | V2 growth | `parcel_delivery`; MoMo ride fares; zones/config UI [BE]; demand forecasting; offline packs; traffic (D6) | Per-feature approval |
| **6** | Production hardening | Secrets management; observability; backups; security review; scaling; multi-instance Socket.IO adapter + outbox (R1); rolling deploy + rollback drills | Deployment-readiness review pass |

Phases 0–3 deliver V1 pilot; 4 deepens; 5 grows; 6 makes it production-grade. Each item inside a phase is a separately-approved task per `AGENTS.md`/`AI_WORKFLOW.md`; **[BE]** items follow the recovery workflow.

## 5. First Implementation Milestone

**M0 — "Implementation-Ready Foundation"** (the first thing to build, end of Phase 0):

- B1 resolved: a documented, repeatable local Postgres/PostGIS + Redis runbook; migrations apply without reset; test roles provisionable. (No secrets committed.)
- ESLint 9 flat config live; `npm run lint` green for affected workspaces.
- Per-workspace `type-check` scripts; focused `tsc --noEmit -p <ws>/tsconfig.json` green for shared packages + backend + webs.
- Test runner skeleton (Vitest or Jest) with the first invariant tests passing: identity resolution (passenger/driver from JWT), money integer-pesewa integrity, `VALID_RIDE_TRANSITIONS` validity, rating race (`rated_by IS NULL`), ride-history ownership.
- CI runs on the active branch (or branch mismatch retired); lint + per-workspace typecheck + package builds green.
- Design-system tokens plumbed into both mobile apps + web Tailwind; `@kansride/ui` base components importable from a sample screen.
- Map engine decision D1 recorded; if decided, map foundation renders a styled map on one surface.

**Acceptance:** a contributor can pick a V1 workstream and implement it with lint + typecheck + invariant tests gating every change, against a real (local) runtime, using tokens/components — and a green CI pipeline confirms it. This is the precursor to all feature work; reaching M0 moves readiness from 6.0 → ~8.0/10.

**What M0 deliberately excludes:** any feature screen, any API/schema change, any provider integration — those begin at Phase 1 / 2 as separately-approved tasks.

## 6. Status

Planning only. No implementation has begun; no code was modified. This document will be re-baselined when M0 is reached and as each owner decision lands.