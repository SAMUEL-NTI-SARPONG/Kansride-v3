# KansRide — Motion System

**Date:** 2026-07-27
**Philosophy:** motion answers "what just happened?" and "what happens next?" — never decoration. Every animation has a meaning, a duration budget, and an off-switch. Tokens: `KANSRIDE_DESIGN_TOKENS.md` §4.
**Current state:** essentially no motion (one slide `Modal` in driver offers; RN `Animated` exists only inside the unused `BottomSheet`). No animation library is installed in any app.

---

## 1. Global Rules

1. **Budgets:** micro ≤ 100 ms · state ≤ 250 ms · narrative ≤ 400 ms. Nothing looped except loaders and the SOS pulse.
2. **Respect `prefers-reduced-motion` / RN Reduce Motion:** replace translate/scale with cross-fades; disable marker interpolation and the searching radar (show static pulse frame + text).
3. **Low-power mode:** detect (Android power-save via device info) → skeletons lose shimmer, map animations drop to jumps.
4. **60 fps or nothing:** animate `transform`/`opacity` only; layout animations on low-end Android are forbidden.
5. **Interruption-safe:** every animation reverses cleanly (sheets, offers).

## 2. Motion Catalogue

### 2.1 Ride lifecycle (passenger)
| Moment | Motion | Duration/Easing |
| --- | --- | --- |
| Request sent | CTA morphs into searching pill (width collapse + label swap) | 250 ms standard |
| Searching | Radar rings expanding from pickup pin (loop, 1.6 s cycle, max 3 concurrent rings) + elapsed counter | loop; stops instantly on assignment |
| Driver assigned | Sheet springs up (springGentle); driver card slides in; map camera fits driver+pickup (500 ms) | 400 ms emphasized |
| Driver moving | Marker glide + heading rotate (smoothed, see Map doc) | continuous |
| Driver arrived | Haptic thump + PIN card pop (scale 0.96→1 with emphasized easing) + "Your Pragya is here" banner drop | 300 ms |
| Trip start | Route line draws pickup→dropoff | 600 ms |
| Completion | Fare card rises; subtle confetti-burst of 8 dots from Pragya glyph (once, ≤ 600 ms) — **no full-screen confetti** | 400 ms |
| Cancellation | Status card cross-fades to cancelled state; map returns home | 250 ms |

### 2.2 Driver app
| Moment | Motion |
| --- | --- |
| Offer arrives | Sheet slides up (300 ms) + haptic + countdown ring depletes linearly (tabular numerals) |
| Accept | Button compresses (0.98 scale, 100 ms) → sheet morphs to navigation header |
| Status advance | Primary button label cross-fade (150 ms); status badge colour transition (180 ms) |
| Earnings update | Count-up tween on GHS value (400 ms, tabular) |
| Online toggle | Switch + map undims (200 ms fade of a scrim layer) |

### 2.3 Navigation & chrome (all apps)
- Tab switches: icon colour 150 ms; no slide (Expo default kept).
- Sheets: drag with 1:1 finger tracking; settle via `springGentle`; scrim fades with sheet travel.
- Lists: items fade+rise 8 pt on first mount, staggered 30 ms, capped at 10 items (long lists render static).
- Toasts: rise 24 pt + fade in 180 ms; exit swipe or 4 s timeout.
- Skeletons: 1.4 s shimmer sweep (off under reduced motion / low power).
- Buttons: 0.98 scale on press-in, 100 ms; release springs back.

### 2.4 Web (admin/tracking)
- Page-level: content fade 150 ms only; no route transitions beyond that (ops tools should feel instant).
- Tracking: progress stepper fill tweens (400 ms); driver marker glide; pulsing live dot (respects reduced motion — tracking currently lacks this; add).
- Admin tables: skeleton rows (already `animate-pulse` — keep); hover background 100 ms.

## 3. Implementation Guidance (non-binding)

- RN: adopt `react-native-reanimated` (+ gesture-handler for sheets) in V1 map/sheet work; the existing `BottomSheet` (RN `Animated`) remains for simple modals.
- Web: CSS transitions keyed to tokens; no animation library.
- MapLibre marker interpolation: requestAnimationFrame driver on web; Reanimated shared values on RN.

## 4. Anti-Patterns (banned)

- Parallax anything. · Bounce/elastic on financial or safety UI. · Looped decorative animation. · Full-screen celebrations blocking the next action. · Animating list re-ordering on low-end devices. · Auto-playing carousels in onboarding.

## 5. Success / Failure Language

- **Success:** one emphasized moment (scale or draw-in) + haptic on mobile; colour moves to `success` and stays.
- **Failure:** no shake animations on forms (accessibility + dignity); inline error text + error border, toast for actions. Shake permitted only on wrong PIN entry (1 cycle, 200 ms) because the context is already high-attention.
