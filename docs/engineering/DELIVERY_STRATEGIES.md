# KansRide — Delivery Strategies

**Date:** 2026-07-28
**Phase:** Engineering Readiness (planning only — no implementation)
**Scope:** commit, validation, rollback, and testing strategies for the implementation phases in `IMPLEMENTATION_PLAN.md`. Binding rules come from `AGENTS.md`, `.ai/ENGINEERING_RULES.md`, and `.ai/AI_WORKFLOW.md`; this document operationalizes them.
**Constraints:** planning only. No code changes are authorized by this document.

---

## 1. Commit Strategy (Task 9)

### 1.1 Principles (from AGENTS.md — restated, binding)

- **One approved task per commit.** Small, task-scoped, reviewable.
- **Never `git add .`** — stage exact reviewed paths only.
- **Never commit, stage, change branch, reset, clean, or rewrite history without explicit instruction.**
- **Never commit secrets** or full environment-file contents.
- **Leave `apps/admin-web/next-env.d.ts` and `apps/tracking-web/next-env.d.ts` untouched, unstaged, uncommitted.**
- **Tag only stable reviewed checkpoints after explicit instruction.** Keep `phase2-task2c-complete`, `phase2-task2d-complete`, `phase3-task3a-complete`, and `phase2-context-docs-complete` immutable.

### 1.2 Conventions

- **Subject** — conventional, scope-specific, matching recent history: `fix(rides): ...`, `feat(driver): ...`, `feat(admin-web): ...`, `chore(lint): ...`, `docs(product): ...`, `docs(engineering): ...`.
- **Body** — what changed, why, the validation run, and static-vs-runtime note; reference the task/roadmap item (e.g., "Roadmap §4.1 C2").
- **Size** — a commit is reviewable in one sitting; split a task into staged commits only if the task explicitly approves it.
- **Separation** — documentation commits separate from code commits where the task is doc-only; recovery-log entries only when the task scope names that file.

### 1.3 Pre-commit gating (target, after Phase 0)

- Focused `tsc --noEmit -p <affected-workspace>/tsconfig.json` green.
- `npm run lint --workspace=<affected>` green (once ESLint 9 flat config lands).
- Affected invariant tests green (once the runner lands).
- `git diff --check` clean; focused diff reviewed; `git status --short` inspected.

### 1.4 Branch strategy

- Continue on `recovery/phase-2-opencode` or move to an `engineering/phase-N-*` branch **only by explicit instruction**. Do not create/switch branches unilaterally.
- The CI `ci.yml` currently targets `main`/`develop`; until CI is fixed (Debt 4), do not assume green CI on the active branch — rely on focused local validation and report CI status honestly.

### 1.5 What never lands in a commit

- Secrets, `.env` contents, raw credentials.
- The two protected `next-env.d.ts` files.
- Unrelated refactors mixed into a task commit.
- Generated `dist/` unless a build-output commit is explicitly approved.
- Recovery-architecture or migration-intent changes smuggled into a feature commit.

---

## 2. Validation Strategy (Task 10)

Every task reports validation as **static** or **runtime**, never blurring them. PostgreSQL runtime remains blocked by B1 (`28P01`) + no Redis listener until Phase 0 resolves them.

### 2.1 Static (every change)

```powershell
# Focused type check per affected workspace (ARCHITECTURE_NOTES §Validation)
npx tsc --noEmit -p packages/shared-types/tsconfig.json
npx tsc --noEmit -p packages/shared-config/tsconfig.json
npx tsc --noEmit -p packages/shared-db/tsconfig.json
npx tsc --noEmit -p packages/shared-auth/tsconfig.json
npx tsc --noEmit -p packages/design-system/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npx tsc --noEmit -p apps/admin-web/tsconfig.json
npx tsc --noEmit -p apps/tracking-web/tsconfig.json
npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json
npx tsc --noEmit -p apps/mobile-driver/tsconfig.json

# Builds when bundling/behavior changes
npm run build --workspace=apps/backend
npm run build --workspace=apps/admin-web
npm run build --workspace=apps/tracking-web
npm run build --workspace=@kansride/types
npm run build --workspace=@kansride/config
npm run build --workspace=@kansride/db
npm run build --workspace=@kansride/auth

# Lint (once flat config lands) per affected workspace
npm run lint --workspace=<affected>

# Always
git diff --check
git status --short
```

