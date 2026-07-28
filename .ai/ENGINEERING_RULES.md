# KansRide — Engineering Rules (Binding)

**Last verified:** 2026-07-28
**Authority:** consolidated from `docs/recovery/ARCHITECTURE_NOTES.md` §Architectural Invariants and `AGENTS.md`. These rules bind every agent in every task, including documentation tasks (docs must never describe a design that violates them).

---

## 1. Identity Rules (non-negotiable)

1. JWT `req.user.userId` is always `users.id`. The JWT carries `{ userId, phoneNumber, role }` — no `sub`, no profile IDs.
2. Passenger operations resolve `passengers.id` through `passengers.userId = req.user.userId`.
3. Driver operations resolve `drivers.id` through `drivers.userId = req.user.userId`.
4. **Never compare `users.id` directly with `rides.passengerId` or `rides.driverId`.**
5. `rides.cancelledBy` and `rides.ratedBy` store `users.id` by design.
6. RBAC answers "may this role attempt this"; ownership answers "does this actor own this resource". Both checks are required; one never substitutes for the other.

## 2. Money Rules

1. Money is **integer pesewas** in persistence, backend math, shared contracts, API/event fields, and client state.
2. Monetary fields carry an explicit `Pesewas` suffix (`estimatedFarePesewas`, `actualFarePesewas`, `farePesewas`, `amountPesewas`, …).
3. GHS strings exist only at the presentation boundary, via one shared formatter; invalid input renders a safe placeholder, never `NaN`.
4. The fare persisted and returned by ride creation comes from the backend `FareService` only; a client estimate never overrides it.
5. Fare constants: base 200p, 150p/km, 10p/min, minimum 300p, `priority_tricycle` ×1.5 (ceil). Driver subscription: 1000p/24 h. Changing these is an owner/product decision plus an approved code task — never a doc edit.

## 3. Ride Lifecycle Rules

1. `packages/shared-config/src/ride-transitions.ts` (`VALID_RIDE_TRANSITIONS`) is the transition authority.
2. Persist a state change **before** broadcasting it; socket delivery failure never turns a committed write into a reported failure.
3. Transition/dispatch/rating writes are conditional (`UPDATE … WHERE <expected state> … RETURNING`); a losing concurrent write emits nothing.
4. Rating: integer 1–5, `completed` rides only, passenger owner only, one per ride (`rated_by IS NULL` guard), and ride update + live `AVG` + `drivers.rating` recompute in **one transaction**.
5. Cancellation maps role → actor → target status (`passenger`/`driver`/`super_admin` only); `ride:update` to the room plus `ride:cancelled` to the assigned driver.
6. Canonical statuses only — the 21-value schema enum. Presence in the enum ≠ reachability (`driver_no_show`, `disputed` have no inbound transition today).

## 4. Realtime, Dispatch & Tracking Rules

1. Socket connections authenticate with an access JWT; private room joins authorize via resolved profile ownership; admin rooms require live-ops permissions; malformed IDs fail generically.
2. Dispatch eligibility: verified active driver user, active+online profile, location < 60 s old (dispatch rule), active tricycle, current subscription, no active assigned ride; ≤ 5 drivers, distance then `drivers.id` order; offer TTL 30 s is authoritative.
3. Payloads stay minimized: offers exclude passenger contact/IDs/PIN; `driver_assigned` uses `AssignedDriverSummary` (no contact, no PIN); lifecycle events use the typed `RideUpdatePayload` serializer — never raw ride rows.
4. Public tracking: passenger-owner-issued 256-bit token, SHA-256-keyed Redis grant, 6 h TTL, dedicated `/tracking` namespace and `public-track:{tokenHash}` rooms, minimized payload (no IDs/contacts/PIN/exact coords/actor/fare), terminal revocation. Raw ride IDs never authorize public access.
5. No outbox/replay or multi-instance Socket.IO adapter exists — docs must not imply durable delivery.

## 5. Data & Schema Rules

1. Migrations are append-only (`0000_…`, `0001_…` exist); never rewrite applied migration intent.
2. `DATABASE_URL` is required; nothing guesses a database password. Root `.env` loading without overwriting process/CI variables.
3. Redis falls back to in-memory only when `REDIS_URL` is absent — a documented development behaviour, not production design.
4. Dead-today tables (`payments`, `audit_logs`) stay dead until their approved tasks land; docs describe them as unwritten.

## 6. Provider & Config Rules

1. SMS/maps/payments are interfaces with mock/dev implementations. Mocks must never be represented as production integrations; real providers land behind the existing interfaces.
2. Ride type is validated against the canonical set (`standard_tricycle`, `priority_tricycle`, `shared`, `parcel_delivery`) before fare/database work; unsupported values are HTTP 400.
3. Dispatch tuning values duplicated in `dispatch.service.ts` (offer TTL, radii, 60 s staleness) vs `shared-config` (5 min staleness) are a known debt item — flag if touched; don't silently "fix" outside an approved task.

## 7. Process Rules (from AGENTS.md, restated)

1. One explicitly approved task at a time; inspect Git state and relevant code before editing; stop when done.
2. Never commit/stage/branch/reset without explicit instruction; never `git add .`; leave `apps/admin-web/next-env.d.ts` and `apps/tracking-web/next-env.d.ts` untouched, unstaged, uncommitted.
3. Distinguish static from runtime validation; PostgreSQL runtime remains blocked (`28P01`), Redis absent — say so.
4. Validation toolkit: focused `npx tsc --noEmit -p <workspace>/tsconfig.json` per affected workspace, workspace builds where bundling changes, `git diff --check`, `git status --short`. No workspace defines a `test` script; root `npm test` is not coverage.
