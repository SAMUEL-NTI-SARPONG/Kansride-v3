# KansRide — Implementation Guidelines

**Last verified:** 2026-07-28
**Purpose:** how to execute a product or engineering task once it is approved. Read with `ENGINEERING_RULES.md` (what must never break) and `AI_WORKFLOW.md` (the process wrapper).

---

## 1. Choosing What to Build

1. Work item source: `docs/product/KANSRIDE_PRODUCT_ROADMAP.md` release scopes (V1 → V1.1 → V2) or an explicitly approved recovery task.
2. **[BE]** items are backend tasks: they follow the recovery per-task workflow and require their own approval — a product doc never authorizes them.
3. Items depending on an open owner decision (Roadmap §10) are **blocked until decided**. Example: map implementation waits on D1 (engine); MoMo work waits on D2 (provider).
4. Within a release, respect Roadmap §8 sequencing (maps/GPS first; admin write path in parallel; design-system adoption rides with touched screens — no big-bang refactor).

## 2. UI Implementation Standards (all apply to every screen touched)

1. **Tokens, not literals:** no new hex values; consume `@kansride/ui` theme (`docs/product/KANSRIDE_DESIGN_TOKENS.md`). Prefer existing components (`Button`, `TextInput`, `OTPInput`, `Card`, `BottomSheet`) per `KANSRIDE_COMPONENT_LIBRARY.md` before writing new ones.
2. **Accessibility:** every interactive element gets role + label; ≥ 44 pt targets; status changes announced; reduced-motion respected; run the per-screen checklist (`KANSRIDE_ACCESSIBILITY.md` §9).
3. **Honest states:** loading/empty/error/offline are distinct; errors are plain-language and actionable; never fake zeros, fake success, or fabricated positions (`KANSRIDE_PRODUCT_AUDIT.md` H3/H4/H9).
4. **Money at the glass:** integer pesewas in state/props; one GHS conversion at presentation via the shared formatter.
5. **Motion:** budgets and patterns from `KANSRIDE_MOTION_SYSTEM.md`; transform/opacity only; off-switches honored.
6. **Performance:** respect `KANSRIDE_PERFORMANCE.md` budgets and mitigations (stationarity-gated driver location, batched marker updates, no per-frame React re-renders, list windowing).
7. **Emoji** are not icons; use the icon set per `KANSRIDE_DESIGN_SYSTEM.md` §5.
8. **Logging:** no `console.log` in shipping paths; gate diagnostics behind `__DEV__`.

## 3. Contract Safety (when UI work meets the backend)

1. Client changes must consume existing contracts exactly (`packages/shared-types`, `ARCHITECTURE_NOTES.md` §Frontend/Backend API Boundaries). If a needed field/endpoint is missing, that is a **[BE]** follow-up — not a client-side workaround that fakes data.
2. Status handling uses canonical names and the transition table; no client-invented statuses.
3. Socket flows: connect after auth, subscribe after connect, restore subscriptions on reconnect (patterns already in both mobile `socket.ts` files — extend them, don't fork them).
4. PIN, tracking tokens, and contact data never appear in new UI surfaces beyond their approved screens.

## 4. Validation (run what the scope touches)

```powershell
# Focused type checks (per affected workspace)
npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json
npx tsc --noEmit -p apps/mobile-driver/tsconfig.json
npx tsc --noEmit -p apps/admin-web/tsconfig.json
npx tsc --noEmit -p apps/tracking-web/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npx tsc --noEmit -p packages/design-system/tsconfig.json

# Builds when bundling/behavior changes
npm run build --workspace=apps/backend
npm run build --workspace=apps/admin-web
npm run build --workspace=apps/tracking-web

# Always
git diff --check
git status --short
```

Record static vs runtime outcomes separately. Database/Redis flows remain runtime-blocked locally (`28P01`, no Redis) — mark them pending; never claim runtime success.

## 5. Documentation Duties (part of every task)

1. Product docs that cite changed code get updated in the same task (evidence citations must stay true).
2. New/changed components → `KANSRIDE_COMPONENT_LIBRARY.md` entry (props, states, a11y notes).
3. New design values → token tables, not ad-hoc constants.
4. Owner-decision outcomes → Roadmap §10 status change (owner supplies the decision; the agent records it).
5. Update the edited document's date. Keep every cross-reference resolvable.

## 6. Definition of Done (per task)

- Approved scope implemented, nothing outside it.
- Focused type checks pass; affected builds pass; `git diff --check` clean.
- Applicable §2 standards met; docs updated per §5.
- Report per `AI_WORKFLOW.md` §6: changed files, commands + results, static/runtime distinction, unresolved risks, final `git status --short`.
- Work left uncommitted unless committing was explicitly instructed (exact paths only).
