# KansRide — Complete Product Audit

**Date:** 2026-07-27
**Auditor role:** Multidisciplinary product organization (PM, UX, UI, Mobile, Backend, Ride-Hailing, Operations, Maps, Accessibility, Design System, Motion, Software Architecture, QA)
**Scope:** Every workspace in the monorepo. This audit is grounded exclusively in repository evidence; nothing is assumed.
**Constraint honoured:** No production code was modified. Architecture, identity contract, money contract, ride lifecycle, and all completed recovery work are treated as immutable.

---

## 1. Executive Summary of Findings

KansRide has a **strong backend and a thin frontend**. The recovery programme produced a coherent, contract-aligned NestJS/PostgreSQL/Socket.IO core with correct identity resolution, integer-pesewa money handling, a 21-status state machine, targeted dispatch, private realtime rooms, and a genuinely well-designed secure public-tracking capability. The four client applications, however, are early vertical slices: **none of them renders a real map**, the passenger app uses a hardcoded pickup coordinate, the driver app reports a hardcoded GPS position, half of the passenger profile menu is dead UI, the admin dashboard is read-only with a placeholder live map, and the in-repo design system (`@kansride/ui`) is fully built but imported nowhere.

The single most important product fact: **the map — the emotional and functional centre of any ride-hailing product — is a grey placeholder box in all three surfaces that need one** (passenger home, driver home, tracking web, admin live map).

| Surface | Maturity | One-line verdict |
| --- | --- | --- |
| Backend + shared packages | High (statically validated; runtime blocked by `28P01`) | Preserve; expose more of it |
| Passenger app | Early slice | Functional flow, no map, no real location, dead menus |
| Driver app | Early slice | Solid offer flow, **fake GPS**, map placeholder, mock-paid subscription |
| Tracking web | Mid slice | Good status UX, map placeholder, silent socket failure |
| Admin web | Mid slice | Competent read-only tables; zero operations capability |
| Design system | Built, unused | Adopt before writing any new component |

---

## 2. Existing Strengths (Preserve)

| Strength | Repository evidence |
| --- | --- |
| Correct, documented identity model (JWT `users.id` → profile IDs) | `docs/recovery/ARCHITECTURE_NOTES.md`; enforced across `rides.service.ts`, `drivers.service.ts`, events gateway |
| Integer-pesewa money contract end-to-end with single UI conversion boundary | `packages/shared-db/src/schema/rides.ts`; `fare.service.ts`; `formatGhsFromPesewas` in passenger `home`/`ride/[id]`, driver `home`/`earnings`, admin `src/lib/currency.ts` |
| Full ride state machine with actor-aware transitions | `packages/shared-config/src/ride-transitions.ts` |
| Post-persistence canonical `ride:update` events; conditional writes | `apps/backend/src/modules/rides/`, commit `57f14de` |
| Targeted dispatch: eligibility rules, ≤5 drivers, offer TTL, Redis indexing, reconnect replay | `dispatch.service.ts`, `events.gateway.ts` (`driver:get-offers`) |
| Passenger PIN verification (4-digit, rate-limited, conditional transition) | `rides.controller.ts` `POST /rides/:id/verify-passenger`; passenger PIN card in `app/(main)/ride/[id].tsx`; driver PIN entry in `app/(main)/home.tsx` |
| Secure public tracking: 256-bit token, SHA-256-keyed Redis grant, 6h TTL, minimized payload, terminal revocation | `public-tracking.service.ts`, `public-tracking.gateway.ts` |
| Driver offer UX with live countdown and auto-decline | `apps/mobile-driver/app/(main)/home.tsx` (countdown effect, offer modal) |
| GHS 10/day driver access-fee model implemented end-to-end (subscribe → gate go-online → cron expiry) | `drivers.service.ts` (subscribe, go-online check, 5-min cron), `subscription.tsx` |
| Passenger OTP UX: auto-advance boxes, auto-submit on 6th digit | `apps/mobile-passenger/app/(auth)/verify-otp.tsx` |
| Consistent loading/error/empty triad on all admin data pages | `apps/admin-web/src/app/dashboard/*/page.tsx` |
| A real, coherent design system package (tokens + 5 components) | `packages/design-system/src/` (colors, theme, Button, TextInput, OTPInput, Card, BottomSheet) |
| Tracking-web status system: 21-status message map, 6-step progress, ETA chip, driver card | `apps/tracking-web/src/app/track/[token]/page.tsx` |
| Driver reconnect resilience: infinite reconnect, resubscribe on connect, pending-offer replay | `apps/mobile-driver/src/api/socket.ts` |

