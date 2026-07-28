# KansRide — Complete Passenger Experience

**Date:** 2026-07-27
**App audited:** `apps/mobile-passenger` (Expo Router; page routes: `index`, `(auth)/login`, `(auth)/verify-otp`, `(main)/home`, `(main)/activity`, `(main)/profile`, `(main)/ride/[id]`). Every "Existing" claim cites repository evidence. No backend contract changes are proposed; where a capability is missing on the backend it is marked **[BE]** for a future, separately-approved backend task.

---

## 1. Journey Map (V1 target)

Splash → (first run) Onboarding → Login (phone) → OTP → (first login) Name capture **[BE]** → Home (map) → Destination → Fare & ride type → Confirm → Searching → Driver assigned → Approaching → Arrived → PIN → Trip → Cash confirm → Rating → Receipt/History.

Edge journeys: no drivers, cancellation, poor network, offline, GPS denied, session expiry, tracking share/revoke.

---

## 2. Screen-by-Screen

### 2.1 Splash
- **Existing:** `app/index.tsx` — spinner during auth hydration, then redirect. Branded green bg in `app.json`; **no icon/splash image asset exists** (`assets/` has only `.gitkeep`).
- **Missing:** App icon, splash artwork, first-run detection.
- **Recommended:** Brand splash (Pragya mark on `primary`), ≤ 800 ms; route on hydration state as today. **Priority:** High · **Release:** V1.

### 2.2 Onboarding
- **Existing:** none.
- **Recommended:** 3 slides max (Request a Pragya · Verify with PIN · Share your trip), skippable, shown once (persist flag). Illustration style per design system. **Priority:** Medium · **Release:** V1.1.

### 2.3 Authentication — Login
- **Existing:** `(auth)/login.tsx` — hardcoded `+233`, normalization, length validation, Alert errors, loading spinner.
- **Missing:** Inline validation feedback; disabled-until-valid button state; help link ("Why my number?").
- **Recommended:** Keep flow verbatim (contracts are correct). Add inline error under input, trust copy ("We verify every rider and driver by phone"), disable CTA until 9 digits. **Priority:** High · **Release:** V1.

### 2.4 Authentication — OTP
- **Existing:** `(auth)/verify-otp.tsx` — best screen in the app: 6 boxes, auto-advance, backspace, auto-submit, disabled while verifying.
- **Defects:** Resend has **no cooldown** and shows a success alert even when the request fails (`.catch(() => {})`); no autofill hint (`textContentType="oneTimeCode"`); no edit-number path; no attempt feedback (backend allows 3 attempts per OTP, 10-min expiry, and 3 requests per 15 min — configured in `apps/backend/src/modules/auth/auth.service.ts`).
- **Recommended:** 30 s resend countdown ("Resend in 0:24"), honest error toasts, SMS autofill prop, "Wrong number? Go back" link, attempts-left messaging on failure. **Priority:** Critical (trust defect) · **Release:** V1 · **Evidence:** `verify-otp.tsx`.

### 2.5 Name capture (first login)
- **Existing:** none — `verify-otp` creates the user; profile shows "Passenger" fallback (`profile.tsx`). No PATCH endpoint exists **[BE]**.
- **Recommended:** V1: display fallback gracefully. V1.1: one-field "What should drivers call you?" first-name capture **[BE: PATCH /users/me]**. **Priority:** Medium · **Release:** V1.1.

### 2.6 Permissions — Location
- **Existing:** none. `expo-location` installed, never imported; pickup hardcoded (`home.tsx:21`).
- **Recommended:** Request "While Using" on first home visit with a pre-permission explainer card (why: "to set your pickup"). Denied → `PermissionPanel` with manual pickup entry (landmark list) so the app never dead-ends. GPS off → inline banner with "Turn on location" deep link. **Priority:** Critical · **Release:** V1.

