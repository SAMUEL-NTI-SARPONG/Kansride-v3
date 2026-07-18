# KansRide Phase 1: Foundation Implementation Plan

## Summary

Build the complete foundation layer for KansRide — a production-grade ride-hailing platform for tricycle transport in Ghana. Phase 1 establishes the monorepo, shared packages, backend API skeleton, database schema, authentication, mobile app shells, admin dashboard shell, and CI pipeline. All infrastructure is designed for Windows development (no Docker dependency), with PostgreSQL+PostGIS and Redis installed locally.

**Environment**: Node.js v24.13.0, npm 11.17.0, Git 2.45.2, Windows 21H2. No Docker/pnpm/yarn.

---

## Task 1: Monorepo Root Setup

Initialize the workspace root with npm workspaces, TypeScript strict config, linting, and formatting.

**Files to create:**
- `package.json` — root workspace config with `"workspaces": ["packages/*", "apps/*"]`
- `tsconfig.base.json` — strict mode, ES2022 target, path aliases for all `@kansride/*` packages
- `.eslintrc.json` — TypeScript ESLint with strict rules
- `.prettierrc.json` — consistent formatting (single quotes, trailing commas, 100 width)
- `.gitignore` — Node, build artifacts, .env, Expo, Next.js
- `.nvmrc` — pin Node 24.13.0
- `.env.example` — template for all required environment variables
- `README.md` — project overview, local setup guide, architecture summary

**Key decisions:**
- npm workspaces (built-in, zero dependencies, sufficient for this scale)
- TypeScript strict mode from day 1 (`strict: true`, `noUncheckedIndexedAccess: true`)
- `moduleResolution: "bundler"` for modern package resolution
- Path aliases: `@kansride/types`, `@kansride/auth`, `@kansride/db`, `@kansride/config`, `@kansride/ui`

**Root devDependencies:** typescript@^5.6, eslint@^9, @typescript-eslint/parser@^8, @typescript-eslint/eslint-plugin@^8, prettier@^3

---

## Task 2: Shared Types Package (`packages/shared-types`)

Single source of truth for all domain TypeScript types used across backend, mobile, and web.

**Files:**
- `packages/shared-types/package.json` — name: `@kansride/types`
- `packages/shared-types/tsconfig.json` — extends base
- `packages/shared-types/src/index.ts` — barrel exports
- `packages/shared-types/src/auth.types.ts` — UserRole enum, User, AuthTokens, OTPPayload, JWTPayload
- `packages/shared-types/src/ride.types.ts` — RideStatus (full state machine enum), Ride, Location, Driver, Passenger
- `packages/shared-types/src/payment.types.ts` — PaymentMethod, PaymentStatus, Payment, DriverSubscription
- `packages/shared-types/src/vehicle.types.ts` — Vehicle, VehicleDocument
- `packages/shared-types/src/api.types.ts` — ApiResponse<T>, PaginatedResponse<T>, ApiError

**UserRole values:** passenger, driver_applicant, driver, dispatcher, support_agent, finance_officer, safety_officer, ops_admin, system_admin, super_admin, auditor

**RideStatus values (full state machine):** draft, requested, searching, driver_offered, driver_assigned, driver_en_route, driver_arrived, waiting_for_passenger, passenger_verified, in_progress, completed, cancelled_by_passenger, cancelled_by_driver, cancelled_by_admin, no_driver_found, passenger_no_show, driver_no_show, payment_pending, payment_failed, disputed, emergency_hold

---

## Task 3: Shared Config Package (`packages/shared-config`)

Environment validation via Zod and centralized business constants.

**Files:**
- `packages/shared-config/package.json` — name: `@kansride/config`, depends on `zod@^3.23`
- `packages/shared-config/src/env.ts` — Zod schema validating all env vars (DB, Redis, JWT, OTP, SMS, Maps, MobileMoney, Logging), `getEnv()` function that fails fast on invalid config
- `packages/shared-config/src/constants.ts` — business rules as named constants:
  - `DRIVER_SUBSCRIPTION_AMOUNT_GHS = 10`
  - `DRIVER_SUBSCRIPTION_DURATION_HOURS = 24`
  - `OTP_EXPIRY_MINUTES = 10`
  - `OTP_MAX_ATTEMPTS = 3`
  - `JWT_ACCESS_EXPIRY = '15m'`
  - `JWT_REFRESH_EXPIRY = '7d'`
  - `MAX_DISPATCH_RADIUS_KM = 5`
  - `DISPATCH_TIMEOUT_SECONDS = 30`