---

## 3. Critical Defects (product-blocking)

These are verified defects, not redesign wishes.

### C1. No map anywhere
- **Existing:** `react-native-maps@^1.18.0` is a declared dependency of both mobile apps but is **imported zero times** (grep-verified). Passenger home renders `<Text>Map View</Text>` (`apps/mobile-passenger/app/(main)/home.tsx:98-101`). Driver home renders "Map View"/"Navigation View" placeholders (`apps/mobile-driver/app/(main)/home.tsx:301,398`). Tracking web renders a gradient box with 🗺️ and raw lat/lng text (`apps/tracking-web/src/app/track/[token]/page.tsx:173-192`). Admin live-map is an explicit "Live map placeholder" page (`apps/admin-web/src/app/dashboard/live-map/page.tsx`).
- **Missing:** Every map surface. No map library in either web app's `package.json`.
- **Recommended:** One MapLibre-based map experience across all four surfaces (see `KANSRIDE_MAP_EXPERIENCE.md`). Mobile: `react-native-maplibre-gl` or activate the already-declared `react-native-maps` with OSM tiles; Web: `maplibre-gl`. Decision required (Owner decision D1 — see `KANSRIDE_PRODUCT_ROADMAP.md` §10).
- **Priority:** Critical — **Release:** V1 — **Evidence:** above.

### C2. Driver GPS is hardcoded
- **Existing:** `apps/mobile-driver/src/stores/location-store.ts` initializes to a fixed Kansawrodo coordinate (4.92, −1.76) and nothing in the app ever calls `setLocation` from a real GPS source. `expo-location` and `expo-task-manager` are installed but unused. `socket.ts:67-78` emits this fixed coordinate every 10 s. Backend dispatch geo-indexes drivers by this value (`events.gateway.ts` `driver:location`).
- **Missing:** Real location capture, permission flow, accuracy handling, background updates.
- **Recommended:** Wire `expo-location` watch into the location store before any pilot; without it, dispatch, ETAs, and tracking are fictional. Treat as a defect fix, not a feature.
- **Priority:** Critical — **Release:** V1 — **Evidence:** `location-store.ts:3-5`, grep for `setLocation` (store definition only).

### C3. Passenger pickup is hardcoded; no location permission flow
- **Existing:** `DEFAULT_PICKUP = { latitude: 4.92, longitude: -1.76, address: 'Kansawrodo' }` (`apps/mobile-passenger/app/(main)/home.tsx:21`). `expo-location` plugin declared, never imported. No permission request, no "location disabled" state anywhere in the app.
- **Missing:** GPS pickup, pickup adjustment, permission-denied and GPS-off states.
- **Recommended:** Current-location pickup with manual pin adjustment; designed permission flows (see Passenger Experience doc).
- **Priority:** Critical — **Release:** V1 — **Evidence:** above.

### C4. Driver app subscription payment is a mock that always succeeds
- **Existing:** `MockPaymentProvider` auto-succeeds every payment (`apps/backend/src/providers/`); `subscription.tsx` shows a success alert immediately. The `payments` table is never written by any code path (grep-verified). `driver_subscriptions.paymentId` is never populated.
- **Missing:** Real MoMo collection (MTN/Telecel/AT), pending/failed states, receipts.
- **Recommended:** Keep the provider interface; implement one real MoMo provider behind it (Hubtel or MTN MoMo). Add payment-pending UI state. Do **not** change the pesewas contract.
- **Priority:** Critical for commercial launch — **Release:** V1 (provider integration), V1.1 (receipts/history) — **Evidence:** providers module; `packages/shared-db/src/schema/payments.ts` (dead table).

