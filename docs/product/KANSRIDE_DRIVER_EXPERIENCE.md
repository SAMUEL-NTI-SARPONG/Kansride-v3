# KansRide — Complete Driver Experience

**Date:** 2026-07-27
**App audited:** `apps/mobile-driver` (Expo Router; routes: `(auth)` login/register/verify-otp, `(main)` home/earnings/subscription/profile). Every "Existing" claim cites repository evidence. The backend driver surface (register, go-online/offline, subscribe, earnings, offers, PIN verify, status progression) is solid — **preserve it**; this document designs the experience on top.

---

## 1. Driver Promise

"**GHS 10 a day. Keep every pesewa you earn.**" — already true in code (`DRIVER_SUBSCRIPTION_AMOUNT_PESEWAS = 1000`, no commission anywhere). The experience must make that promise legible at every step: subscription screen (exists), earnings screen (exists), and offer cards (fare shown = driver keeps).

## 2. Journey Map (V1 target)

Login (OTP) → [new driver] Register → Application under review → (approved) Subscribe (GHS 10 MoMo) → Go online → Offer → Accept → Navigate to pickup → Arrive → PIN verify → Trip → Complete → Cash collect → Earnings. Edge journeys: subscription expiry, GPS off, poor network, low battery, suspension, no offers.

---

## 3. Screen-by-Screen

### 3.1 Auth & Registration
- **Existing:** `(auth)/login.tsx` + `verify-otp.tsx` (mirrors passenger). `register.tsx`: full name (split client-side), licence number, plate, colour, make, model; vehicle type fixed "Tricycle (Pragya)"; submits `POST /drivers/register`; forces logout → re-login (required for fresh role JWT — correct per recovery).
- **Gaps:** no document capture (licence photo) **[BE: storage]**; no field-level validation (plate format `GR-1234-22`, licence length); no explanation that approval is required before the success alert; re-login requirement is unexplained UX friction.
- **Recommended:** keep contract; add inline validation + helper text; success screen explaining "We verify every driver. This takes up to 24 hours. You'll log in again to continue." Document photos V1.1 **[BE + admin review UI]**.
- **Priority:** High · **Release:** V1 (copy/validation), V1.1 (documents).

### 3.2 Application Under Review
- **Existing:** clean pending card on `home.tsx` ("Application under review…") driven by `isActive`.
- **Recommended:** keep; add expected-time copy and support contact. **Priority:** Medium · **Release:** V1.

### 3.3 Subscription (GHS 10/day)
- **Existing:** `subscription.tsx` — plan card, expiry, "How it works", subscribe button posting `paymentMethod: 'mobile_money'`. Backend: 1000 pesewas/24 h hardcoded; go-online gated; 5-min cron forces expired drivers offline. **Payment provider is a mock that always succeeds**; `payments` table never written.
- **Gaps:** no pending/failed payment states; no MoMo network choice (MTN/Telecel/AT); no payment history; no expiry warning before the 24 h lapses; expiry time shown but not "time remaining".
- **Recommended (V1):** payment-state machine UI: Initiating → "Approve on your phone…" (pending, polling `/drivers/me`) → Active / Failed (retry). Network picker before subscribe. "Time left: 7 h" chip on home when < 8 h remain; renewal reminder at 2 h (local notification V1.1). Real MoMo provider integration **[BE — provider interface already exists; do not change pesewa constants]**.
- **Priority:** Critical (revenue path) · **Release:** V1.

### 3.4 Availability (Go Online)
- **Existing:** Switch on `home.tsx`; requires active subscription (checked client-side first, enforced server-side); connects socket; starts 10 s location emission.
- **CRITICAL DEFECT:** emitted location is a **hardcoded Kansawrodo coordinate** (`src/stores/location-store.ts:3-5`); `expo-location` and `expo-task-manager` installed but unused. Dispatch, tracking, and distance-to-pickup are fictional until this is fixed.
- **Recommended:** wire `expo-location` watch (balanced accuracy, 5 s/10 m distance filter) into the store before emission; permission explainer ("KansRide shows riders where you are only while you're online"); GPS-off → blocking banner with deep link; stationarity optimization (see Performance doc). Foreground-only V1; background task (`expo-task-manager`) V1.1 with explicit driver consent copy.
- **Priority:** Critical (defect) · **Release:** V1.

### 3.5 Home / Idle Online
- **Existing:** "Map View" placeholder + online card + "No ride requests yet" hint.
- **Design:** real map centred on driver with heading arrow; zone hint ("You're in the Kansaworodo area"); online card with today's mini-earnings chip; subscription time-left chip (§3.3); offline state = map dimmed + CTA to subscribe/go online.
- **Priority:** Critical · **Release:** V1.