### 2.7 Home (map + request)
- **Existing:** grey "Map View" placeholder, hardcoded pickup "Kansawrodo", search over 5 hardcoded destinations, two ride-type pills after selection, request button, Alert errors, `react-native-maps` installed but unused.
- **Design (V1):**
  - Full-screen map (MapLibre/OSM), user dot, pickup pin defaulting to GPS with "Move map to adjust pickup" behaviour.
  - Bottom sheet (collapsed): greeting, pickup row (editable), "Where to?" search field.
  - Search: curated Takoradi landmark set (expand the existing 5 to ~30 local places with coordinates) + free-text filter; recent destinations (local storage, max 5); map-pin pick mode. Geocoding service is V1.1 **[BE/provider]**.
  - Selecting a destination opens the **fare sheet**: pickup → destination summary, per-type card: Standard (GHS estimate range, "~4 min pickup"), Priority (1.5×, "faster pickup"), both labelled in plain language. Estimate derived from backend constants; final fare always from `POST /rides` response (invariant — never show a local number as final).
  - CTA: "Request Pragya — GHS x.xx" once fare known? No — V1 keeps fare authoritative post-create; CTA reads "Request Pragya", fare estimate shown as a range above.
- **States:** locating (skeleton sheet), location off (banner), outside service area (V1.1 **[BE: zones]**), offline (banner + disabled CTA), socket failure after create (today: mislabels as "Failed to request ride" though ride exists — **defect**; fix by navigating on successful POST regardless of socket, with reconnect banner).
- **Priority:** Critical · **Release:** V1 · **Evidence:** `home.tsx` entire file.

### 2.8 Searching
- **Existing:** spinner + "Finding you a driver..." on `ride/[id].tsx`.
- **Recommended:** Radar pulse on map around pickup, honest elapsed time, cancel row available (backend allows passenger cancel from `requested/searching` — transition table). At 30 s (`DISPATCH_TIMEOUT_SECONDS`), expect `no_driver_found` and show the dedicated state (§2.16). **Priority:** High · **Release:** V1.

### 2.9 Driver Assigned → Approaching → Arrived
- **Existing:** emoji status card; driver card (name, vehicle, plate, rating); raw lat/lng text for driver position; PIN card present — good bones.
- **Design:** map-centred screen: route polyline driver→pickup, animated Pragya marker with heading rotation, ETA chip ("Kwame arrives in ~3 min" — V1 derives from distance; live ETA V1.1), bottom sheet with driver card (Pragya illustration, colour + make/model, plate, rating stars), **PIN card promoted** (pin tokens), actions: Share trip (exists), Contact driver **[V1.1: masked call/SMS template; BE]**, Cancel (with consequence copy).
- **Arrived moment:** haptic + banner "Your Pragya is here", PIN card expands; map zooms to meet point.
- **Priority:** Critical · **Release:** V1 · **Evidence:** `ride/[id].tsx`, `AssignedDriverSummary` in `ride.types.ts`.

### 2.10 Trip (in_progress)
- **Existing:** status text only.
- **Design:** map with route pickup→dropoff, remaining ETA, driver strip, Share-trip persistent row, SOS button (§2.14). Fare locked display (estimated; final = actual on completion — backend already persists `actualFarePesewas` from authoritative estimate).
- **Priority:** High · **Release:** V1.

### 2.11 Payment (cash-first)
- **Existing:** none — trip ends, rating appears. `passengers.preferredPaymentMethod` defaults `'cash'`; no ride-fare charge exists **[BE]**.
- **Design (V1):** completion sheet: "Trip fare — GHS x.xx · Pay the driver in cash" + "I've paid" confirm (records nothing financial; UX closure only). MoMo ride payments: V2 **[BE: payments table is dead; provider is mock]**.
- **Priority:** High · **Release:** V1.

### 2.12 Rating
- **Existing:** 5-star takeover, submit/skip; zero-rating silently no-ops.
- **Recommended:** stars required to enable submit; optional comment (backend accepts `ratingComment` — currently not sent by UI **[verify client]**); skip with confirmation; post-submit thank-you toast. Driver→passenger rating: V2 **[BE: `passengers.rating` never updated]**.
- **Priority:** Medium · **Release:** V1.

