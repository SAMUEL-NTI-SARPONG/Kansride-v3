# KansRide — AI Model Responsibilities

**Last verified:** 2026-07-28
**Purpose:** what an AI model working in this repository is responsible for, and what it must never do. Complements `AGENTS.md`; on any conflict, `AGENTS.md` and the recovery documents win.

---

## 1. Standing Responsibilities (every task)

1. **Read before acting.** Minimum read set per task: `AGENTS.md`, `docs/recovery/PROJECT_STATE.md`, and the `.ai/` files. Add `docs/recovery/RECOVERY_PLAN.md` + `ARCHITECTURE_NOTES.md` for any code-adjacent task; add the relevant `docs/product/` docs for product/UX tasks.
2. **Inspect, don't assume.** Verify claims against the repository (grep/read the actual code, schema, clients) before writing anything that cites them. Product docs carry evidence citations — keep them accurate.
3. **Preserve useful work.** Continue interrupted work; never restart or rewrite existing documents wholesale. Correct them surgically.
4. **Stay inside the approved task.** One bounded task at a time; no drive-by refactoring; stop when the task is done.
5. **Report honestly.** Distinguish static validation from runtime validation. The PostgreSQL `28P01`/Redis blocker is still in effect — never claim runtime success.

## 2. Documentation Authority by Layer

| Layer | A model may | A model may not |
| --- | --- | --- |
| **Code** | Read. Modify only inside an explicitly approved implementation task. | Modify during documentation/analysis tasks. Touch protected files (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`). |
| **`docs/recovery/`** | Read. Update only when the approved task scope names the file. | Rewrite history, remove limitations, or mark runtime-blocked items complete. |
| **`docs/product/`** | Read, create, complete, and correct — product docs are the model's working set. | Present undecided owner decisions as decided; authorize backend/contract changes (use **[BE]** markers). |
| **`.ai/`** | Read; propose updates when the governance itself changes. | Weaken a rule silently. Rule changes are documented, dated edits. |

## 3. Responsibility Boundaries (what belongs to whom)

- **Product owner:** every decision in `docs/product/KANSRIDE_PRODUCT_ROADMAP.md` §10 (map engine, MoMo provider, zone polygon, contact channel, cash records, routing/traffic, provisioning, SMS sender, retention, analytics), release go/no-go, scope moves.
- **AI models:** research, audit, documentation, consolidation, and — only when explicitly tasked — implementation within the recovery workflow. Models recommend; owners decide.
- **Recovery workflow (AGENTS.md):** task approval, branch/commit/staging decisions. Models never commit, stage broadly, or change branches without explicit instruction.

## 4. Hard Prohibitions

1. No production-code, API, authentication, database-schema, or migration changes during documentation or product tasks.
2. No secrets, credentials, or full environment-file contents in any document.
3. No fake success: no "verified" claims for runtime-blocked flows; no invented repository evidence; no fabricated file citations.
4. No completion percentages, no "almost done" — state what is confirmed, limited, and pending (mirror `PROJECT_STATE.md` style).
5. No new dependencies, installs, or deletions outside the working directory without owner confirmation.
6. No weakening of the invariants in `ENGINEERING_RULES.md` — they may only be restated, never relaxed by a model.

## 5. When a Model Finds a Conflict

1. Confirm against code (the final truth).
2. Correct the losing document in the same task with a minimal, dated edit.
3. Record the correction in the task report (what conflicted, what code says, what was changed).
