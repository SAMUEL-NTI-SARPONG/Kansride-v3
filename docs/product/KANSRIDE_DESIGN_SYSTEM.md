# KansRide — Design System ("KansUI")

**Date:** 2026-07-27
**Foundation:** `packages/design-system` (`@kansride/ui`) — the existing, un-adopted in-repo system. This document **extends and adopts** it; it does not replace it.
**Rule:** No new hex literals in app code. Everything resolves to a token. Token values: see `KANSRIDE_DESIGN_TOKENS.md`.

---

## 1. Principles

1. **Adopt before invent.** `colors`, `theme` (spacing/radius/typography/shadows), `Button`, `TextInput`, `OTPInput`, `Card`, `BottomSheet` already exist in `packages/design-system/src/`. V1 work begins by wiring apps to them (Evidence: zero imports of `@kansride/ui` in any app — grep-verified).
2. **One source of truth per platform concern:** RN tokens in `@kansride/ui`; web tokens generated from the same values into CSS custom properties consumed by Tailwind config (`admin-web` already maps `primary` — extend, don't fork).
3. **Sunlight-first contrast.** Mobile screens are used outdoors in Takoradi glare; text/background pairs must exceed WCAG AA (4.5:1) as a floor, aiming for 7:1 on critical actions.
4. **Thumb-first geometry.** Minimum 44 pt targets; primary actions live in the lower half of the screen.
5. **Meaningful colour only.** Colour never carries meaning alone (pairs with icon + label) — colour-blind safety (8% of Ghanaian men).

## 2. Brand & Colour System

Existing tokens (verbatim from `packages/design-system/src/colors.ts`) are **preserved**:

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Primary | `primary` | `#1B8B4B` | Primary actions, online state, brand |
| Primary light/dark | `primaryLight/#2EAF65`, `primaryDark/#146B39` | Pressed states, gradients |
| Secondary | `secondary` | `#FFB800` | Accents, ratings, highlights (Pragya yellow) |
| Success / Warning / Error / Info | `success #22C55E` / `warning #F59E0B` / `error #EF4444` / `info #3B82F6` | Status semantics |
| Background / Surface / Border | `#F8FAFB` / `#FFFFFF` / `#E2E8F0` | Structure |
| Text | `textPrimary #1A1A2E` / `textSecondary #64748B` / `textMuted #94A3B8` / `textInverse #FFFFFF` | Type |
| Map | `driverMarker/routeLine #1B8B4B`, `passengerMarker #3B82F6`, `pickupPin #22C55E`, `dropoffPin #EF4444` | Map layers |

**Additions (new tokens, no value changes to existing):**

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `surfaceRaised` | `#FFFFFF` | `#1E293B` | Cards/sheets above background |
| `backgroundDark` | — | `#0B1220` | Dark-mode root background |
| `textPrimaryDark` | — | `#F1F5F9` | Dark-mode primary text |
| `textSecondaryDark` | — | `#94A3B8` | Dark-mode secondary text |
| `borderDark` | — | `#334155` | Dark-mode borders |
| `primaryOnDark` | — | `#2EAF65` | Primary action on dark (keeps AA on `#0B1220`) |
| `pinBackground` | `#FFF7ED` | `#3B2A17` | Verification-PIN card (formalises existing `#FFF7ED` in passenger `ride/[id].tsx`) |
| `pinBorder` | `#FDBA74` | `#7C2D12` | PIN card border |
| `pinText` | `#9A3412` | `#FDBA74` | PIN card text |
| `offerCountdown` | `#EF4444` | `#F87171` | Driver offer countdown (formalises existing usage) |
| `shimmer` | `#E2E8F0` | `#334155` | Skeleton base |

**Contrast verification (light mode):** `textPrimary` on `background` ≈ 14.8:1 ✓; `textSecondary` on `background` ≈ 5.7:1 ✓ AA; `textMuted` on `surface` ≈ 2.9:1 ✗ for body — **rule:** `textMuted` only for placeholders/decorative, never informational. `primary` on white ≈ 3.9:1 — pass for large/bold text and icons; body-size green text must use `primaryDark` (≈ 5.9:1). White on `primary` ≈ 3.9:1 — pass for bold button labels (≥14 pt bold per WCAG large-text), which matches existing button style (16/600).

**Status-colour grammar** (rides):
`searching/offered` → `info`; `assigned/en_route` → `primary`; `arrived/waiting` → `warning`; `verified/in_progress` → `primary`; `completed` → `success`; `cancelled_*` → `error`; `no_driver_found/no_show` → `error`; `payment_pending` → `warning`; `emergency_hold` → `error` + pulsing.

## 3. Typography

Existing scale from `theme.ts` is preserved: h1 32/700, h2 24/700, h3 20/600, body 16/400, bodyBold 16/600, small 14, caption 12, button 16/600.

Additions:
- `displayFare` — 28/700 tabular numerals, `primary` (fare amounts; formalises driver `earnings.tsx` 28/700 pattern). **Tabular figures** (`fontVariant: ['tabular-nums']` on RN; `font-variant-numeric` on web) so countdowns and fares don't jitter.
- `pin` — 32/700 letter-spacing 8 (4-digit PIN display).
- Typeface: system stack (SF/Roboto) for V1 — zero font-download cost on 2G; a licensed Ghanaian-flavoured display face for headings is a V2 brand decision.

## 4. Spacing, Corners, Elevation

- **Spacing:** 4-pt grid, existing scale xs4/sm8/md16/lg24/xl32/xxl48. Screen padding = lg (24) — matches current apps.
- **Corners:** sm4/md8/lg12/xl16/full — existing. **Sheets: 20** (formalises the existing `borderTopLeftRadius: 20` in both mobile home screens) as new token `radiusSheet`.
- **Elevation (light):** sm/md/lg from `theme.ts`; **dark mode:** elevation expressed as lighter surfaces (`surfaceRaised`), shadows reduced 70% (Android shadows are unreliable on low-end devices — prefer 1 px `border` on cards at rest, as current apps already do).

## 5. Icons & Illustration

- **Replace all emoji-as-icons** (tabs 🏠📋👤💰⭐, status ✅🚗) with a single stroke icon set (1.5 pt stroke, 24 px grid, rounded caps) — e.g. Lucide (tree-shakeable, RN + web parity). Emoji remain only in celebratory copy, never as the sole icon.
- **Pragya icon:** one custom asset, three forms — map marker (top-view silhouette), side-view spot illustration, and monochrome glyph for lists. Same geometry everywhere = brand recognition.
- **Illustration style:** flat shapes, 2-colour (primary + secondary), local scenes (Market Circle, Pragya rank), dark-mode variants. Used in empty states, onboarding, errors. Never stock photography of cars.

## 6. Core Components

Status: **[E]** exists in `@kansride/ui` · **[X]** extend it · **[N]** new. Full API catalogue in `KANSRIDE_COMPONENT_LIBRARY.md`.

### Buttons [E→X]
Existing: variants primary/secondary/outline/ghost; sizes sm44/md50/lg56; loading + disabled. Extend with:
- `danger` variant (error bg) for cancel/SOS.
- `iconLeft/iconRight` slots.
- Pressed scale 0.98 + 120 ms ease (see Motion doc).
- Minimum label 16/600; full-bleed primary at sheet bottom = default pattern.

### Inputs [E→X]
Existing TextInput (label, error, focus border). Extend:
- `leadingIcon`/`trailingAccessory` (search icon, clear button).
- `size lg` (52 h, matches current apps).
- Phone input: locked `+233` prefix adornment (formalises passenger `login.tsx`).
- PIN input: 4-cell variant of existing OTPInput (driver verification; reuse, don't fork).

### Search [N]
`SearchField` — debounced (300 ms), leading icon, clear button, results dropdown as absolutely-positioned surface (pattern already proven in passenger `home.tsx`); results rows ≥ 48 pt with icon + primary/secondary text.

### Bottom sheets [E→X]
Existing `BottomSheet` (Modal + Animated slide, 85% max). Extend toward the ride-hailing pattern:
- Detents: collapsed (~180 pt) / half (55%) / full (85%); drag handle 36×4 rounded, `border` token.
- Non-modal during active ride so the map stays interactive (V1.1 requires a gesture-capable sheet; V1 uses existing modal).

### Cards [E]
Existing Card (shadow sm/md/lg, padding). Variants by composition: status card, fare card, driver card, PIN card (uses `pin*` tokens), offer card.

### Lists & rows [N]
`ListRow` (icon, title, subtitle, chevron, 56 pt, `borderBottom` hairline) — kills the dead-menu problem by requiring an `onPress` or `disabled` prop. `EmptyState` (illustration, title, body, optional CTA) — upgrades passenger activity's existing empty state.

### Badges & chips [N]
`StatusBadge` — maps the 21 `RideStatus` values to the colour grammar in §2, always with label text (formalises admin-web's existing badge components into shared logic). `CountdownBadge` — tabular numerals, `offerCountdown` colour, pulse at ≤5 s.

### Dialogs [N]
`ConfirmDialog` (title, body, destructive-aware) replacing scattered `Alert.alert` for irreversible actions (cancel ride, logout). Alerts remain acceptable for transient OS-level notices in V1; toasts preferred (below).

### Snackbars / toasts [N]
`Toast` — bottom-floating, 4 s, swipe-dismiss, variants info/success/error, max 2 queued. Replaces success-alerts (e.g. OTP resend) and silent failures.

### Notifications (in-app) [N, V1.1]
`Banner` for foreground socket events ("Driver assigned"), distinct from OS push.

### States (system-wide patterns)
- **Loading:** spinner for <400 ms waits; **skeletons** for content-shaped waits (new `Skeleton` block component with `shimmer` token; shimmer animation off under Reduce Motion / low-power mode).
- **Empty:** EmptyState with local illustration; never an error lookalike.
- **Error:** inline card (error border, retry button) for content; toast for actions. **Never fake data** (fixes driver earnings' silent-zero and passenger activity's fake-empty).
- **Offline:** `OfflineBanner` pinned top, `warning` background, "You're offline — showing saved data"; driven by NetInfo.
- **Permission:** `PermissionPanel` — icon, plain-language reason, "Open Settings" CTA, secondary "Enter location manually" (passenger) — never a dead end.
- **Session expired:** full-screen interstitial → login with preserved phone number.

### Tables (admin/tracking web) [N]
`DataTable` — sticky header, zebra-none (borders only, matching current admin style), row hover `background`, loading skeleton rows (already implemented per-page — generalise), empty row, `scope="col"`, `overflow-x-auto` wrapper (fixes current clipping), pagination footer with page-size selector.

### Charts (admin) [N, V1.1+]
Single-series bars/lines, primary/secondary palette, GHS formatting via the same pesewa-boundary rule, no 3-D, no gradients that imply false precision.

## 7. Dark Mode

- Full token mirror (§2 additions). Maps switch to a dark style variant (see Map doc). `userInterfaceStyle: 'automatic'` in mobile `app.json` (currently pinned `light` in passenger app).
- Pragya/yellow accents unchanged; green shifts to `primaryOnDark` on dark surfaces.
- V1 scope: settings toggle + system default, mobile first; admin/tracking web in V1.1.

## 8. Accessibility Rules (binding; full doc: `KANSRIDE_ACCESSIBILITY.md`)

Every component ships with: `accessibilityRole`, `accessibilityLabel` (or visible text), `accessibilityState` for toggles/selected/disabled, 44 pt targets, focus-visible ring on web (`focus:ring-2 ring-primary` — already in admin login, generalise), `prefers-reduced-motion` respected, status text never colour-only.

## 9. Governance

- Tokens change only in `packages/design-system`; apps consume. Web palettes are generated from the same values.
- New component = props table + states (default/hover/pressed/disabled/loading/error) + a11y notes, added to `KANSRIDE_COMPONENT_LIBRARY.md`.
- Emoji icons, raw hex literals, and one-off spinners in app code are review-blockers once adoption begins.