- `packages/shared-config/src/ride-transitions.ts` — `VALID_RIDE_TRANSITIONS` map defining which state transitions are allowed and by which actor
- `packages/shared-config/src/index.ts` — barrel exports

---

## Task 4: Shared Database Package (`packages/shared-db`)

Drizzle ORM schema definitions, connection management, and migration tooling.

**ORM choice: Drizzle** — lightweight, zero-runtime overhead, excellent TypeScript inference, supports PostGIS via raw SQL helpers, simpler than TypeORM.

**Files:**
- `packages/shared-db/package.json` — name: `@kansride/db`, depends on `drizzle-orm@^0.36`, `postgres@^3.4` (native pg driver), `@types/pg`
- `packages/shared-db/drizzle.config.ts` — migration config pointing to `./src/schema`
- `packages/shared-db/src/db.ts` — connection pool singleton with configurable pool size
- `packages/shared-db/src/schema/index.ts` — barrel export all tables
- `packages/shared-db/src/schema/users.ts` — users table (UUID PK, phone, role enum, status, timestamps)
- `packages/shared-db/src/schema/drivers.ts` — drivers table (FK users, license, vehicle_id, rating, subscription_expires_at, location coords)
- `packages/shared-db/src/schema/passengers.ts` — passengers table (FK users, rating, preferred_payment)
- `packages/shared-db/src/schema/vehicles.ts` — vehicles table (registration, type, colour, make, model, year, status)
- `packages/shared-db/src/schema/rides.ts` — rides table (passenger FK, driver FK, pickup/dropoff coords+address, status enum, estimated_fare, actual_fare, timestamps, verification_pin)
- `packages/shared-db/src/schema/payments.ts` — payments table (ride FK, amount integer in pesewas, method, status, provider_reference)
- `packages/shared-db/src/schema/subscriptions.ts` — driver_subscriptions table (driver FK, amount, start/end timestamps, payment_id, status)
- `packages/shared-db/src/schema/audit-logs.ts` — audit_logs table (user FK, entity_type, entity_id, action, changes JSONB, ip, timestamp)
- `packages/shared-db/src/schema/otp-requests.ts` — otp_requests table (phone, code_hash, attempts, expires_at, verified_at)
- `packages/shared-db/src/index.ts` — exports schema, getDb, Database type

**Important**: Store monetary amounts as integers (pesewas, 1 GHS = 100 pesewas) to avoid floating-point arithmetic issues.

**Initial SQL migration** must include:
- `CREATE EXTENSION IF NOT EXISTS postgis;`
- All tables with proper constraints and FK relationships
- Indexes: phone (unique), driver location (spatial), rides by status, payments by ride

---

## Task 5: Shared Auth Package (`packages/shared-auth`)

JWT token management, OTP generation/verification, and RBAC permission checking.

**Files:**
- `packages/shared-auth/package.json` — depends on `jsonwebtoken@^9`, `@kansride/types`, `@kansride/config`
- `packages/shared-auth/src/jwt.ts` — JWTService class: generateTokens, verifyAccessToken, verifyRefreshToken
- `packages/shared-auth/src/otp.ts` — OTPService class: generateOTP (6-digit), createOTPPayload, verifyOTPCode, isExpired, canAttempt
- `packages/shared-auth/src/rbac.ts` — RBACService class with ROLE_PERMISSIONS map, hasPermission(), canAccessResource()
- `packages/shared-auth/src/phone.ts` — normalizeGhanaPhone() (normalize to +233 format), validateGhanaPhone()
- `packages/shared-auth/src/index.ts` — barrel exports

---

## Task 6: Design System Package (`packages/design-system`)

Shared React Native UI components and theme tokens for both mobile apps.

**Files:**
- `packages/design-system/package.json` — name: `@kansride/ui`, peers: react, react-native
- `packages/design-system/src/theme.ts` — colors (KansRide brand: primary green/gold for Ghana), spacing scale, typography scale, border radii
- `packages/design-system/src/colors.ts` — full color palette including semantic colors (success, warning, error, info)
- `packages/design-system/src/Button.tsx` — reusable Button component (variants: primary, secondary, outline, ghost)
- `packages/design-system/src/TextInput.tsx` — styled text input with label, error state, phone number formatting
- `packages/design-system/src/OTPInput.tsx` — 6-digit OTP input with auto-focus advance
- `packages/design-system/src/BottomSheet.tsx` — draggable bottom sheet (core UX pattern for ride-hailing)
- `packages/design-system/src/Card.tsx` — content card component
- `packages/design-system/src/index.ts` — barrel exports

