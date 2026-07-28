# KansRide — Component Library ("KansUI" Catalogue)

**Date:** 2026-07-27 (completed 2026-07-28)
**Governance:** `KANSRIDE_DESIGN_SYSTEM.md` §6 and §9. Status legend: **[E]** exists in `packages/design-system` (`@kansride/ui`) · **[X]** extension of an existing component · **[N]** new component.
**Evidence rule:** [E] component APIs below are documented verbatim from `packages/design-system/src/`. [X]/[N] entries are specifications — they do not exist yet.

---

## 1. Existing Components (documented from source)

### 1.1 `Button` [E]

Source: `packages/design-system/src/Button.tsx`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | required | Label; rendered in `typography.button` (16/600; 14 at `sm`) |
| `onPress` | `() => void` | required | |
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost'` | `'primary'` | primary = `colors.primary` bg / inverse text; secondary = `colors.secondary` bg / primary text; outline = transparent + 1.5 `primary` border; ghost = transparent |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | minHeight 44 / 50 / 56 |
| `disabled` | `boolean` | `false` | opacity 0.5; also disables press |
| `loading` | `boolean` | `false` | `ActivityIndicator` replaces label; disables press |
| `fullWidth` | `boolean` | `false` | width 100% |

Geometry: `borderRadius.lg` (12), horizontal padding `spacing.lg` (24), `activeOpacity 0.7`.

### 1.2 `TextInput` [E]

