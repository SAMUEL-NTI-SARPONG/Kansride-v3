# KansRide — AI Workflow

**Last verified:** 2026-07-28
**Purpose:** the end-to-end workflow every AI agent follows in this repository, for both documentation and implementation tasks. It wraps `AGENTS.md`, `MODEL_RESPONSIBILITIES.md`, `ENGINEERING_RULES.md`, and `IMPLEMENTATION_GUIDELINES.md` into one loop.

---

## 1. Intake — Classify the Task

| Class | Examples | Code changes allowed? |
| --- | --- | --- |
| **Documentation** | audits, product docs, `.ai` governance, consolidation | No |
| **Analysis/research** | answering questions about the codebase with evidence | No |
| **Implementation (recovery)** | tasks from `RECOVERY_PLAN.md` | Yes — approved scope only |
| **Implementation (product)** | V1 items from `KANSRIDE_PRODUCT_ROADMAP.md` | Yes — approved scope only; **[BE]** items need separate approval |

If the class is ambiguous, ask before acting. If the task is interrupted work, **continue it** — inspect what exists, preserve useful output, complete only what is missing.

## 2. Read Set (before any output)

1. Always: `AGENTS.md`, `.ai/PRODUCT_CONTEXT.md`, `.ai/MODEL_RESPONSIBILITIES.md`, `.ai/ENGINEERING_RULES.md`.
2. Engineering state: `docs/recovery/PROJECT_STATE.md` (+ `RECOVERY_PLAN.md`, `ARCHITECTURE_NOTES.md` for code-adjacent work).
3. Product work: `docs/product/KANSRIDE_MASTER_PRODUCT_SPECIFICATION.md` + the specific topic docs.
4. Git state: `git status --short`, current branch, recent log. Protected untracked files (`apps/admin-web/next-env.d.ts`, `apps/tracking-web/next-env.d.ts`) stay untouched.

## 3. Inspect & Verify

- Trace the actual code/schema/client paths the task touches; grep before citing.
- Reconcile the task with the recovery boundary: what is statically complete, what is runtime-blocked (`28P01`, Redis).
- Identify conflicts between layers (code > recovery docs > product docs) and plan their correction.

## 4. Plan & Approval

Present: findings, proposed behavior/changes, affected files, risks, and validation commands. Wait for explicit approval when the task class or scope requires it (all implementation; scope expansion of any kind). Owner-decision items (Roadmap §10) escalate to the owner — never self-decide.

## 5. Execute

- One task, minimal diff, existing code style, no unrelated refactoring.
- Documentation tasks: write/complete/correct docs only; keep dates and cross-references current; preserve existing useful work.
- Implementation tasks: standards in `IMPLEMENTATION_GUIDELINES.md` §2–§3; invariants in `ENGINEERING_RULES.md`.

## 6. Validate

Per `IMPLEMENTATION_GUIDELINES.md` §4: focused `tsc --noEmit` per affected workspace, builds when bundling changes, `git diff --check`, `git status --short`. Label every result **static** or **runtime**; runtime-blocked items are reported as pending, not passed.

## 7. Report (required format)

Every completed task ends with a concise report containing:

1. **Documents/files preserved** — useful existing work left intact.
2. **Documents/files completed or corrected** — with the conflict → resolution note for each correction.
3. **Documents/files created.**
4. **Major findings** — anything the owner should know (defects, conflicts, risks).
5. **Owner decisions** — open decisions touched or needed (Roadmap §10 refs).
6. **Validation** — commands run and results, static vs runtime.
7. **Code-safety confirmation** — explicit statement that no production code / API / auth / schema / migration was modified (for documentation tasks), plus final `git status --short`.

## 8. Stop & Handoff

- Stop after the assigned task. Do not roll into the next roadmap/recovery item without new approval.
- Never commit/stage/branch unless explicitly instructed; then exact reviewed paths only, one task-scoped commit.
- Leave the tree clean: only the two protected `next-env.d.ts` files plus intentionally created/modified task files may appear in `git status --short`.

## 9. Governance Maintenance

- `.ai/` files change only through dated, documented edits when governance itself changes — never silently.
- If a task reveals that `AGENTS.md`-referenced material (structure, workflows, rules) changed, flag it so `AGENTS.md` and the recovery docs can be updated in an approved documentation task.