### C5. No admin write operations — drivers can never be approved
- **Existing:** `AdminController` exposes five read-only GETs (`admin.controller.ts`). `api.post/put/delete` in admin-web are defined but never called (grep-verified). Driver registration leaves accounts as inactive `driver_applicant` (`drivers.service.ts` register flow); approval is "out of band."
- **Missing:** Driver approve/reject, user suspend, ride intervention, all `admin:manage_*` surfaces that RBAC already grants (`packages/shared-auth/src/rbac.ts` — 30 permissions across 11 roles).
- **Recommended:** Admin write endpoints + UI in priority order: driver approval queue → user/driver suspend → ride cancel/refund view (see Admin Experience doc). This does not change RBAC or identity contracts; it exposes what they already describe.
- **Priority:** Critical (launch cannot onboard drivers otherwise) — **Release:** V1 — **Evidence:** above.

---

## 4. High-Priority UX Problems

| # | Finding | Existing | Missing | Recommended | Priority | Release | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | No fare estimate before requesting | "Your fare is calculated by KansRide when the ride is requested" notice (`home.tsx`) | Quote step / fare range display | Show fare range from backend constants (base 200p, 150p/km, 10p/min, min 300p — `constants.ts`) or add a quote endpoint later; never override backend fare post-create (invariant) | High | V1 | passenger `home.tsx`; `fare.service.ts` |
| H2 | Destination list is 5 hardcoded places | Hardcoded array in `home.tsx` | Search, geocoding, map pick, saved places | V1: expandable curated list of local landmarks + map pin pick; V1.1: geocoding + saved places | High | V1/V1.1 | passenger `home.tsx` |
| H3 | Activity fetch failure shows "No rides yet" | `catch` only `console.log`s (`activity.tsx:36`) | Error state distinct from empty | Explicit error card with retry | High | V1 | passenger `activity.tsx` |
| H4 | OTP resend lies about success | `.catch(() => {})` then success alert (`verify-otp.tsx`) | Cooldown timer, honest errors | 30 s resend countdown + error toast | High | V1 | passenger `verify-otp.tsx` |
| H5 | Dead menu rows | Payment Methods / Saved Places / Safety / Support are non-interactive `View`s (`profile.tsx:81-92`); driver "Documents"/"Support" TouchableOpacity with no `onPress` | All four destinations | V1: Support + Safety screens; V1.1: Saved Places; V2: Payment Methods | High | V1+ | both `profile.tsx` files |
| H6 | SESSION_EXPIRED unhandled | API client throws `SESSION_EXPIRED`; no screen clears store or routes to login | Session-expiry UX | Global handler: clear tokens, route to login with "Session expired" notice | High | V1 | passenger `src/api/client.ts` |
| H7 | No offline / poor-network states | No NetInfo dependency; socket failures console-only | Offline banner, queued states, reconnect indicators | NetInfo + socket-status pill on all live screens | High | V1 | both mobile apps |
| H8 | Tracking web silent on socket failure | No `tracking:error` listener; terminal revocation freezes page silently | Expired/ended states, reconnect indicator | Listen to `tracking:error` + disconnect; show "Tracking has ended" | High | V1 | tracking `track/[token]/page.tsx` |
| H9 | Driver earnings failure shows GHS 0.00 | `catch` substitutes zeros (`earnings.tsx:31-38`) | Error state | Error card with retry; never fake zeros | High | V1 | driver `earnings.tsx` |
| H10 | No notifications at all | No notifications module/table/push; SMS used only for OTP | Ride-status SMS/push fallback | V1: SMS on driver_assigned + arrived via existing `ISMSProvider`; V2: push | High | V1/V2 | `auth.service.ts` (OTP-only SMS use) |
| H11 | Rating skip/zero path is silent | `if (rating === 0) return;` no feedback | Confirmation / optional-comment clarity | Disable submit until stars chosen; explicit Skip with confirmation | Medium | V1 | passenger `ride/[id].tsx` |
| H12 | Driver has no in-app ride history | No history screen; `/rides/my-rides` supports driver role | History tab | Reuse activity pattern with `farePesewas` | High | V1.1 | `rides.controller.ts` `GET /rides/my-rides`; driver app routes |