Qualification (from `ARCHITECTURE_NOTES.md`): root `tsc --noEmit` is **not** a valid all-app signal; root `npm test` runs nothing (no workspace defines `test`); `next lint` is deprecated. Use the focused commands above.

### 2.2 Runtime (after B1 resolved — Phase 0 onward)

- Apply migrations to an isolated Postgres/PostGIS: `npm run db:migrate --workspace=packages/shared-db`. No reset; no guessed passwords.
- Redis-backed dispatch, Socket.IO, tracking, and cleanup against a running Redis (or documented in-memory dev fallback for single-process).
- Documented end-to-end matrix from `RECOVERY_PLAN.md` Phase A–E: OTP login → profile → ride create → dispatch → accept → status progression → PIN → complete → rate; cancellation per actor; RBAC per role; tracking issue/revoke/terminal.
- Concurrent duplicate-rating behavior and transaction rollback against PostgreSQL.
- Reconnect/offer-replay against Redis.

### 2.3 CI gates (target state)

- lint-and-typecheck job (flat config + per-workspace typecheck) green.
- build-packages job green (package-first ordering).
- build-backend job green **and** runs migrations + a `GET /health` smoke against the provisioned PostGIS+Redis services.
- build-web job green.
- `test` job (once a test script exists) — invariant + integration tests.
- Later: mobile EAS build job (gated by owner decision on distribution).

### 2.4 Acceptance & quality gates

- Per release: Roadmap §9 gate (V1/V1.1).
- Per screen: Accessibility §9 checklist; Performance §3 budgets.
- Per change: invariants in `.ai/ENGINEERING_RULES.md` hold (identity, money, transitions, conditional writes, minimized payloads).

### 2.5 Reporting

- Each validation result labelled **static** or **runtime**; runtime-blocked items reported as **pending**, never "passed".
- Record exact commands and outcomes in the task report (per `AI_WORKFLOW.md` §7).

---

## 3. Rollback Strategy (Task 11)

There is no production system yet, so rollback is currently about the code branch and future staged rollout, not live data.

### 3.1 Code rollback (now)

- **Revert the offending commit(s)** on the branch (`git revert <sha>`); rebuild packages; redeploy. Never force-push or rewrite history without explicit instruction (AGENTS.md).
- Each commit is task-scoped and reviewable, so revert granularity matches task granularity.

### 3.2 Schema rollback (forward-only by design)

- Migrations are **append-only**; no DOWN scripts by design (`ENGINEERING_RULES.md` §5.1). Rolling back a schema change = a **new forward migration that reverses the effect**, never a drop or rewrite of an applied migration.
- Before any runtime migration in a real environment: take a DB backup; apply to a staging copy first; verify the documented invariant set.

### 3.3 Risky-change rollout (when pilot begins)

- **Feature flags** for risky changes (real MoMo provider, Socket.IO Redis adapter, outbox, admin write mutations) so they can be disabled without a revert.
- **Staged rollout**: backend behind a flag; mobile via Expo update channels where possible; web via redeploy of the previous Next build.
- **Canary one backend instance** before scaling; revert if error budget breached.

### 3.4 Data & client safety

- Never widen a destructive operation's blast radius; keep `rides.cancelledBy`/`ratedBy` as `users.id`; never relax ownership checks for a rollback.
- Mobile builds are immutable shipped artifacts; keep the previous build reachable; ship updates via channels, not forced upgrades, unless safety-critical.
- `MemoryRedisService` is dev-only; any multi-instance deploy must use `REDIS_URL` (roll back a deploy that accidentally ran in-memory mode in prod).

