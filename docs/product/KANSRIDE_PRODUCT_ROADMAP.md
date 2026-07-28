# KansRide — Product Roadmap

**Date:** 2026-07-27 (completed 2026-07-28)
**Status:** Direction document. Release scopes consolidate the priority matrices in `KANSRIDE_PRODUCT_AUDIT.md`, `KANSRIDE_PASSENGER_EXPERIENCE.md`, `KANSRIDE_DRIVER_EXPERIENCE.md`, and `KANSRIDE_ADMIN_EXPERIENCE.md`. Items marked **[BE]** require separately-approved backend tasks; nothing here authorizes changing recovered contracts.

---

## 1. Purpose

One page of truth for *what ships in which release* and *which decisions only the owner can make*. Engineering truth for "what exists today" remains `docs/recovery/PROJECT_STATE.md`; product evidence remains `KANSRIDE_PRODUCT_AUDIT.md`.

## 2. Release Philosophy

| Release | Meaning | Gate |
| --- | --- | --- |
| **V1** | Pilot-ready in one operating zone (Kansaworodo–Takoradi). Nothing fake: real maps, real GPS, honest states. Drivers can be onboarded and paid. | §9 acceptance gate V1 |
| **V1.1** | Operational depth: live admin, history/detail, documents, restore-state, analytics basics. | §9 acceptance gate V1.1 |
| **V2** | Growth bets: parcel delivery, MoMo ride payments, zones/config, saved places, demand forecasting. | Per-feature approval |

Rule from the Vision doc: small-zone excellence beats breadth — V1 is deliberately narrow and completely honest.

## 3. Baseline (what already works — preserve)

Recovered backend + contracts (identity model, integer pesewas, 21-status state machine, post-persistence events, targeted dispatch, PIN verification, secure public tracking, subscription gate) and thin client slices. Evidence: `docs/recovery/PROJECT_STATE.md`, Audit §2.

## 4. V1 Scope

### 4.1 Defect fixes (treated as bugs, not features)

| Item | Surface | Source |
| --- | --- | --- |
| Map on every surface (home, driver nav, tracking, admin live map — poll-based) | all | Audit C1; Map doc |
| Real driver GPS wiring (expo-location → location store → socket) | driver | Audit C2; Driver §3.4 |
| GPS pickup + location permission flows (with manual fallback) | passenger | Audit C3; Passenger §2.6 |
| Socket-after-create failure misreport (navigate on POST success; reconnect banner) | passenger | Passenger §2.7 |
| OTP resend honesty (30 s cooldown, real errors) | passenger | Audit H4 |
| Session-expired global handling → login | both mobile | Audit H6 |
| Earnings/activity error states (never fake zeros/empty) | driver, passenger | Audit H3/H9 |
| Offline/poor-network banners on live screens | both mobile | Audit H7 |
| Tracking socket failure + "tracking ended" states | tracking web | Audit H8 |
| Strip/gate `console.log` (7 passenger sites) | passenger | Audit §6; Performance P6 |
| App icon + splash assets | passenger (driver parity) | Audit §6; Performance P8 |

### 4.2 Launch-critical capabilities

| Item | Surface | Notes |
| --- | --- | --- |
| Driver approval queue + approve/reject **[BE]** | admin | Audit C5; Admin §2.5 — launch blocker |
| User suspend/unsuspend **[BE]** | admin | Admin §2.6 |
| Ride investigation (search, detail, admin cancel decision) **[BE partly]** | admin | Admin §2.4 |
| Real MoMo subscription payment behind existing provider interface **[BE]** | driver/backend | Audit C4; Driver §3.3 — no pesewa-contract change |
| Subscription payment states (initiating/pending/active/failed) + network picker | driver | Driver §3.3 |
| Fare estimate range before request (from backend constants; never overrides backend fare) | passenger | Audit H1 |
| Expanded curated destinations (~30 local landmarks) + recents | passenger | Audit H2 |
| Safety screen (emergency numbers, PIN/share explainers) | both mobile | Passenger §2.14 |
| Support screen (ops line, FAQ, report via SMS/WhatsApp) | both mobile | Passenger §2.15; Driver §3.11 |
| Cancel-flow reasons → `cancellationReason` | passenger | Passenger §2.16 |
| Stop-sharing (revoke tracking link — endpoint exists) | passenger | Audit §5 |
| Ride detail from history; activity pagination UI | passenger | Passenger §2.13; Performance P4 |
| Driver history tab (`GET /rides/my-rides` driver scope exists) | driver | Audit H12 |
| Audit-log writes wired into the new admin mutations **[BE with 4.2 row 1]** | backend | Admin §2.10 |
| Design-system adoption starts (tokens, Button/TextInput/OTPInput/Card/BottomSheet; a11y props) | both mobile | Design System §1; Accessibility §10 |
| Subscription expiry warnings; expiring-soon admin filter | driver, admin | Driver §3.3; Admin §2.7 |
| Suspended-account screen (403 handling) | driver | Driver §3.12 |

### 4.3 Explicitly not in V1

Chat, scheduled rides, wallet, background GPS (driver background is V1.1 with consent), `shared`/`parcel_delivery` ride types (API accepts; UI stays hidden), geocoding search, zones/fare config UI, push notifications (SMS fallback on `driver_assigned`/arrived is the V1.1 step — Audit H10).