---

## Task 7: NestJS Backend Application (`apps/backend`)

Complete backend API skeleton with auth, users, drivers, rides, payments, WebSocket gateway, and background jobs.

**Files:**
- `apps/backend/package.json` — NestJS 10.x, @nestjs/jwt, @nestjs/passport, @nestjs/config, @nestjs/websockets, @nestjs/platform-socket.io, bullmq, redis, socket.io, pino/pino-pretty, helmet, cors, zod
- `apps/backend/tsconfig.json` — extends base, NestJS-specific settings
- `apps/backend/nest-cli.json` — NestJS CLI config
- `apps/backend/.env.example` — backend-specific env template

**Source structure:**
- `src/main.ts` — bootstrap NestJS app, helmet, CORS, Pino logger, listen on configurable port
- `src/app.module.ts` — root module importing all feature modules
- `src/config/configuration.ts` — load and validate env via @kansride/config

**Auth module (`src/auth/`):**
- `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- `jwt.strategy.ts` — Passport JWT strategy (extract from Bearer header)
- `jwt-auth.guard.ts` — guard that validates JWT
- `roles.guard.ts` — guard that checks user role against @Roles() decorator
- `roles.decorator.ts` — @Roles('driver', 'admin') decorator
- Endpoints: POST /auth/request-otp, POST /auth/verify-otp, POST /auth/refresh, POST /auth/logout
- OTP stored in Redis with TTL; rate limiting (3 attempts per 15 min)
- Mock SMS provider (logs OTP to console in dev)

**Users module (`src/users/`):**
- CRUD for user profiles
- Endpoint: GET /users/me, PATCH /users/me

**Drivers module (`src/drivers/`):**
- Driver registration, document submission (placeholder), subscription management
- Endpoints: POST /drivers/register, GET /drivers/me, POST /drivers/subscribe, GET /drivers/subscription-status

**Rides module (`src/rides/`):**
- `ride-state-machine.ts` — validates transitions using VALID_RIDE_TRANSITIONS from @kansride/config
- Basic ride CRUD and state transitions
- Endpoints: POST /rides/estimate, POST /rides/request, GET /rides/:id, PATCH /rides/:id/status

**WebSocket gateway (`src/websocket/`):**
- Socket.IO gateway with Redis Pub/Sub adapter (for future horizontal scaling)
- Namespaces: driver location updates, ride status updates
- Auth via handshake token validation
- Room-per-ride for tracking broadcasts

**Queue module (`src/queue/`):**
- BullMQ setup with Redis connection
- Placeholder processors: notification.processor.ts, subscription-check.processor.ts

**Common (`src/common/`):**
- Global exception filter (catches errors, logs, returns structured ApiError)
- Zod validation pipe (validates request bodies against Zod schemas)
- Request logging interceptor (correlation ID, duration)
- Current user decorator (@CurrentUser())
- Health check endpoint: GET /health (checks DB + Redis connectivity)

---

## Task 8: Passenger Mobile App Shell (`apps/mobile-passenger`)

Expo React Native app with navigation structure, auth flow, and map placeholder.

**Files:**
- `apps/mobile-passenger/package.json` — expo@~52, react-native, @react-navigation/native, @react-navigation/native-stack, expo-location, expo-secure-store, react-native-maps, socket.io-client, axios, zustand, @tanstack/react-query
- `apps/mobile-passenger/app.json` — Expo config (name: "KansRide", slug: "kansride-passenger")
- `apps/mobile-passenger/metro.config.js` — monorepo-aware config with watchFolders pointing to packages/
- `apps/mobile-passenger/tsconfig.json` — extends base
- `apps/mobile-passenger/src/app/_layout.tsx` — Expo Router root layout with auth context
- `apps/mobile-passenger/src/app/(auth)/login.tsx` — phone number entry screen
- `apps/mobile-passenger/src/app/(auth)/verify-otp.tsx` — OTP verification screen
- `apps/mobile-passenger/src/app/(main)/index.tsx` — home screen with full-screen map, "Where are you going?" search bar, bottom sheet
- `apps/mobile-passenger/src/app/(main)/ride-request.tsx` — fare estimate, confirm ride
- `apps/mobile-passenger/src/app/(main)/ride-active.tsx` — active ride tracking
- `apps/mobile-passenger/src/app/(main)/profile.tsx` — user profile
- `apps/mobile-passenger/src/providers/AuthProvider.tsx` — auth context with secure token storage
- `apps/mobile-passenger/src/providers/QueryProvider.tsx` — TanStack Query provider
- `apps/mobile-passenger/src/lib/api.ts` — Axios instance with interceptors (auth header, refresh token)
- `apps/mobile-passenger/src/lib/socket.ts` — Socket.IO client with auto-reconnect

---

## Task 9: Driver Mobile App Shell (`apps/mobile-driver`)

Same Expo setup as passenger app but with driver-specific screens.

**Files:** Same structure as passenger app with different screens:
- `src/app/(main)/index.tsx` — driver home with map, large online/offline toggle, subscription status, earnings summary
- `src/app/(main)/ride-request.tsx` — incoming ride request card with accept/decline countdown
- `src/app/(main)/active-ride.tsx` — navigation to pickup, trip in progress
- `src/app/(main)/earnings.tsx` — today/weekly/monthly earnings
- `src/app/(main)/subscription.tsx` — subscription payment and status
- `src/app/(main)/profile.tsx` — driver profile and documents
- `src/hooks/useBackgroundLocation.ts` — Expo background location task (updates every 10s when online)
- `src/hooks/useRideRequests.ts` — WebSocket listener for incoming ride offers

---

## Task 10: Admin Web Dashboard Shell (`apps/admin-web`)

Next.js 15 App Router with Tailwind CSS, server-side auth, and admin layout.

**Files:**
- `apps/admin-web/package.json` — next@^15, react@^19, tailwindcss, @tanstack/react-query, axios, lucide-react, recharts
- `apps/admin-web/next.config.ts` — transpile @kansride packages
- `apps/admin-web/tailwind.config.ts` — KansRide brand colors, content paths including packages
- `apps/admin-web/src/app/layout.tsx` — root layout with sidebar navigation
- `apps/admin-web/src/app/page.tsx` — dashboard overview (active drivers, rides, revenue cards)
- `apps/admin-web/src/app/login/page.tsx` — admin login
- `apps/admin-web/src/app/drivers/page.tsx` — driver list with search/filter
- `apps/admin-web/src/app/drivers/[id]/page.tsx` — driver detail (profile, documents, rides, subscription)
- `apps/admin-web/src/app/rides/page.tsx` — ride history with filters
- `apps/admin-web/src/app/map/page.tsx` — live operations map placeholder
- `apps/admin-web/src/app/subscriptions/page.tsx` — subscription management
- `apps/admin-web/src/components/Sidebar.tsx` — navigation sidebar
- `apps/admin-web/src/components/Header.tsx` — top bar with user menu
- `apps/admin-web/src/lib/api.ts` — API client for backend

---

## Task 11: Public Tracking Web Page (`apps/tracking-web`)

Minimal Next.js app for public ride tracking (shared via link).

**Files:**
- `apps/tracking-web/package.json` — next@^15, react, leaflet, react-leaflet, socket.io-client
- `apps/tracking-web/src/app/page.tsx` — landing/error state
- `apps/tracking-web/src/app/track/[token]/page.tsx` — live map showing driver location, ETA, trip status
- Optimized for low bandwidth: minimal JS, lightweight map tiles

---

## Task 12: CI/CD Pipeline

GitHub Actions workflow for automated quality checks.

**Files:**
- `.github/workflows/ci.yml` — triggers on push/PR to main/develop
  - Matrix: Node 24.x, ubuntu-latest
  - Services: postgis/postgis:16-3.4 (port 5432), redis:7-alpine (port 6379)
  - Steps: checkout, setup-node with npm cache, npm ci, lint, type-check (tsc --noEmit), build all packages, run tests
  - Env vars for test database and Redis

---

## Task 13: Documentation and Local Setup

- `README.md` — project overview, prerequisites (Node 24, PostgreSQL 16+PostGIS, Redis), setup steps, architecture diagram (text), monorepo structure explanation
- `docs/SETUP-WINDOWS.md` — Windows-specific PostgreSQL/PostGIS/Redis installation guide
- `docs/ARCHITECTURE.md` — system architecture, technology choices with rationale, package boundaries

---

## Dependency Order

```
Task 1 (monorepo root) — no dependencies
  ↓
