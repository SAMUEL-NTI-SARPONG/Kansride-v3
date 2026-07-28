# KansRide — Product Context for AI Agents

**Last verified:** 2026-07-28
**Purpose:** the minimum context an AI agent needs before doing any work in this repository. Read this first, then `MODEL_RESPONSIBILITIES.md` and `ENGINEERING_RULES.md`.

---

## 1. What KansRide Is

KansRide is a Ghanaian **tricycle (Pragya) ride-hailing platform** for the Kansaworodo–Sekondi-Takoradi area. It digitizes an existing, familiar transport mode — it is not a car-hailing clone. Business model: passengers pay fares in cash (MoMo later); drivers pay a flat **GHS 10/day subscription** and keep 100% of fares. One dense operating zone first; multi-city is out of scope at V1.

## 2. Repository Shape

npm-workspaces monorepo:

| Path | Workspace | Role |
| --- | --- | --- |
| `apps/backend` | `@kansride/backend` | NestJS REST (`/api/v1`), Socket.IO (`/rides`, `/tracking`), dispatch, auth, rides, drivers, admin |
| `apps/admin-web` | `@kansride/admin-web` | Next.js 15 ops dashboard (dev :3001) — currently read-only |
| `apps/tracking-web` | `@kansride/tracking-web` | Next.js 15 public tracking (dev :3002), token links |
| `apps/mobile-passenger` | `@kansride/mobile-passenger` | Expo Router passenger app |
| `apps/mobile-driver` | `@kansride/mobile-driver` | Expo Router driver app |
| `packages/shared-types` | `@kansride/types` | Shared domain/API types |
| `packages/shared-config` | `@kansride/config` | Zod env, business constants, ride transitions |
| `packages/shared-db` | `@kansride/db` | Drizzle schema, PostgreSQL pool, migrations |
| `packages/shared-auth` | `@kansride/auth` | JWT, OTP, Ghana phone, RBAC (30 permissions, 11 roles) |
| `packages/design-system` | `@kansride/ui` | Tokens + Button/TextInput/OTPInput/Card/BottomSheet — **built, not yet adopted by apps** |

## 3. Current State (honest summary)

- **Backend/contracts:** recovered and coherent — identity model, integer-pesewa money, 21-status state machine, post-persistence events, targeted dispatch (≤5 eligible drivers, 30 s offer TTL), passenger PIN, secure public tracking (256-bit token, 6 h TTL), admin OTP + per-route RBAC. **Statically validated only**: PostgreSQL runtime is blocked by local credentials (`28P01`) and no Redis listener. Do not claim runtime success.
- **Clients:** early vertical slices. No map renders anywhere; passenger pickup and driver GPS are hardcoded; subscription payment is an always-success mock; admin has zero write operations (drivers can never be approved). These are the V1 defects (Audit C1–C5).
- **Docs:** engineering truth in `docs/recovery/`; product direction in `docs/product/` (master entry: `docs/product/KANSRIDE_MASTER_PRODUCT_SPECIFICATION.md`).

## 4. Key Numbers (verified in code)

GHS amounts are integer **pesewas** in code (100p = GHS 1): subscription 1000p/24 h · fare = base 200p + 150p/km + 10p/min, min 300p, priority ×1.5 · dispatch radius 2→5 km · `no_driver_found` at 30 s · OTP 6 digits / 10 min / 3 attempts / 3 requests per 15 min · PIN 4 digits, 5 attempts/min · tracking token TTL 6 h.

## 5. Product Direction (short)

V1 = pilot-ready honesty: real maps, real GPS, driver approval queue, real MoMo subscription, honest error/offline states, design-system adoption. V1.1 = operational depth (live admin, restore-state, documents, analytics basics). V2 = growth (parcel delivery, MoMo fares, zones/config). Open owner decisions (map engine, MoMo provider, zone polygon, …): `docs/product/KANSRIDE_PRODUCT_ROADMAP.md` §10.

## 6. Where Truth Lives (conflict order)

1. **Code** (final truth) → 2. **`docs/recovery/`** (verified engineering state) → 3. **`docs/product/`** (direction/design) → 4. **`.ai/`** (agent governance). If you find a conflict, the higher layer wins; correct the losing document in the same task and say so in your report.
