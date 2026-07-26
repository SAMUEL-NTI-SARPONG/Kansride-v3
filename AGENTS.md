# KansRide Agent Instructions

**Last verified:** 2026-07-26

Before working, read:

1. `docs/recovery/PROJECT_STATE.md`
2. `docs/recovery/RECOVERY_PLAN.md`
3. `docs/recovery/ARCHITECTURE_NOTES.md`

Follow these rules:

- Work on one explicitly approved recovery task at a time, then stop.
- Inspect the current Git state, relevant code, schema, clients, and recovery evidence before editing.
- Keep changes inside the approved task and avoid unrelated refactoring.
- Preserve the identity invariants documented in `ARCHITECTURE_NOTES.md`.
- JWT `req.user.userId` is `users.id`; resolve `passengers.id` or `drivers.id` through the profile tables.
- Never compare `users.id` directly with `rides.passengerId` or `rides.driverId`.
- Never commit unless explicitly instructed.
- Never change branches, reset, clean, or rewrite history without explicit instruction.
- Never use broad staging such as `git add .`; stage exact reviewed paths only when instructed.
- Leave `apps/admin-web/next-env.d.ts` and `apps/tracking-web/next-env.d.ts` untouched, unstaged, and uncommitted.
- Distinguish static validation from runtime validation; PostgreSQL runtime is currently documented as blocked by `28P01`.
- Report changed files, validation commands/results, unresolved risks, and final `git status --short`.
- Stop after completing the explicitly assigned task. Do not continue into the next recovery task.