---

## 5. Features Hidden in the Backend but Not Exposed

| Capability | Backend evidence | Client exposure today | Recommendation | Priority | Release |
| --- | --- | --- | --- | --- | --- |
| Revoke tracking link (`DELETE /rides/:id/tracking-links`) | `rides.controller.ts` | None | "Stop sharing" button on active-ride screen | Medium | V1 |
| `admin:subscribe` socket + `admin:rides` room (live ops feed) | `events.gateway.ts` | None — admin has no socket code | Power the admin live map + live trip feed | High | V1.1 |
| Ride types `shared` + `parcel_delivery` accepted by API | `rides.service.ts:31-36`, schema enum | UI exposes only standard/priority | Keep hidden in V1; launch `parcel_delivery` deliberately in V2 with its own fare rules | Low | V2 |
| `AssignedDriverSummary` (safe driver card data) | `ride.types.ts` | Rendered as plain text | Rich driver card with Pragya avatar, rating stars | High | V1 |
| `distanceToPickupMeters` in offer payload | `ride.types.ts` `RideOfferPayload` | Shown as "x.x km" | Also derive "≈ N min away" for driver decision-making | Medium | V1 |
| Audit log table + `admin:view_audit_logs` permission | `schema/audit-logs.ts`, `rbac.ts` | Nothing writes it; nothing reads it | Wire writes into admin mutations when they exist (V1.1); viewer in V2 | Medium | V1.1/V2 |
| Payments table (ride_fare/subscription/refund/wallet_topup) | `schema/payments.ts` | Dead | Write subscription payments first (with real provider); ride-fare cash records V1.1 | High | V1/V1.1 |
| `driver:get-offers` reconnect replay | `events.gateway.ts` | Wired (recovery path only) | Keep; add UI "missed offer" recovery toast | Low | V1.1 |
| Driver earnings endpoint | `GET /drivers/earnings` | Exposed | Add daily breakdown list (V1.1) | Low | V1.1 |

---

## 6. Dead UI, Dead APIs, Dead Code

**Dead UI**
- Passenger profile: 4 menu rows without handlers (`profile.tsx:81-92`).
- Driver profile: "Documents", "Support" rows without handlers (`driver profile.tsx:109-115`).
- Passenger `idle`/`requesting` status labels with no rendered UI (`ride-store.ts`).
- Admin `secondary` amber palette defined, never used (`tailwind.config.js`).
- Tracking web `primary` token defined, never used; `@/*` alias unused.

**Dead or unreachable backend surface**
- `audit_logs` table (never written), `payments` table (never written), `passengers.rating` (never updated — no driver→passenger rating), `users.email` / `users.profilePhotoUrl` (returned but unsettable — no PATCH endpoint), `rides` statuses `driver_no_show` and `disputed` (no inbound transition — `ride-transitions.ts`), `emergency_hold` (transition allows passenger/driver but no endpoint maps those actors), `PATCH /drivers/location` REST (driver app uses socket only), `apiClient.put` (passenger), `api.post/put/delete` (admin-web).
- RBAC permissions with no backing endpoints: `finance:*`, `safety:*`, `support:*`, `dispatch:assign_rides`, `admin:manage_fares/zones/vehicles/support`, `admin:view_audit_logs`.

**Dead dependencies / unused wiring**
- `@kansride/ui` imported nowhere (both mobile apps declare it).
- `@tanstack/react-query` provider mounted in passenger app; zero hooks used.
- `react-native-maps`, `expo-location` (both mobile), `expo-task-manager` (driver) — installed, unused.
- `@kansride/types` + `@kansride/config` declared in admin-web, never imported.

**Console noise:** 7 `console.log` sites in the passenger app, some logging ride IDs (`activity.tsx:36`, `profile.tsx:35`, `ride/[id].tsx:79`, 4 in `socket.ts`).

**Missing asset:** `apps/mobile-passenger/app.json` references `./assets/icon.png`; `assets/` contains only `.gitkeep` — store build would fail or ship iconless.

---

