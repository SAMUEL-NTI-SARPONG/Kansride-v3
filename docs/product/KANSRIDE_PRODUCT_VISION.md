# KansRide — Product Vision

**Date:** 2026-07-27
**Status:** Vision document. Prescriptive for design, non-binding for engineering contracts.

---

## 1. What KansRide Is

KansRide is the **trusted digital face of the Pragya** — the tricycle that already moves Kansaworodo, Sekondi-Takoradi, and the surrounding communities. It is not "Uber for tricycles." It is a community-scale mobility utility that makes an existing, familiar transport mode safer, more reliable, and more dignified for both riders and drivers.

A passenger in Kansaworodo should feel: *"This was built for people like me, by people who understand how we move."*
A driver should feel: *"This app respects my work, costs me GHS 10 a day, and takes no commission."*
An operator should feel: *"I can see and control everything happening in my service area."*

## 2. Brand Personality

| Trait | Meaning in product |
| --- | --- |
| **Grounded** | Local names, local landmarks, Ghanaian English, cedi-first money talk. No Silicon-Valley gloss. |
| **Trustworthy** | Verified drivers, PIN handshakes, live trip sharing, honest fares shown in GHS, no surprises. |
| **Warm** | Friendly copy, human illustrations of Pragyas and riders, celebratory moments (ride completed, driver arrived). |
| **Brisk** | Three taps to a ride. No decorative friction. Loading is honest and fast-feeling. |
| **Resilient** | Designed for MTN signal drops, low-end Android, bright sunlight, one hand, and interrupted sessions. |

**Voice examples**
- Error: "We couldn't reach the server. Check your data connection and try again." (not "Network request failed")
- Searching: "Finding your Pragya…"
- Driver arrived: "Your Pragya is here. Show the driver your PIN to start."
- Driver offer: "New trip — GHS 4.50 · 1.2 km to pickup · 15 s to decide"

## 3. Brand Principles (decision filters)

1. **Local truth over imported patterns.** If a pattern from Uber conflicts with how Pragya transport works (cash-first, shared knowledge of landmarks, driver phones that sleep), the local reality wins.
2. **The map is the product.** Every core screen either is a map or is one gesture away from one.
3. **Trust is a feature.** PIN verification, masked plates, live tracking links, and visible ratings are first-class UI, not settings-page footnotes.
4. **Cash-honest, MoMo-ready.** Fares always in GHS at the glass, integer pesewas beneath (immutable contract). Cash is the default story; Mobile Money is the growth story.
5. **Small-zone excellence.** KansRide wins Kansaworodo–Takoradi completely before it copies itself elsewhere. Admin tools assume one dense operating zone first.
6. **Driver economics are the moat.** "GHS 10/day, keep 100% of fares" is the headline, repeated in the subscription UI (already exists — preserve and polish).
7. **Nothing fake.** No fabricated driver positions, no fake "0.00" earnings, no success alerts for failed requests. Honest states beat comforting lies.

## 4. The Complete Experience (narrative)

### Passenger
Amina opens KansRide. The map is already centred on her — a soft blue dot pulsing over Kansaworodo, Pragya icons drifting nearby. She types "Market" and "Market Circle" appears with a landmark hint. Before she commits, she sees **Standard GHS 4.00–5.00 · Priority GHS 6.00–7.50** and pickup in ~4 minutes. She taps **Request Pragya**.

The bottom sheet breathes: "Finding your Pragya…" with a radar animation. Thirty seconds is the promise the backend already makes (`DISPATCH_TIMEOUT_SECONDS = 30`); the UI counts honestly and, if no driver is found, offers **Retry** or **Notify me** instead of a dead end.

Kwame accepts. The sheet transforms: his first name, 4.8★, a yellow TVS King, plate `GR-••34-22`, and his Pragya icon gliding toward her on the map. Her 4-digit PIN sits in a high-contrast card. She shares a live tracking link to her mother on WhatsApp — a web page that shows the moving Pragya, no app needed, and that expires on its own.

Kwame arrives; the app celebrates quietly ("Your Pragya is here"). She shows the PIN; the trip begins; the route draws itself. At drop-off: the fare in GHS, cash-confirmed with one tap, five stars, a "Medaase" thank-you. The ride lives in Activity, tappable, with the fare and route.

### Driver
Kwame opens the driver app each morning, taps **Subscribe — GHS 10.00**, approves the MoMo prompt, and flips **Go Online**. The map shows his zone. An offer slides up — fare, distance to pickup, pickup landmark, 15-second pulsing countdown. He accepts with a thumb-sized button.

Navigation mode: the pickup pin, his heading arrow, and a single contextual action button ("Start Pickup" → "I've Arrived" → PIN entry → "Start Trip" → "Complete Trip"). At the end he sees today: **GHS 86.00 · 9 trips**. His rating, his plate, his documents — all in Profile. If his subscription lapses at midnight, the app tells him before he goes online, not after silence.

### Operations (Admin)
The operator opens the dashboard at 07:00: live map with 14 green Pragya dots, 3 active trips as moving route cards, today's revenue in GHS, pending driver applications with photos of plates and licences to approve or reject with a reason. A passenger calls about a left-behind bag: search the phone number, open the ride, see the driver, call both, log an incident. Heatmaps show Saturday demand at Market Circle; the operator posts in the driver WhatsApp group to be there at 08:00.

### Tracking (public web)
Ama's mother opens the shared link on her Tecno phone: a light page with the moving Pragya, "Ama's trip · Driver en route", ETA, and a progress bar. When the trip completes, the page says so and the link dies quietly — privacy by default, exactly as the backend already guarantees.

## 5. Experience Pillars and Measurable Targets

| Pillar | Target (V1) | How measured |
| --- | --- | --- |
| Speed to request | ≤ 3 taps, ≤ 20 s from open to requested | Funnel analytics (V1.1) |
| Search honesty | UI never searches longer than backend's 30 s dispatch window without a state change | Match `DISPATCH_TIMEOUT_SECONDS` |
| Fare trust | 0 "fare surprise" support tickets; estimate shown before request | Support tagging |
| Driver acceptance | ≥ 70% of offers accepted within 10 s | Offer accept telemetry |
| Safety visibility | PIN card visible in all pre-trip assigned states (already true — keep) | UX audit |
| Low-end performance | Cold start ≤ 3 s on 2 GB Android; ≤ 60 MB added download | Device lab |
| Network resilience | Every live screen has an explicit reconnecting/offline state | QA checklist |

## 6. What KansRide Deliberately Is Not (at V1)

- Not a car-hailing clone: no surge heatwaves, no luxury tiers, no "comfort" classes.
- Not a wallet/payments company: no stored balance (schema's `wallet` method stays dormant until a deliberate V2+ decision).
- Not a social app: no chat in V1; masked-call or quick-call templates only if support data demands it.
- Not multi-city: one operating zone, excellently served.
- Not feature-complete against the RBAC matrix: the 30-permission model is a map of a future product, not a V1 checklist.

## 7. Identity Over Time

The green (`#1B8B4B`) and the Pragya are the constants. Everything else — map style, illustration, motion — may mature, but a user who rode in 2026 should recognise the product in 2031 by its colour, its honesty about money, and its respect for the tricycle economy.