### 2.13 History (Activity) & Ride Detail
- **Existing:** list with fare/date/status, pull-to-refresh, empty state; **fetch failure renders as empty (defect)**; rows not tappable; no pagination UI (API supports limit/offset).
- **Recommended:** error card + retry; tappable rows → ride detail sheet (route map, fare, driver summary, "Ride again" **[V1.1]**, "Get help"); paginate on scroll. **Priority:** High · **Release:** V1.

### 2.14 Safety & Emergency
- **Existing:** dead "Safety" menu row; tracking share exists (good); `emergency_hold` status exists but no passenger-reachable path **[BE: no endpoint maps passenger actor]**.
- **Recommended (V1):** Safety screen: share-trip explainer, PIN explainer, emergency numbers (Ghana Police 191, Ambulance 193, Fire 192) with tel: links, support contact. SOS during trip → calls 191 + sends tracking link via SMS composer. In-app `emergency_hold`: V1.1 **[BE]**.
- **Priority:** Critical for trust positioning · **Release:** V1 (screen), V1.1 (in-app hold).

### 2.15 Support
- **Existing:** dead row; `support_agent` role + permissions exist with no backing endpoints **[BE]**.
- **V1:** Support screen: call/WhatsApp ops line, FAQ (fares, PIN, cancellations), "Report a problem with a ride" via prefilled SMS/WhatsApp to ops. V1.1: in-app tickets **[BE]**.
- **Priority:** High · **Release:** V1.

### 2.16 Edge & System States
| State | Existing | Recommended | Priority / Release |
| --- | --- | --- | --- |
| No drivers available | `no_driver_found` mapped to ❌ card | Dedicated sheet: "No Pragyas nearby right now", Retry (re-request), "Try Priority", ops phone fallback | High / V1 |
| Cancellation | Confirm Alert → cancel; no reason | Sheet with reasons (chips, optional text → `cancellationReason` field already in schema), post-cancel summary | Medium / V1 |
| Offline | none | OfflineBanner; hide request CTA; cached profile/activity reads | High / V1 |
| Poor network | none | Socket reconnect pill ("Reconnecting…"), request timeout 15 s with retry | High / V1 |
| Location disabled | none | §2.6 banner + manual pickup | Critical / V1 |
| Session expired | `SESSION_EXPIRED` thrown, unhandled | Global handler → login with "Session expired" notice, phone preserved | High / V1 |
| Tracking share active | Share link exists; revoke endpoint unused | "Sharing live" chip on ride screen + Stop sharing (`DELETE /rides/:id/tracking-links` — exists) | Medium / V1 |
| Background/killed app mid-ride | store rehydration partial | On launch with active ride: fetch `/rides/my-rides` latest + `/rides/:id`, restore tracking screen | High / V1.1 |

### 2.17 Saved Places / Payment Methods / Settings / Profile
- **Saved Places:** dead row. V1.1 **[BE: no table]**; V1 shows recent destinations locally.
- **Payment Methods:** dead row. V1: hide the row (ship nothing dead); cash explainer lives in fare sheet. V2: MoMo.
- **Settings:** no screen. V1: minimal (language note EN, dark-mode toggle, tracking-link defaults, logout already in profile).
- **Profile:** exists (name/phone/rides). Add avatar initial circle, ride count, member-since; remove dead rows or wire them.

---

## 3. Passenger Priority Matrix

| Priority | Items | Release |
| --- | --- | --- |
| Critical | Map home, GPS pickup + permission flows, OTP resend honesty, socket-after-create defect, session-expiry handling, safety screen, offline/poor-network states | V1 |
| High | Fare estimate sheet, searching/arrived/trip map states, activity error state + ride detail, support screen, no-driver retry, offline banner | V1 |
| Medium | Rating polish, cancel reasons, stop-sharing, onboarding, name capture **[BE]**, restore-active-ride | V1–V1.1 |
| Low | Saved places **[BE]**, MoMo **[BE]**, chat, scheduled rides **[BE]** | V2 |