Source: `packages/design-system/src/TextInput.tsx`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` / `onChangeText` | `string` / `(t: string) => void` | required | controlled |
| `label` | `string` | — | `typography.small` 500-weight above field |
| `placeholder` | `string` | — | placeholder colour `textMuted` (placeholder-only rule, Tokens §7) |
| `error` | `string` | — | error border + caption text below |
| `keyboardType` | `KeyboardTypeOptions` | — | RN passthrough |
| `secureTextEntry` | `boolean` | `false` | |
| `editable` | `boolean` | `true` | disabled styling when false |

Geometry: height 48, 1.5 border (`border` → `primary` on focus → `error`), `borderRadius.md` (8), white background.

### 1.3 `OTPInput` [E]

Source: `packages/design-system/src/OTPInput.tsx`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `length` | `number` | `6` | box count; driver PIN uses `length={4}` (Design System §4 Inputs) |
| `value` / `onChange` | `string` / `(v: string) => void` | required | digits only; non-numeric stripped, truncated to `length` |
| `error` | `string` | — | error boxes + caption |
| `autoFocus` | `boolean` | `false` | |

Geometry: boxes 48×56, `borderRadius.md`, active box = 2 px `primary` border, filled = `primary` border + `background` fill, digits in `typography.h2`. Hidden number-pad input drives the boxes.

### 1.4 `Card` [E]

Source: `packages/design-system/src/Card.tsx`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | required | |
| `shadow` | `'sm' \| 'md' \| 'lg'` | `'md'` | maps to `theme.shadows` |
| `padding` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | maps to `theme.spacing` |
| `style` | `ViewStyle` | — | escape hatch |

Geometry: white background, `borderRadius.lg` (12). Compose for status/fare/driver/PIN/offer cards (PIN card uses `pin*` tokens, Tokens §1.2).

### 1.5 `BottomSheet` [E]

Source: `packages/design-system/src/BottomSheet.tsx`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `isVisible` | `boolean` | required | drives 300 ms in / 250 ms out `Animated.timing` (native driver) |
| `onClose` | `() => void` | required | backdrop tap + `onRequestClose` + close button |
| `title` | `string` | — | header row with close button when present |
| `children` | `ReactNode` | required | |

Geometry: RN `Modal` (transparent, fade), backdrop `rgba(0,0,0,0.5)` (=`overlay` token), top radius 20 (=`radiusSheet` token), max height 85% of screen, 40×4 drag handle in `border`.

---

## 2. Extensions (specifications — not yet implemented)

### 2.1 `Button` [X]

Add: `danger` variant (`error` bg, inverse text) for cancel/SOS; `iconLeft`/`iconRight` slots; pressed scale 0.98 over 100 ms (Motion §2.3). Existing props unchanged.

### 2.2 `TextInput` [X]

Add: `leadingIcon`, `trailingAccessory` (e.g. clear button), `size="lg"` (52 h matching current app inputs), phone variant with locked `+233` prefix adornment (formalises passenger `login.tsx`).

### 2.3 `OTPInput` [X]

Add: SMS autofill support (`textContentType="oneTimeCode"`), `accessibilityLabel` per box announcing "Digit N of M" (Accessibility §3), masked-digit option for the driver PIN variant.

### 2.4 `BottomSheet` [X]

Add: detents — collapsed (~180 pt) / half (55%) / full (85%); non-modal mode that keeps the map interactive during active ride (V1.1 requires a gesture-capable sheet; V1 keeps the existing modal).

---

## 3. New Components (specifications — not yet implemented)

### 3.1 `SearchField` [N]

Debounced (300 ms) input with leading search icon and clear accessory. Results render as an absolutely-positioned surface (pattern proven in passenger `home.tsx`); result rows ≥ 48 pt with icon + primary/secondary text.

### 3.2 `ListRow` [N]

Icon, title, subtitle, chevron; height 56 pt; hairline `borderBottom`. **Requires `onPress` or `disabled`** — this is the governance fix for the dead-menu defect (Audit §6, H5): a row that does nothing cannot be rendered by accident.

### 3.3 `EmptyState` [N]

Illustration (flat 2-colour local style, Design System §5), title, body, optional CTA. Upgrades passenger Activity's existing empty state. Never styled like an error.

### 3.4 `StatusBadge` [N]

Maps all 21 `RideStatus` values to the status-colour grammar (Tokens §1.3), always with a text label — never colour-only (Accessibility §4). Generalises admin-web's existing per-page badge components into shared logic.

### 3.5 `CountdownBadge` [N]

Tabular numerals (`displayFare` numeric rule), `offerCountdown` colour, pulse at ≤ 5 s. Drives the driver offer countdown (today a local `countdownText` style).

### 3.6 `ConfirmDialog` [N]

Title, body, destructive-aware confirm. Replaces scattered `Alert.alert` for irreversible actions (cancel ride, logout). Transient OS-level notices may remain alerts in V1; toasts preferred.

### 3.7 `Toast` [N]

Bottom-floating, 4 s auto-dismiss, swipe-dismiss, variants info/success/error, max 2 queued. Replaces success-alerts (e.g. OTP resend) and silent failures (Audit H4/H9).

### 3.8 `Banner` [N, V1.1]

In-app foreground notification for socket events ("Driver assigned"); distinct from OS push.

### 3.9 `Skeleton` [N]

Block primitive with `shimmer` token sweep (1.4 s); shimmer disabled under Reduce Motion / low-power mode (Motion §2.3).

### 3.10 `OfflineBanner` [N]

Pinned top banner, `warning` background, "You're offline — showing saved data"; driven by NetInfo.

### 3.11 `PermissionPanel` [N]

Icon, plain-language reason, "Open Settings" CTA, secondary escape ("Enter location manually" on passenger) — a denied permission must never dead-end (Passenger §2.6).

### 3.12 `DataTable` (web) [N]

Sticky header, border-only rows (current admin style), row hover, skeleton rows (generalise existing per-page skeletons), empty row, `scope="col"`, `overflow-x-auto` wrapper, pagination footer with page-size selector.

### 3.13 `Chart` (web, admin) [N, V1.1+]

Single-series bars/lines, primary/secondary palette, GHS formatting at the same pesewa presentation boundary, no 3-D, no precision-implying gradients.

---

## 4. Component Governance

1. New/changed component = props table + states (default / hover / pressed / disabled / loading / error) + accessibility notes, added to this file in the same change.
2. Every component ships with `accessibilityRole`, `accessibilityLabel` (or visible text), `accessibilityState` where applicable, ≥ 44 pt targets, focus-visible ring on web, and `prefers-reduced-motion` respect (Accessibility §9 checklist).
3. No raw hex literals and no emoji-as-icons inside components — tokens and the icon set only (Tokens §7).
4. Money displayed by components must arrive as integer pesewas and be converted once via the shared GHS formatter (Engineering invariants; Audit §11).
