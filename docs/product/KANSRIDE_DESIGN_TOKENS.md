# KansRide — Design Tokens

**Date:** 2026-07-27
**Source of truth:** `packages/design-system/src/colors.ts` + `theme.ts` (existing, preserved verbatim) plus the additions defined here. Web apps consume the same values via Tailwind theme extension + CSS custom properties.

---

## 1. Colour Tokens

### 1.1 Existing (do not change)

| Token | Hex | Evidence |
| --- | --- | --- |
| `primary` | `#1B8B4B` | `packages/design-system/src/colors.ts` |
| `primaryLight` | `#2EAF65` | same |
| `primaryDark` | `#146B39` | same |
| `secondary` | `#FFB800` | same |
| `secondaryLight` | `#FFCC40` | same |
| `secondaryDark` | `#CC9300` | same |
| `success` | `#22C55E` | same |
| `warning` | `#F59E0B` | same |
| `error` | `#EF4444` | same |
| `info` | `#3B82F6` | same |
| `white` / `black` | `#FFFFFF` / `#000000` | same |
| `background` | `#F8FAFB` | same |
| `surface` | `#FFFFFF` | same |
| `border` | `#E2E8F0` | same |
| `textPrimary` | `#1A1A2E` | same |
| `textSecondary` | `#64748B` | same |
| `textMuted` | `#94A3B8` | same |
| `textInverse` | `#FFFFFF` | same |
| `driverMarker` | `#1B8B4B` | same |
| `routeLine` | `#1B8B4B` | same |
| `passengerMarker` | `#3B82F6` | same |
| `pickupPin` | `#22C55E` | same |
| `dropoffPin` | `#EF4444` | same |

### 1.2 Additions (semantic + dark mode + formalised in-app values)

| Token | Light | Dark | Origin |
| --- | --- | --- | --- |
| `backgroundRoot` | `#F8FAFB` | `#0B1220` | dark-mode addition |
| `surfaceRaised` | `#FFFFFF` | `#1E293B` | dark-mode addition |
| `borderSubtle` | `#E2E8F0` | `#334155` | dark-mode addition |
| `textPrimary` (dark) | — | `#F1F5F9` | dark-mode addition |
| `textSecondary` (dark) | — | `#94A3B8` | dark-mode addition |
| `primaryOnDark` | — | `#2EAF65` | AA-compliant primary on dark |
| `pinBackground` | `#FFF7ED` | `#3B2A17` | formalises passenger `ride/[id].tsx` |
| `pinBorder` | `#FDBA74` | `#7C2D12` | same |
| `pinText` | `#9A3412` | `#FDBA74` | same |
| `offerCountdown` | `#EF4444` | `#F87171` | formalises driver offer modal |
| `waitingBackground` | `#F0FDF4` | `#12291B` | formalises existing light-green tint |
| `mapPlaceholder` (legacy) | `#E8E8E8` | — | removed once maps land |
| `shimmer` | `#E2E8F0` | `#334155` | skeleton base |
| `overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.65)` | modal scrim (existing driver modal value) |

### 1.3 Ride-status → colour map

`searching|driver_offered` → `info` · `driver_assigned|driver_en_route|passenger_verified|in_progress` → `primary` · `driver_arrived|waiting_for_passenger|payment_pending` → `warning` · `completed` → `success` · `cancelled_*|no_driver_found|*_no_show|payment_failed|disputed` → `error` · `emergency_hold` → `error` + pulse · `draft|requested` → `textSecondary`.

## 2. Typography Tokens

| Token | Size/Weight | Notes |
| --- | --- | --- |
| `h1` | 32/700 | existing |
| `h2` | 24/700 | existing — screen titles |
| `h3` | 20/600 | existing |
| `body` | 16/400 | existing |
| `bodyBold` | 16/600 | existing |
| `small` | 14/400 | existing |
| `caption` | 12/400 | existing |
| `button` | 16/600 | existing |
| `displayFare` | 28/700, tabular | new — fare amounts |
| `pin` | 32/700, letter-spacing 8 | new — verification PIN |
| `mono` | 14/400 monospace | new — public references, plates (formalises tracking-web `font-mono`) |

## 3. Spacing / Radius / Elevation

Spacing: `xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48` (existing). Screen padding `lg`. Card padding `md–lg`. List row height 56. Touch target ≥ 44.

Radius: `sm 4 · md 8 · lg 12 · xl 16 · full 9999` (existing) + **`sheet 20`** (new; formalises both mobile home screens).

Elevation: `sm/md/lg` from `theme.ts` (existing). Dark mode: no heavy shadows; raised surfaces + hairline borders. Low-end Android: prefer border over `elevation` where shadows stutter.

## 4. Motion Tokens

| Token | Value | Use |
| --- | --- | --- |
| `durationInstant` | 100 ms | micro feedback (press) |
| `durationFast` | 180 ms | state changes, chips |
| `durationBase` | 250 ms | sheets, cards |
| `durationSlow` | 400 ms | screen transitions, celebrations |
| `easingStandard` | cubic-bezier(0.2, 0, 0, 1) | default |
| `easingEmphasized` | cubic-bezier(0.2, 0, 0, 1) + slight overshoot on scale only | success moments |
| `springGentle` | damping 18, stiffness 180 | sheet drag settle |

Details: `KANSRIDE_MOTION_SYSTEM.md`.

## 5. Map Style Tokens

| Token | Day | Night |
| --- | --- | --- |
| `mapBackground` | `#F2F4F2` | `#0E1513` |
| `mapRoadPrimary` | `#FFFFFF` | `#26332E` |
| `mapRoadSecondary` | `#E9EDEA` | `#1C2622` |
| `mapWater` | `#BFE3F0` | `#10222B` |
| `mapGreen` (parks) | `#DCEBDD` | `#14241A` |
| `mapLabel` | `#4B5563` | `#9CA3AF` |
| `mapBuilding` | `#E8EAE8` | `#18211D` |

Details: `KANSRIDE_MAP_EXPERIENCE.md`.

## 6. Platform Delivery

| Platform | Mechanism |
| --- | --- |
| React Native | `@kansride/ui` theme object (existing export shape preserved; additions appended) |
| Admin/Tracking web | Tailwind `theme.extend.colors` + CSS variables for dark mode (`[data-theme='dark']`) |
| Shared logic | Status→colour map and GHS formatting duplicated today in 4 places → single helpers exported from `@kansride/ui` (formatting) and `@kansride/config`-adjacent UI util (status map). Money rule unchanged: helpers accept **integer pesewas only** and return display strings. |

## 7. Deprecations

- Raw hex literals in app source (14+ values currently duplicated across mobile/web files).
- Emoji as icon glyphs (tab bars, status cards) — replaced by icon set + Pragya glyph.
- `textMuted` for informational text (placeholder-only).
- `paddingTop: 60` safe-area hack → `useSafeAreaInsets`.
