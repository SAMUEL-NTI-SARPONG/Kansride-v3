# KansRide — Accessibility Review & Standard

**Date:** 2026-07-27
**Standard targeted:** WCAG 2.2 AA, adapted for Ghanaian mobile realities (low-end Android, sunlight, older users, one-handed use, intermittent literacy comfort).
**Current baseline (evidence):** **zero** accessibility props in both mobile apps (grep-verified for `accessibilityLabel|accessibilityRole|accessibilityHint|accessibilityState`); web apps partially semantic (landmarks exist; admin login labels unassociated — `login/page.tsx:76,91`; tracking stepper is bare divs).

---

## 1. Contrast

| Pair | Ratio | Verdict / Rule |
| --- | --- | --- |
| `textPrimary` on `background`/`surface` | ≈ 14.8:1 | ✓ AAA |
| `textSecondary` on `surface` | ≈ 5.7:1 | ✓ AA — minimum body pairing |
| `textMuted` on `surface` | ≈ 2.9:1 | ✗ — placeholders/decoration only (rule, Design System §2) |
| White on `primary` (buttons) | ≈ 3.9:1 | ✓ large/bold text only — current button is 16/600 ✓; never small text on green |
| `primary` text on white | ≈ 3.9:1 | Large/bold only; body-size green text must use `primaryDark` (≈ 5.9:1) |
| `warning` `#F59E0B` on white | ≈ 2.1:1 | ✗ text — icon+fill only, or pair with `textPrimary` label |
| PIN card `pinText #9A3412` on `pinBackground #FFF7ED` | ≈ 7.5:1 | ✓ excellent (keep; it's the safety surface) |
| Dark mode pairs (`#F1F5F9` on `#0B1220`, `primaryOnDark` on `#0B1220`) | ≈ 15.5:1 / ≈ 6.1:1 | ✓ |

**Sunlight rule:** outdoor-critical text (fare, PIN, offer countdown, driver plate) uses `textPrimary`/`pinText` pairings only — never `textSecondary` on tinted backgrounds.

## 2. Touch Targets & Motor

- Minimum 44×44 pt everywhere; audit gaps: passenger destination dropdown rows (~unverified, likely < 44), profile menu rows (padding 16 ✓ but no press feedback), driver tab emojis (glyph 20 pt — increase tap area via tab bar options).
- Primary actions in bottom 40% of screen (already true for sheets — formalize).
- Driver app: accept button height 64 pt (offer context = moving vehicle, gloves, harmattan dust).
- Swipe-only actions are banned without a visible-button alternative (e.g. toast dismiss also auto-times out).

## 3. Screen Readers

**Mobile (TalkBack priority — Ghana is Android-dominant; VoiceOver parity):**
- Every icon-only control gets `accessibilityLabel` (my-location FAB, close, back).
- Tab bar: `accessibilityRole="tab"` + labels (replace emoji glyphs; label text exists ✓).
- OTP input: announce "Digit N of 6"; error announcements via `accessibilityLiveRegion` equivalent.
- Ride status: status changes are **announcements** (`AccessibilityInfo.announceForAccessibility`) — "Driver assigned. Kwame, yellow TVS King, arrives in about 3 minutes." (Data already in `AssignedDriverSummary`.)
- PIN: label "Your 4-digit verification PIN: 4 8 2 1" — read as digits; never masked from screen reader owner.
- Rating stars: `accessibilityRole="adjustable"` or radio group, "3 out of 5 stars".
- Offer countdown (driver): announce at 15 s and 5 s, not every second.

**Web:** associate all labels (`htmlFor`), `scope="col"` on tables, skip-to-content link, focus-visible rings (pattern exists in admin login), route-change focus to `h1`, live regions (`aria-live="polite"`) on tracking status + admin live counters.

## 4. Colour Blindness & Low Vision

- Status never colour-only: every status has icon + text (rides badges already have text ✓ — keep as rule).
- Online/offline: green/red pairing gets icon (+ text: "Online"/"Offline" already present ✓).
- Protanopia check: `primary` green vs `error` red differ in lightness (green darker) + always paired with labels ✓; route line vs dropoff pin distinguished by shape (line vs pin) ✓.
- Low vision: type scale supports 130% system font without truncation on critical screens (fare, PIN, CTA); test at Android "Largest" display size; no fixed-height text containers on fare/PIN rows.
- Dark mode + high-contrast toggle (V1.1) for low-vision users (pure-black variant raising contrast further).

## 5. Older Users & Literacy Comfort

- Plain-language copy; numerals for money (GHS 4.50), words for instructions.
- OTP: SMS autofill (`textContentType="oneTimeCode"`) + read-aloud-friendly layout.
- One primary action per screen state (already the pattern — protect it).
- No time-limited reading: countdowns exist only where the backend enforces them (offer TTL), and the consequence (offer passes) is stated.

## 6. One-Handed & In-Context Use

- Passenger: all request flow controls in the bottom sheet; map gestures optional (pin adjust via "Move map" alternative button — V1.1).
- Driver: next-action button full-width bottom; PIN entry numeric keyboard auto-open; no required landscape.
- Admin: keyboard-navigable end-to-end (tab order audited), table actions reachable without hover.

## 7. Low-End Android & Slow CPUs (accessibility = performance)

- Target devices: 2 GB RAM Android 10+ (common Tecno/Infinix). Rules: no blur effects (backdrop-filter banned), shadows replaced by borders where they stutter, skeletons over spinners only when cheap, map tilts disabled, list windowing (`FlatList` defaults tuned: `windowSize 7`, `removeClippedSubviews`).
- App size budget: ≤ 60 MB install (watch map engine + fonts).

## 8. Poor Network as an Accessibility Axis

- Content must be comprehensible from cached/skeleton states (no infinite spinners > 10 s without explanation + retry).
- All errors plain-language + actionable.
- Critical flows (request, accept, PIN) work at 2G-equivalent latency: single request per action, no chained waterfalls (audit: passenger home does create→socket-connect sequentially; failure handling currently misreports — fix noted in Passenger doc §2.7).

## 9. Compliance Checklist (per screen, QA gate)

- [ ] All interactive elements labeled & roled
- [ ] Contrast pairs from approved table
- [ ] 44 pt targets verified with layout inspector
- [ ] Status changes announced
- [ ] Reduced-motion respected
- [ ] Largest font size: no clipped critical content
- [ ] TalkBack end-to-end: request → PIN → rate (passenger); online → offer → PIN → complete (driver)
- [ ] Web: keyboard + screen-reader pass on login, one table, tracking page

## 10. Priority Fixes (existing code)

| Fix | Evidence | Priority / Release |
| --- | --- | --- |
| Add a11y props across both mobile apps | grep: zero matches | High / V1 (with component adoption) |
| Associate admin login labels; add `scope="col"` | `login/page.tsx` | High / V1 |
| Tracking stepper `role="progressbar"` + reduced-motion pulse | `track/[token]/page.tsx` | Medium / V1 |
| Replace emoji icons (unlabeled glyphs) | both `_layout.tsx` tab bars | High / V1 |
| `textMuted` usage audit (informational text) | all apps | Medium / V1 |