## 5. V1.1 Scope

Socket-driven admin live map/feed (`admin:subscribe` exists) · document capture + review **[BE]** · masked contact channel (privacy decision D4) · restore-active-ride on relaunch (both apps) · background driver location with consent copy · per-day earnings/ride lists · payment history + cash/MoMo split once payments exist · in-app `emergency_hold` **[BE]** · incidents register consuming `safety:*` **[BE]** · analytics basics (rides/day, revenue, acceptance, cancellation breakdown, pickup heatmap) **[BE]** · system-health page **[BE]** · audit-log viewer · SMS ride-status notifications via existing `ISMSProvider` · name capture **[BE: PATCH /users/me]** · saved-places v1 (local) · dark-mode web parity · missed-offer toast · AppState-aware socket pausing.

## 6. V2 Scope

`parcel_delivery` launch with its own fare rules · MoMo ride-fare payments (payments table live end-to-end) · zones + geofences **[BE]** · fares/zones config tables + UI **[BE]** · demand forecasting · offline map packs · traffic provider (decision D6) · driver→passenger rating **[BE: `passengers.rating`]** · incentives · multi-city expansion decision.

## 7. Non-Goals (standing)

Items in Vision §6 ("What KansRide Deliberately Is Not") remain non-goals at V1: no surge, no luxury tiers, no wallet, no chat, no multi-city, no full-RBAC surface build-out.

## 8. Sequencing & Dependencies

1. **Maps + GPS first** — every other V1 UX depends on real location (dispatch, ETA, tracking honesty).
2. **Admin write path** (approval queue + audit writes) unblocks driver onboarding — can proceed in parallel with maps.
3. **MoMo provider** unblocks commercial pilot; interface already exists (decision D2).
4. **Design-system adoption** rides along with each screen touched (no big-bang refactor).
5. Backend **[BE]** items each require their own approved task per recovery workflow; product docs never authorize contract changes.
6. Runtime validation of everything recovered remains gated on the documented PostgreSQL/Redis blocker (`docs/recovery/PROJECT_STATE.md` §Known Limitations).

## 9. Release Acceptance Gates

**V1 gate:** all §4.1 defects closed; approval queue operational with audit writes; MoMo subscription live in pilot mode; every live screen has offline/reconnect/error states; Accessibility §9 checklist passes on the two critical TalkBack journeys; Performance §3 budgets met on a 2 GB Android device; no dead UI rows shipped; `console.log` cleaned; icon/splash present.

**V1.1 gate:** admin live map socket-driven; restore-state works across both apps; incidents/analytics v1 live; documents flow end-to-end.

## 10. Owner Decisions Register

Decisions only the product owner can make. Each records context, options, and current status. **None are decided in these documents; docs record recommendations only.**

| # | Decision | Context / options | Recommendation (non-binding) | Status |
| --- | --- | --- | --- | --- |
| D1 | **Mobile map engine** | `react-native-maps` (installed, Google/Apple-native) vs MapLibre-RN (matches web `maplibre-gl`, one style JSON, no Google billing) | Standardize on MapLibre across all four surfaces (Map doc §12) | Open |
| D2 | **MoMo provider** | Hubtel vs MTN MoMo direct vs other aggregator; MockPaymentProvider is the seam | One real provider behind `IPaymentProvider`; keep interface unchanged | Open |
| D3 | **Operating-zone boundary** | Exact V1 polygon (Kansaworodo-only vs wider Sekondi-Takoradi); affects curated destinations + admin defaults | Kansaworodo–Takoradi zone, confirmed with ops | Open |
| D4 | **Passenger↔driver contact channel** | Masked call vs SMS template vs none at V1; privacy implications (offer payload currently excludes contact by design) | V1: none (PIN + tracking suffice); V1.1 masked call if support data demands | Open |
| D5 | **Cash-confirmation semantics** | "I've paid" records nothing financial today; whether completion should record a cash payment row in `payments` | Record cash ride-fare rows when payments work lands (V1.1), not before | Open |
| D6 | **Traffic & routing provider** | OSRM/Valhalla self-host vs commercial (Google/Mapbox) for real routing + traffic (Map doc §11) | OSRM/Valhalla via existing `IMapsProvider` at V1.1; traffic deferred to V2 | Open |
| D7 | **First-admin & driver-approval runbook** | Who provisions the first admin and approves drivers in each environment (currently out-of-band) | Document a controlled runbook before pilot | Open |
| D8 | **SMS sender + brand sender ID** | Hubtel sender identity for OTP/notifications in Ghana | Decide with SMS provider contract | Open |
| D9 | **Data/privacy retention** | Tracking links expire in 6 h (implemented); retention of ride history, audit logs, and location breadcrumbs | Draft retention policy before pilot | Open |
| D10 | **Crash/analytics vendor** | V1 ships without an analytics SDK firehose (Performance §5) | Decide vendor + batching at V1.1 | Open |

## 11. Change Control

- Scope moves between releases only through owner decision recorded in §10 (new row or status change).
- Any roadmap item that touches a recovered contract is automatically a **[BE]** item requiring the recovery workflow (inspect → approve → implement → validate), not a product-doc edit.
- This document is updated when: a decision is made, a release gate is met, or scope is explicitly moved. **Last-verified date is updated on every edit.**