### 3.5 Current-state note

While B1 persists, there is no live runtime to roll back; the emphasis is on **small, flag-gated, reviewable commits** so that code rollback is trivial once a runtime exists.

---

## 4. Testing Strategy (Task 12)

### 4.1 Layers

| Layer | Scope | Tooling (recommended) | Priority |
| --- | --- | --- | --- |
| **Unit** | pure logic: `FareService`, `VALID_RIDE_TRANSITIONS`, `OTPService`, `RBACService`, phone utils, pesewa formatting | Vitest or Jest | Critical — write first |
| **Integration** | service + Drizzle + Redis against isolated containers (PostGIS, Redis) | Vitest/Jest + testcontainers | High |
| **Contract** | `packages/shared-types` vs backend controllers vs client callees — drift detection | Type-level + snapshot of route/payload shapes | High |
| **Component** | `@kansride/ui` new/extended components (props, states, a11y) | React Native Testing Library | Medium |
| **E2E** | mobile journeys (request→PIN→rate; online→offer→complete) and web (tracking, admin) | Detox (mobile) / Playwright (web) | Later (after V1 features) |
| **Manual QA** | a11y checklist, device-lab perf budgets, end-to-end matrix | Checklists in Accessibility §9 / Performance §3 | Per release gate |

### 4.2 First tests (highest regression cost — write in Phase 0)

1. Identity resolution: passenger/driver profile from JWT `userId`; never compare `users.id` to `rides.passengerId`/`driverId`.
2. Ride ownership enforcement (passenger/driver).
3. Rating race: `rated_by IS NULL` conditional update; concurrent loser conflict; `drivers.rating` live-AVG recompute atomicity.
4. Conditional dispatch/acceptance: only one winner under concurrent accepts; expired/ineligible offers rejected.
5. Money integrity: integer pesewas end-to-end; `Pesewas`-suffixed fields; minimum applied before the ×1.5 priority multiplier (ceil); no fractional pesewas.
6. Ride-type validation: only canonical values pass before fare/persistence; others HTTP 400.
7. Cancellation actor mapping: role → actor → status; super_admin only for `cancelled_by_admin`.
8. Public-tracking token: SHA-256-keyed grant; 6 h TTL; terminal revocation; raw ride ID never authorizes.

### 4.3 Approach notes

- **Property/random tests** for fare math (integer-pesewa invariant across distance/time min/max; minimum-before-multiplier).
- **Migration tests**: apply `0000`→`0001` (and future) to a fresh PostGIS; assert schema + idempotency; never run against a reset shared DB.
- **Integration**: mirror CI services (`postgis/postgis:16-3.4`, `redis:7-alpine`) via testcontainers; run the documented runtime matrix automatically where feasible.
- **Contract drift**: generate a golden surface from `shared-types` and assert backend controllers + client callees conform; fails a change that adds a field clients don't read or removes one they do.
- **No false greens**: tests run only when a `test` script exists; until then, invariant tests are the seed that makes `npm test` meaningful.

### 4.4 CI integration

- Add a `test` job once a `test` script exists; depends on `build-packages`; uses the PostGIS+Redis services already in `ci.yml`.
- Add a migration step + `GET /health` smoke to `build-backend`.
- Add mutation-aware integration tests (isolated services) where appropriate (`RECOVERY_PLAN.md` Task 7f).
- Per-release: the manual QA gates (a11y/perf matrix) are run-and-recorded, not automated initially.

### 4.5 What tests must never weaken

- The invariants in `.ai/ENGINEERING_RULES.md` (identity, money, transitions, conditional writes, minimized payloads). A test that asserts a relaxed invariant is a review-blocker.

## 5. Status

Planning only. No implementation, builds, installs, or code changes were performed. These strategies activate compartment-by-compartment beginning with Phase 0 / milestone M0 in `IMPLEMENTATION_PLAN.md`.