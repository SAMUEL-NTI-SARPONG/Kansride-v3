# KansRide — Master Product Specification

**Date:** 2026-07-28
**Status:** Consolidated product specification. This document is the single entry point to the approved product documentation set. It consolidates; the per-topic documents remain the detail of record.
**Binding authority:** Product direction and design standards — this set. Engineering truth (what exists, what is verified) — `docs/recovery/PROJECT_STATE.md`, `RECOVERY_PLAN.md`, `ARCHITECTURE_NOTES.md`. Where a product statement and the repository disagree, the repository wins and the product doc is corrected.

---

## 1. Document Map

| Document | Role |
| --- | --- |
| `KANSRIDE_PRODUCT_VISION.md` | Identity, brand, principles, narrative experience, measurable pillars |
| `KANSRIDE_PRODUCT_AUDIT.md` | Repository-grounded findings: strengths, defects (C1–C5), UX problems (H1–H12), dead code |
| `KANSRIDE_PASSENGER_EXPERIENCE.md` | Passenger journey, screen-by-screen spec, edge states, priority matrix |
| `KANSRIDE_DRIVER_EXPERIENCE.md` | Driver journey, screen-by-screen spec, edge states, priority matrix |
| `KANSRIDE_ADMIN_EXPERIENCE.md` | Operations-console IA, screen specs, cross-cutting admin requirements |
| `KANSRIDE_MAP_EXPERIENCE.md` | Map style ("KansStyle"), markers, routes, camera grammar, live wiring |
| `KANSRIDE_DESIGN_SYSTEM.md` | "KansUI" principles, colour, type, components, dark mode, governance |
| `KANSRIDE_DESIGN_TOKENS.md` | Token tables (colour/type/spacing/radius/motion/map) and platform delivery |
| `KANSRIDE_COMPONENT_LIBRARY.md` | Component API catalogue (existing props from source; new component specs) |
| `KANSRIDE_MOTION_SYSTEM.md` | Motion rules, catalogue per surface, anti-patterns |
| `KANSRIDE_ACCESSIBILITY.md` | WCAG 2.2 AA standard adapted to Ghanaian realities; QA checklist |
| `KANSRIDE_PERFORMANCE.md` | UX-performance findings, budgets, data-frugality principles |
| `KANSRIDE_PRODUCT_ROADMAP.md` | V1/V1.1/V2 scopes, sequencing, release gates, **Owner Decisions Register (§10)** |
| `.ai/` (repository root) | AI-agent governance: context, responsibilities, rules, guidelines, workflow |

Markers used across the set: **[E]** exists · **[X]** extension · **[N]** new · **[BE]** requires a separately-approved backend task.

## 2. Product Identity

**KansRide is the trusted digital face of the Pragya** — the tricycle that already moves Kansaworodo, Sekondi-Takoradi, and surrounding communities. It is a community-scale mobility utility, not an "Uber for tricycles."

- **Passenger promise:** built for people like me; honest fares in GHS; verified drivers; PIN handshake; shareable live trip.
- **Driver promise:** "GHS 10 a day. Keep every pesewa you earn." (1000 pesewas / 24 h subscription, no commission — implemented.)
- **Operator promise:** see and control everything in the service area.

Brand personality: Grounded · Trustworthy · Warm · Brisk · Resilient. Brand principles (decision filters) are in Vision §3; the constants are the green `#1B8B4B`, the Pragya, honesty about money, and respect for the tricycle economy.

## 3. Users & Operating Context

| Actor | Reality that shapes design |
| --- | --- |
| Passenger | Low-end Android (2 GB RAM), 3G/4G MTN prepaid data, bright sunlight, one hand, cash-first |
| Driver | Working outdoors; gloves/dust; phone sleeps; battery matters over an 8 h shift; MoMo for the daily fee |
| Operator (admin) | Web dashboard at desktop; needs live map, approvals, investigation, monitoring |
| Public tracker | Family member opening a WhatsApp link on any phone, no app |