Task 2 (types) + Task 3 (config) — depend on Task 1, parallel with each other
  ↓
Task 4 (db) + Task 5 (auth) — depend on Tasks 2+3
  ↓
Task 6 (design-system) — depends on Task 1 only, parallel with Tasks 4+5
  ↓
Task 7 (backend) — depends on Tasks 2+3+4+5
  ↓
Task 8 (passenger app) + Task 9 (driver app) — depend on Tasks 2+6, parallel
Task 10 (admin web) + Task 11 (tracking web) — depend on Tasks 2+3, parallel
  ↓
Task 12 (CI) — depends on all apps existing
Task 13 (docs) — depends on all tasks
```

**Parallelizable groups:**
- Group A: Tasks 2, 3, 6 (shared packages without cross-deps)
- Group B: Tasks 4, 5 (shared packages with deps on Group A)
- Group C: Tasks 7, 8, 9, 10, 11 (apps, after Group B)
- Group D: Tasks 12, 13 (CI and docs, after all)

---

## Rejected Alternatives

| Alternative | Reason for Rejection |
|---|---|
| **TypeORM** (Plan A) | Heavier runtime, worse TypeScript inference, awkward PostGIS integration requiring raw SQL anyway. Drizzle is lighter, faster, and more type-safe. |
| **Prisma** | No native PostGIS support; requires raw queries for spatial operations, defeating the purpose of an ORM. |
| **Turborepo** | Adds setup complexity with no benefit at this scale. npm workspaces are sufficient; Turborepo can be added later if build times become a problem. |
| **pnpm/yarn** | Not available on the system. npm 11 workspaces are capable. |
| **GraphQL** | Unnecessary complexity for Phase 1. REST is simpler, faster to implement, and sufficient for mobile app communication. |
| **Pages Router (Next.js)** | Deprecated pattern. App Router is the recommended approach for new Next.js projects. |
| **Dispatch engine in Phase 1** (Plan B) | Over-scopes foundation. Dispatch logic belongs in Phase 4 (Booking and Dispatch). Phase 1 only needs the ride state machine and basic CRUD. |
| **Full offline-first with SQLite** (Plan B) | Complex to implement correctly. Phase 1 mobile apps should handle basic network errors with retry; full offline sync is a Phase 3+ concern. |

---

## Risk Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Expo + npm workspaces Metro resolution | Build failure | Explicit metro.config.js with watchFolders pointing to packages/; use Expo SDK 52+ auto-detection |
| Node 24 native module compatibility | Install failure | Test `npm ci` early; use pure-JS alternatives where possible (e.g., bcryptjs not bcrypt) |
| No Docker for PostgreSQL/Redis | Dev setup friction | Document manual Windows installation steps; provide verification commands |
| workspace:* protocol (pnpm-only) | Install failure | Use standard npm workspace references (just the package name, npm resolves via workspaces config) |
| React/React Native version conflicts | Runtime errors | Pin exact versions in root package.json; use npm overrides if needed |
| PostGIS not installed with PostgreSQL | Migration failure | First migration checks `CREATE EXTENSION IF NOT EXISTS postgis`; document in setup guide |
| OTP SMS provider not configured | Auth blocked | Mock SMS provider logs OTP to console in development; real provider swapped later |
| WebSocket memory leaks | Server crash | Explicit room cleanup on disconnect; heartbeat timeout configuration |

---

## Implementation Notes

- **Financial amounts**: Always stored as integers (pesewas). 1 GHS = 100 pesewas. Never use floating point for money.
- **Phone numbers**: Always normalized to +233XXXXXXXXX format before storage.
- **UUIDs**: All primary keys are UUIDs (gen_random_uuid()).
- **Timestamps**: All tables have created_at and updated_at (UTC).
- **Soft deletes**: Only where legally required (user accounts for data retention). Most entities use status enums.
- **API versioning**: All endpoints prefixed with /api/v1.
- **Package references in npm workspaces**: Reference workspace packages by their package.json name (e.g., `"@kansride/types": "*"`) — npm automatically resolves via workspaces.