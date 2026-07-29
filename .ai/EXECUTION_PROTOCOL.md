# KansRide — Execution Protocol

**Last verified:** 2026-07-29
**Purpose:** a concise, reusable protocol for every AI-assisted KansRide session. It governs planning, implementation, validation, recovery, and handoff. On any conflict with the broader governance documents (`AI_WORKFLOW.md`, `MODEL_RESPONSIBILITIES.md`, `ENGINEERING_RULES.md`, `IMPLEMENTATION_GUIDELINES.md`), this protocol is the binding per-session read set and supersedes them only insofar as it narrows what a session must read; it never relaxes a rule.

---

## 1. Purpose

This protocol governs AI-assisted planning, implementation, validation, recovery, and handoff for KansRide. It exists to reduce prompt size and prevent models from rereading irrelevant project documentation on every session.

## 2. Stable execution gates

The execution gates are fixed unless a documented technical or availability reason requires a change:

| Gate | Model |
| --- | --- |
| Product Governance | Kimi K3 |
| Engineering Planning | GLM 5.2 |
| Production Engineering | GLM 5.2 |
| QA and Polish | DeepSeek Flash |

Model assignments change only when there is a dated, documented technical or availability reason recorded in `.ai/` governance.

## 3. Minimal-context rule

Every session reads **only**:

- `AGENTS.md`
- this execution protocol (`.ai/EXECUTION_PROTOCOL.md`)
- the phase-specific plan (e.g. `docs/engineering/IMPLEMENTATION_PLAN.md`, the active recovery phase)
- documents directly relevant to the affected subsystem

Do **not** read all product and engineering documents unless the task genuinely spans the entire system. Examples:

- passenger work → passenger documentation
- driver work → driver documentation
- admin work → admin documentation
- map work → map documentation
- tooling work → engineering documentation
- payment work → payment and money-contract documentation

## 4. Session contract

Every session must declare, before editing:

- **phase** — which engineering phase the task belongs to
- **objective** — the single bounded goal
- **allowed scope** — files/subsystems that may be touched
- **prohibited scope** — files/subsystems that must not change
- **contracts to preserve** — invariants that must hold (see §7)
- **documents to read** — the minimal-context set for this task
- **validation commands** — the commands that will prove the change
- **expected commit structure** — conventional subject + scope
- **final-report structure** — see §12

## 5. Inspect-before-edit rule

Before any edit, the model must:

- inspect `git status --short` and the current branch
- inspect the relevant implementation (code, schema, clients)
- determine whether the work already exists and is complete
- preserve unrelated changes
- avoid repeating completed work

## 6. Implementation rules

- smallest safe change; one approved task per change
- no speculative architecture
- no unrelated refactoring
- no weakening of validation simply to obtain a pass
- no secret creation or exposure; no full environment-file contents
- no destructive database commands (no reset, no drop, no guessed passwords; migrations are append-only)
- explicit handling of blocked runtime dependencies (label as pending, never as passed)

## 7. Contract preservation

At minimum these contracts must be preserved:

- authentication and authorization (RBAC, JWT claim shape)
- user/profile identity mapping — JWT `req.user.userId` is `users.id`; resolve `passengers.id`/`drivers.id` through the profile tables; never compare `users.id` directly with `rides.passengerId`/`rides.driverId`
- integer-pesewa money handling (`Pesewas`-suffixed fields; minimum before the ×1.5 priority multiplier; no fractional pesewas)
- API compatibility (route/payload contracts between `shared-types`, backend controllers, and clients)
- database schema and migration integrity (append-only migrations; no DOWN scripts)
- ride-state transitions (`VALID_RIDE_TRANSITIONS` validity)
- ownership and access control (ride-history ownership, cancellation actor mapping)
- dispatch behaviour unless intentionally changed and tested (conditional writes, single-winner accept, `rated_by IS NULL` race)

These invariants may only be restated, never relaxed by a model.

## 8. Commit protocol

- small, task-scoped commits; reviewer can read one in one sitting
- never `git add .`; stage exact reviewed paths only
- never commit/stage/branch/reset/clean/rewrite-history without explicit instruction
- never commit secrets or full env-file contents
- leave `apps/admin-web/next-env.d.ts` and `apps/tracking-web/next-env.d.ts` untouched, unstaged, and uncommitted
- keep the immutable tags (`phase2-task2c-complete`, `phase2-task2d-complete`, `phase3-task3a-complete`, `phase2-context-docs-complete`) untouched

Conventional subject examples:

- `fix(rides): ...`
- `feat(driver): ...`
- `test(core): ...`
- `chore(lint): ...`
- `docs(product): ...`
- `ci(...): ...`

A command may not be recorded as successful unless it actually ran and exited 0. A model must not stage unrelated files.

## 9. Validation protocol

Truthful reporting is mandatory. A command may be reported as successful only when it actually ran and exited successfully. Distinguish and label each result as:

- **static validation** — focused `tsc --noEmit -p <ws>/tsconfig.json`, lint, `git diff --check`, `git status --short`
- **unit tests** — invariant/logic tests (`npm test` once a `test` script exists)
- **integration validation** — service + Drizzle + Redis against isolated containers
- **runtime validation** — live Postgres/PostGIS + Redis end-to-end matrix
- **remote CI validation** — pipeline result on the active branch

Do **not** treat a configured CI step as proof that CI passed; only the actual remote run counts. Runtime-blocked items (B1 `28P01`, no Redis) are reported as **pending**, never "passed".

## 10. Runtime limitations

Current local constraints:

- Docker is unavailable locally because firmware virtualization settings cannot be changed.
- local PostgreSQL currently returns `28P01` (password auth failure) — runtime blocked.
- local Redis is unavailable.

Therefore runtime validation should use **GitHub Actions**, and — only when interactive debugging is necessary — **GitHub Codespaces**.

This does **not** prevent ordinary local implementation, linting, type-checking, unit tests, or builds. Those proceed locally.

## 11. Interruption recovery

If a model session or internet connection fails:

- cancel the request only — do not force-clean the tree
- inspect `git status` and `git diff`
- preserve valid completed commits
- restart from the smallest unfinished task
- never assume uncommitted edits exist
- do not repeat completed work

## 12. Completion report

Every implementation session must report only:

- tasks completed
- files changed
- commits created
- validation commands and actual results (static vs runtime)
- blockers
- exact owner actions required
- deferred work
- final `git status --short`
- confirmation of prohibited work not performed

## 13. Phase progression

A phase may close only when:

- scoped work is completed or explicitly blocked
- validation is honestly reported (static/runtime labelled)
- commits are created
- the working tree is clean, or remaining changes are explained
- deferred work is recorded

Do **not** begin the next phase automatically. Await explicit approval.

## 14. Current project status

- Product Governance — complete
- Engineering Readiness — complete
- Phase 0A — complete
- Phase 0B — complete
- 63 unit/invariant tests passing locally
- local lint and type-check passing
- web builds passing
- remote CI still requires confirmation after push
- next planned phase — **Phase 1 V1 defect correction**