Operating zone: one dense zone first (Kansaworodo–Takoradi; exact polygon = owner decision D3). Multi-city is deliberately out of scope at V1.

## 4. Surfaces & Current Maturity (evidence: Audit §1–§3)

| Surface | Stack | Maturity | Headline gap |
| --- | --- | --- | --- |
| Backend + shared packages | NestJS 10, PostgreSQL/PostGIS, Drizzle, Redis, Socket.IO | High (statically validated; runtime blocked by local `28P01`/Redis) | Preserve; expose more of it |
| Passenger app | Expo SDK 52 / Router 4, RN 0.76, Zustand | Early slice | No map, hardcoded pickup, dead menu rows, dishonest resend/empty states |
| Driver app | Expo SDK 52 / Router 4 | Early slice | **Hardcoded GPS (C2)**, map placeholder, mock payment |
| Tracking web | Next.js 15 | Mid slice | Map placeholder, silent socket failure |
| Admin web | Next.js 15 | Mid slice | Read-only; drivers can never be approved (C5) |
| Design system | `@kansride/ui` | Built, **unused** | Adopt before writing new components |

Critical defects (verified, product-blocking): **C1** no map anywhere · **C2** driver GPS hardcoded · **C3** passenger pickup hardcoded · **C4** subscription payment is an always-success mock; `payments` table never written · **C5** no admin write operations.

## 5. Business & System Constants (repository-verified)

| Constant | Value | Source |
| --- | --- | --- |
| Driver subscription | 1000 pesewas (GHS 10) per 24 h; go-online gated; 5-min expiry cron | `shared-config/constants.ts`, `drivers.service.ts` |
| Fare formula | base 200p + 150p/km + 10p/min; minimum 300p; `priority_tricycle` ×1.5 (ceil) | `constants.ts`, `fare.service.ts` |
| Ride types | `standard_tricycle`, `priority_tricycle` (UI); `shared`, `parcel_delivery` (API-accepted, UI-hidden) | schema enum, Audit §5 |
| Dispatch | initial radius 2 km, max 5 km, ≤ 5 eligible drivers, offer TTL 30 s, `no_driver_found` at 30 s | `constants.ts`, `dispatch.service.ts` |
| OTP | 6 digits, 10-min expiry, 3 attempts, 3 requests/15 min | `auth.service.ts` |
| Passenger PIN | 4 digits; assigned-driver verification; 5 attempts/min route limit | `rides.controller.ts` |
| Tracking link | 256-bit token, SHA-256-keyed Redis grant, 6 h TTL, minimized public payload | public-tracking service/gateway |
| RBAC | 30 permissions, 11 roles; admin-web admits 5 staff roles | `shared-auth/rbac.ts`, admin login |
| Money contract | integer pesewas everywhere; `Pesewas`-suffixed fields; GHS formatting once at presentation | `ARCHITECTURE_NOTES.md` |

## 6. Core Journeys (V1 targets)

- **Passenger:** Splash → (first run) Onboarding → Login/OTP → (first login) name capture **[BE]** → Map home → Destination → Fare & type → Confirm → Searching → Assigned → Approaching → Arrived → PIN → Trip → Cash confirm → Rating → History. Edge: no drivers, cancel, offline, GPS denied, session expiry, tracking share/revoke. Detail: Passenger doc.
- **Driver:** Login/OTP → Register → Under review → (approved) Subscribe (MoMo) → Go online → Offer → Accept → Navigate → Arrive → PIN verify → Trip → Complete → Cash collect → Earnings. Edge: expiry, GPS off, suspension, poor network. Detail: Driver doc.
- **Operator:** Dashboard KPIs → live map → approval queue → ride investigation → user/driver management → subscription monitoring → (V1.1) incidents/analytics. Detail: Admin doc.
- **Public tracker:** token link → live map + status progress → terminal state → link dies (privacy by default). Detail: Map doc §7–§8, tracking contract in `ARCHITECTURE_NOTES.md`.