### 3.6 Ride Offer
- **Existing:** modal with pickup/dropoff, fare (GHS from pesewas ✓), distance-to-pickup km ✓, 30 s countdown (local; backend offer TTL 30 s ✓), auto-decline at 0, accept/decline; accept result handled including failure alert; offer replay after reconnect (`driver:get-offers`).
- **Design refinements:** slide-up sheet (not modal-blocking) with haptic + sound on arrival (respecting silent mode); countdown as shrinking ring (tabular numerals); "≈ N min to pickup" next to km; accept button 2× width (already) with 64 pt height for gloved/wet-thumb use; decline reason optional chips (V1.1 — feeds ops; no BE field today, log client-side or drop).
- **Priority:** Critical · **Release:** V1 (polish of existing).

### 3.7 Navigation to Pickup / Active Ride
- **Existing:** "Navigation View" placeholder; status badge; pickup/dropoff addresses; fare; PIN entry at `waiting_for_passenger`; sequential action button ("Start Pickup" → "I've Arrived" → "Wait for Passenger" → "Start Ride" → "Complete Ride") matching `VALID_RIDE_TRANSITIONS` exactly ✓; passenger name/phone rendered only if present (currently never populated — offer payload deliberately excludes passenger contact).
- **Design:** turn map into navigation mode: route polyline to pickup then to dropoff, driver arrow with heading rotation, one primary contextual button (preserve exact progression), secondary cancel (driver may cancel from `driver_assigned`/`driver_en_route` — supported), "passenger no-show" action at `waiting_for_passenger` (transition exists in table; needs UI + confirm; **verify BE actor mapping supports it** — it does, driver actor).
- Passenger contact: V1.1 masked call **[BE: payload would need a contact channel — privacy decision required]**.
- **Priority:** Critical · **Release:** V1.

### 3.8 Passenger Verification (PIN)
- **Existing:** 4-digit numeric entry (masked), validation, rate-limit aware error alerts (5 attempts/min server-side ✓).
- **Recommended:** keep; add "Ask the passenger for their 4-digit PIN" helper, attempts-left messaging from error text, haptic success. **Priority:** High · **Release:** V1.

### 3.9 Completion & Cash
- **Existing:** "Ride Complete — Earnings have been updated" alert.
- **Design:** completion sheet: fare due **GHS x.xx — collect cash**, trip summary (distance/time if available), "Collected" confirm → returns to online map; earnings chip increments. **Priority:** High · **Release:** V1.

### 3.10 Earnings
- **Existing:** today/week totals + ride counts; **failure silently renders GHS 0.00 (defect)**.
- **Recommended:** error card + retry (never fake zeros); V1.1: per-day list from `/rides/my-rides` (driver role already supported by that endpoint) and cash-vs-MoMo split when payments exist **[BE]**.
- **Priority:** High · **Release:** V1 (fix), V1.1 (detail).

### 3.11 History, Ratings, Profile, Support, Safety
- **History:** missing screen — add tab using `GET /rides/my-rides` (driver-scoped, exists). **High · V1.1.**
- **Ratings:** profile shows aggregate rating (from live AVG ✓); add "How ratings work" explainer. **Low · V1.1.**
- **Profile:** exists (user + vehicle cards); dead "Documents"/"Support" rows — wire or remove; add vehicle photo (V1.1), account status line (Active/Suspended — schema has `users.status`).
- **Support/Safety:** same pattern as passenger (ops line, emergency numbers). **High · V1.**

### 3.12 Edge & System States
| State | Existing | Recommended | Priority / Release |
| --- | --- | --- | --- |
| Offline / network loss | Socket reconnects silently (infinite backoff ✓) | Reconnecting pill; offers arriving while disconnected replay on reconnect (exists ✓) — surface "You missed an offer" toast | High / V1.1 |
| GPS disabled | none (fake coords) | Blocking banner; refuse go-online with GPS off | Critical / V1 |
| Low battery | none | Battery-aware location mode (see Performance doc); < 15% suggest offline at trip end | Medium / V1.1 |
| Subscription expired mid-session | Cron forces offline (server) | Grace: finish active trip (server already scopes offers, not active rides ✓); banner "Subscription expired — renew to go online" | High / V1 |
| Account suspended | `users.status` suspended blocks eligibility server-side | Dedicated screen on 403: "Your account is paused. Contact KansRide support." | High / V1 |
| App killed mid-ride | `activeRide` in store (volatile) | Restore from `/drivers/me` + latest assigned ride on launch | High / V1.1 |
| Passenger cancels | `ride:cancelled` → clears ride (exists ✓) | Add toast "Passenger cancelled" + return-to-map animation | Medium / V1 |

---

## 4. Driver Priority Matrix

| Priority | Items | Release |
| --- | --- | --- |
| Critical | **Real GPS wiring (defect)**, real map + navigation mode, subscription payment states + real MoMo **[BE]**, GPS-off gate, suspended-account screen | V1 |
| High | Offer polish, PIN helpers, completion cash sheet, earnings error fix, support/safety screens, subscription-expiry banner | V1 |
| Medium | Documents capture **[BE]**, history tab, background location, missed-offer toast, low-battery mode | V1.1 |
| Low | Heatmap/demand hints **[BE]**, driver→passenger rating **[BE]**, incentives | V2 |