## 7. Accessibility Issues (summary; full review in `KANSRIDE_ACCESSIBILITY.md`)

- **Zero** `accessibilityLabel`/`accessibilityRole` usage in both mobile apps (grep-verified). OTP boxes, star ratings, tab icons, PIN input are invisible to screen readers.
- Emoji used as icons (tabs 🏠📋👤💰⭐, status ✅🚗📍) — inconsistent rendering, no accessible names.
- Admin login `<label>`s lack `htmlFor` (`login/page.tsx:76,91`); tables lack `scope="col"`; no skip link; no focus management.
- Tracking web progress stepper has no `role="progressbar"`; pulsing dot ignores `prefers-reduced-motion`.
- No dark mode anywhere (passenger `app.json` pins `"userInterfaceStyle": "light"`).
- Touch targets: OTP boxes 48×56 ✓; tab bar emoji ~20 px font ✓-ish; driver offer buttons 52 h ✓; but passenger destination dropdown rows and profile menu rows are unverified <44 pt risks.

## 8. Performance Risks (summary; full review in `KANSRIDE_PERFORMANCE.md`)

- Driver emits a location event every 10 s over websocket even when stationary — battery/radio cost; backend debounces DB writes (5 s) but Redis geo write happens every event.
- No memoization/memo components in long lists; `activity.tsx` refetches full history without pagination UI.
- Admin tables render unbounded cell text without virtualization (fine at 20/page).
- Tracking web refetches the entire snapshot on every status `tracking:update`.
- Future map work must avoid per-frame marker re-renders and unthrottled camera callbacks (guidance in Map + Performance docs).

## 9. Technical Debt That Directly Affects UX

1. **Duplicated config:** dispatch radii/timeouts redeclared in `dispatch.service.ts` instead of `shared-config` constants; location staleness mismatch (60 s dispatch vs 5 min shared-config) — causes confusing "no drivers" behaviour if tweaked in one place only.
2. **Style duplication:** the same ~14 hex literals and card/button styles copy-pasted across every screen file; drift is inevitable. The design system exists to end this.
3. **Alert-only error paradigm:** every mobile error is a blocking `Alert.alert`; no toast/snackbar system, no inline errors.
4. **Haversine-only distance:** `HaversineMapsProvider` is the only maps provider; ETA/fare distance is straight-line — acceptable for V1 launch in a small zone, must be disclosed and later replaced via the existing provider interface.
5. **No tests, no working lint** (ESLint 9 vs legacy config), no CI verification — every UX fix currently ships unverified.

## 10. Missing Screens (inventory)

**Passenger:** onboarding/walkthrough, name capture after first OTP, map-based home, pickup confirm, destination search (real), fare estimate, ride-type explainer, driver-arrived celebration, in-trip map, support, safety/SOS, settings, saved places, payment methods, ride detail (from history), no-driver-found retry, offline, location-permission-denied, session-expired.

**Driver:** real navigation/map, ride history, earnings detail, subscription payment pending/failed states, documents/verification status detail, support, safety, settings, low-battery/GPS-disabled guidance, account-suspended screen, offline queue.

**Admin:** live map (real), driver approval queue, driver/rider/user detail pages, ride investigation view, complaints/incidents, payments/subscriptions finance view, audit log viewer, configuration (fares/zones/fees), system health, search everywhere.

**Tracking web:** real map with route, "tracking ended", expired-link explanation, reconnect indicator.

## 11. What Should Never Change

- Identity mapping (`users.id` ↔ profile IDs; `cancelledBy`/`ratedBy` = `users.id`).
- Integer-pesewa contract and the single presentation-boundary conversion.
- `VALID_RIDE_TRANSITIONS` as transition authority; post-persistence emission order.
- Conditional-write dispatch/acceptance/rating semantics.
- Public-tracking token model and payload minimization.
- All completed recovery tasks and migrations (append-only).
- The provider-abstraction strategy for SMS/maps/payments (fill it; don't replace it).

---

*Findings feed directly into the Vision, Experience, and Roadmap (`KANSRIDE_PRODUCT_ROADMAP.md`) documents in this folder.*