## 7. Experience Standards (binding for UI work)

1. **Design system:** adopt `@kansride/ui` before inventing; no new hex literals — tokens only (Design System §1, Tokens §7). Component APIs: Component Library.
2. **Colour/type/spacing:** token tables in `KANSRIDE_DESIGN_TOKENS.md`; status→colour grammar §1.3; `textMuted` is placeholder-only.
3. **Map:** "KansStyle" day/night variants, Pragya marker grammar, camera grammar, live wiring over existing socket contracts (Map doc). Engine choice = owner decision D1.
4. **Motion:** meaning-only animation; budgets 100/250/400 ms; reduced-motion and low-power fallbacks; no layout animations on low-end Android (Motion doc).
5. **Accessibility:** WCAG 2.2 AA floor; TalkBack end-to-end on the two critical journeys; ≥ 44 pt targets; status never colour-only; per-screen QA checklist (Accessibility §9).
6. **Performance:** V1 budgets — cold start ≤ 3 s, map first paint ≤ 2 s, driver shift ≤ 25% battery, ≤ 3 MB/trip, ≤ 60 MB install (Performance §3); data-frugality principles §4.
7. **Honesty rules:** never fake data (zeros, success alerts, driver positions); estimate ranges labelled; final fare always from the backend.

## 8. Contracts & Invariants (immutable without approved backend task)

From `docs/recovery/ARCHITECTURE_NOTES.md` — restated here because every product decision must respect them:

1. JWT `userId` = `users.id`; resolve `passengers.id`/`drivers.id` via profile tables; never compare `users.id` to `rides.passengerId`/`rides.driverId`. `cancelledBy`/`ratedBy` = `users.id`.
2. Integer-pesewa money end-to-end; `Pesewas` suffix; single presentation-boundary GHS conversion; backend `FareService` is the only fare authority.
3. `VALID_RIDE_TRANSITIONS` is the transition authority; persist before broadcast; conditional writes for transitions/dispatch/rating; rating + driver-AVG recompute atomic.
4. Ride type validated against the canonical set before fare/persistence.
5. Public tracking stays token-scoped, minimized, and separate from private rooms.
6. RBAC permission ≠ ownership — both checks required.
7. Migrations append-only. Provider mocks are development implementations, never represented as production integrations.

## 9. Release Plan (summary — detail in Roadmap)

- **V1 (pilot-ready):** §4.1 defect fixes (maps, real GPS, honest states) + §4.2 launch capabilities (driver approval, user suspend, ride investigation, real MoMo subscription, fare estimate, safety/support screens, design-system adoption). Gate: Roadmap §9.
- **V1.1 (operational depth):** socket-driven admin, restore-state, documents, masked contact (D4), analytics/incidents basics, SMS notifications, name capture.
- **V2 (growth):** parcel delivery, MoMo ride fares, zones/config UI, demand forecasting, offline packs.
- **Owner decisions:** 10 open decisions (map engine, MoMo provider, zone polygon, contact channel, cash records, routing/traffic, provisioning runbook, SMS sender, retention, analytics vendor) — Roadmap §10. None are decided by documentation.

## 10. Governance & Change Control

1. This set describes *what and why*; `docs/recovery/` describes *what exists and what is verified*; code is the final truth. Conflicts are resolved code > recovery docs > product docs, and the losing document is corrected.
2. Product docs never authorize production-code, API, auth, schema, or migration changes. **[BE]** items follow the recovery per-task workflow (inspect → approve → implement → validate → report).
3. Every edit to this set updates its date and keeps cross-references resolvable (no dangling document references).
4. AI agents working in this repository must follow `.ai/AI_WORKFLOW.md` with the context, responsibilities, rules, and guidelines in the other `.ai/` files.
