# KansRide Phase 2: Full Implementation Plan

## Summary
Transform the Phase 1 shell into a demonstrable, working ride-hailing platform. Prioritize demonstrability and incremental testability while maintaining production-ready architecture. Mock external services (SMS, maps, payments) for dev/demo while providing swap-ready interfaces.

## Key Design Decisions
- **Mock-first for external services**: SMS logs to console, Maps uses Haversine formula, Payments auto-succeed in dev mode
- **Redis optional**: Use in-memory fallback when Redis unavailable (Windows dev friendly)
- **Database indexes added**: For geo-queries, ride history, subscription checks
- **Minimal payload WebSocket events**: Optimize for Ghana's low-bandwidth networks
- **Service abstraction pattern**: Interface → MockImpl → RealImpl (factory selects via env)

---

## Phase 2A: Database & Infrastructure (Sequential — Foundation)

### Task A1: Database Module & Migrations
**Scope**: `packages/shared-db/`, `apps/backend/src/`
- Generate Drizzle migrations from existing schema (`drizzle-kit generate`)
- Create `packages/shared-db/src/migrate.ts` — programmatic migration runner
- Add database indexes: `drivers(is_online, current_lat, current_lng)`, `rides(status, created_at)`, `rides(passenger_id)`, `rides(driver_id)`, `subscriptions(driver_id, end_date)`, `otp_requests(phone_number, expires_at)`
- Create NestJS `DatabaseModule` (`apps/backend/src/database/database.module.ts`) that provides `Database` token via DI
- Wire `DatabaseModule` into `AppModule`
- Create `apps/backend/scripts/init-db.ts` — CLI script to run migrations + optional seed
- **Done criteria**: `npm run db:migrate` succeeds against local PostgreSQL; Database injectable in all services

### Task A2: Redis Module (with In-Memory Fallback)
**Scope**: `apps/backend/src/redis/`
- Create `apps/backend/src/redis/redis.module.ts` — NestJS module providing Redis client
- Create `apps/backend/src/redis/redis.service.ts` — wraps `ioredis` with geo commands
- Implement in-memory fallback (`apps/backend/src/redis/memory-redis.service.ts`) when REDIS_URL not configured
- Geo operations: `geoAdd(key, lng, lat, member)`, `geoSearch(key, lng, lat, radiusKm)`, `geoRemove(key, member)`
- Key-value: `set(key, value, ttlSeconds)`, `get(key)`, `del(key)`
- **Done criteria**: Backend starts without Redis (uses memory fallback); with Redis, geo-queries work

### Task A3: Service Provider Abstractions
**Scope**: `apps/backend/src/providers/`
- Create `apps/backend/src/providers/sms/sms.interface.ts` — `{ sendOTP(phone, code): Promise<void> }`
- Create `apps/backend/src/providers/sms/mock-sms.provider.ts` — logs OTP to console
- Create `apps/backend/src/providers/sms/hubtel-sms.provider.ts` — HTTP call stub
- Create `apps/backend/src/providers/maps/maps.interface.ts` — `{ getDistance(from, to): Promise<{meters, seconds}> }`
- Create `apps/backend/src/providers/maps/haversine-maps.provider.ts` — Haversine formula + speed estimate
- Create `apps/backend/src/providers/payments/payment.interface.ts` — `{ initiate(amount, method, phone): Promise<{ref}>; verify(ref): Promise<status> }`
- Create `apps/backend/src/providers/payments/mock-payment.provider.ts` — auto-success after 2s delay
- Create `apps/backend/src/providers/providers.module.ts` — factory providers selected by env vars
- **Done criteria**: All providers injectable; mock mode works without external APIs

---

## Phase 2B: Core Business Logic (Parallelizable after A1-A3)

### Task B1: Auth Service — Real OTP & User Persistence
**Scope**: `apps/backend/src/modules/auth/`
- Rewrite `auth.service.ts` to inject `Database` and `SMSProvider`
- `requestOTP()`: normalize phone → rate-limit check (max 3/15min) → generate OTP → hash → insert `otp_requests` → send via SMS provider → return expiresIn
- `verifyOTP()`: lookup by phone+unexpired → verify hash → check attempts → find-or-create user → generate JWT pair with real userId → mark OTP verified
- `refreshToken()`: verify refresh token → issue new access token
- Add `bcryptjs` for OTP hashing (more secure than SHA-256)
- **Done criteria**: Full OTP flow persists to DB; user created on first login; tokens contain real user ID

### Task B2: Rides Service — Creation, State Machine, Fare Calculation
**Scope**: `apps/backend/src/modules/rides/`
- Create `apps/backend/src/modules/rides/fare.service.ts` — `calculateFare(distanceM, durationS, rideType): pesewas` using constants from @kansride/config
- Create `apps/backend/src/modules/rides/state-machine.service.ts` — validates transitions using `VALID_RIDE_TRANSITIONS`
- Rewrite `rides.service.ts`:
  - `createRide()`: insert ride → call maps for distance/ETA → calculate fare → store estimates → transition to 'requested' → trigger dispatch
  - `updateStatus()`: validate via state machine → update DB → emit WebSocket event
  - `cancelRide()`: validate actor + transition → update DB → emit events
  - `getRide()`: fetch from DB with driver/passenger joins
  - `rateRide()`: validate ride completed → store rating → update driver avg rating
- **Done criteria**: Rides persist to DB; state machine enforces valid transitions; fare calculated correctly

### Task B3: Drivers Service — Registration, Location, Subscription
**Scope**: `apps/backend/src/modules/drivers/`
- Rewrite `drivers.service.ts`:
  - `register()`: validate → create user (role=driver_applicant) → insert driver record → insert vehicle
  - `setOnlineStatus(true, location)`: check active subscription → update DB → add to Redis geo-index
  - `setOnlineStatus(false)`: remove from Redis → update DB
  - `subscribe()`: initiate payment → on success create subscription (24h) → update driver.subscriptionExpiresAt
  - `getEarnings()`: aggregate completed rides fare by day/week
- Create subscription expiry scheduler (runs every 5 min, sets expired drivers offline)
- **Done criteria**: Drivers can register, go online (with subscription), location stored in Redis/memory

### Task B4: Dispatch Engine
**Scope**: `apps/backend/src/modules/rides/dispatch.service.ts` (new)
- Create `DispatchService`:
  - `dispatchRide(rideId)`: query Redis geo-index for online drivers within 2km → filter by active subscription → sort by rating → offer to top 5
  - For each driver: store offer in Redis (TTL=30s) → emit `ride:offered` via WebSocket
  - After 15s no acceptance: expand radius to 5km, re-query
  - After 30s total: transition ride to 'no_driver_found'
- Handle `driverAcceptRide(rideId, driverId)`: validate offer exists → assign driver → transition ride → notify passenger → cancel other offers
- Use `@nestjs/schedule` interval for monitoring pending dispatches
- **Done criteria**: Rides dispatch to nearby drivers; first-accept wins; timeout handled

---

## Phase 2C: Real-time Features (After B1-B4)

### Task C1: WebSocket Gateway — Full Implementation
**Scope**: `apps/backend/src/modules/events/`
- Rewrite `events.gateway.ts`:
  - Auth on connect: validate JWT from socket handshake → reject unauthorized
  - `driver:location` handler: update Redis geo-index → if driver has active ride, broadcast to ride room
  - `driver:accept-ride` handler: call DispatchService.driverAcceptRide
  - `ride:subscribe` handler: join `ride:{rideId}` room
  - Add `emitRideUpdate(rideId, data)` — broadcasts status changes to ride room
  - Add `emitToUser(userId, event, data)` — targeted notifications
- Configure Socket.IO Redis adapter (optional, for horizontal scaling)
- **Done criteria**: Real-time location flows from driver → passenger; ride status updates broadcast

---

## Phase 2D: Frontend Integration (Parallelizable after B1-B4)

### Task D1: Admin Dashboard — Wire to Real API
**Scope**: `apps/admin-web/src/`
- Create `src/lib/api.ts` — fetch wrapper with auth headers
- Create React Query hooks: `useDrivers()`, `useRides()`, `useUsers()`, `useDashboardStats()`
- Wire `/dashboard/page.tsx` — fetch real stats from `GET /api/v1/admin/dashboard`
- Wire `/dashboard/drivers/page.tsx` — paginated driver list, status badges, actions
- Wire `/dashboard/rides/page.tsx` — ride list with status filter
- Wire `/dashboard/users/page.tsx` — user management
- Wire `/dashboard/subscriptions/page.tsx` — subscription list
- Add backend admin endpoints: `GET /admin/dashboard`, `GET /admin/drivers`, `GET /admin/rides`
- **Done criteria**: Admin pages show real data from API; pagination works

### Task D2: Mobile Passenger App — Real Integration
**Scope**: `apps/mobile-passenger/`
- Wire auth flow: login.tsx calls `/auth/request-otp`, verify-otp.tsx calls `/auth/verify-otp`, stores tokens
- Wire home.tsx: destination search → call `POST /rides` → show searching state
- Add active ride screen: subscribe to WebSocket `ride:{rideId}` room → show driver location + status
- Wire activity.tsx: call `GET /rides?passengerId=me` → show real history
- Wire profile.tsx: call `GET /users/me` → show real data
- Add token refresh interceptor in API client
- **Done criteria**: Passenger can login, request ride, see status updates, view history

### Task D3: Mobile Driver App — Real Integration
**Scope**: `apps/mobile-driver/`
- Wire auth flow (same pattern as passenger)
- Wire home.tsx: online toggle calls `/drivers/go-online` + starts location broadcasting via WebSocket
- Add ride offer UI: listen for `ride:offered` → show accept/decline bottom sheet
- Wire subscription.tsx: call `/drivers/subscribe` → show active status
- Wire earnings.tsx: call `/drivers/earnings` → show real data
- Add background location tracking (expo-location + expo-task-manager)
- **Done criteria**: Driver can login, go online, receive ride offers, accept rides

### Task D4: Tracking Web — Live Ride Tracking
**Scope**: `apps/tracking-web/src/`
- Wire `/track/[rideId]/page.tsx`: fetch ride details (no auth) → connect Socket.IO → listen for location updates
- Add simple map display (Leaflet.js or static map image with markers)
- Show ride status, pickup/dropoff, driver info (masked)
- **Done criteria**: Public tracking page shows real-time ride status

---

## Phase 2E: Demo, Build & Polish

### Task E1: Seed Data & Demo Script
**Scope**: `packages/shared-db/src/seed.ts`
- Create seed script: 5 drivers (with vehicles, active subscriptions), 10 passengers, 3 completed rides, 1 active ride
- Drivers positioned around Kansawrodo/Sekondi-Takoradi coordinates (4.9°N, 1.7°W)
- Add `npm run seed` script to shared-db package
- **Done criteria**: After seeding, admin dashboard shows populated data; demo is visually compelling

### Task E2: iOS Build Configuration (Expo EAS)
**Scope**: `apps/mobile-passenger/`, `apps/mobile-driver/`
- Create `apps/mobile-passenger/eas.json` and `apps/mobile-driver/eas.json` with build profiles (development, preview, production)
- Configure iOS-specific settings in app.json (bundleIdentifier, permissions, capabilities)
- Add `expo-dev-client` dependency for development builds
- Document EAS build commands in README
- **Done criteria**: `eas build --platform ios --profile preview` config is valid and ready

### Task E3: Preview Capability — Start All Apps
**Scope**: Root scripts + documentation
- Add root script: `npm run dev` that starts backend (port 3000) + admin-web (port 3001) + tracking-web (port 3002)
- Ensure backend serves API + WebSocket on same port
- Document how to run mobile apps with Expo Go (scan QR code)
- Create `docs/DEMO-GUIDE.md` with step-by-step demo walkthrough
- **Done criteria**: User can run one command and access all web apps; mobile apps connect via Expo Go

### Task E4: Comprehensive README
**Scope**: Root `README.md` (rewrite) + `docs/COMPLETE-GUIDE.md`
- Full platform description with all features
- Architecture diagram (text-based)
- All user flows documented (passenger ride request, driver acceptance, admin management)
- API endpoint reference
- WebSocket event reference
- Database schema overview
- Payment flow explanation
- Deployment guide
- **Done criteria**: New developer can understand entire system from README alone

### Task E5: Push to GitHub
- Commit all Phase 2 changes
- Push to https://github.com/SAMUEL-NTI-SARPONG/Kansride-v3.git
- Tag release: `v0.2.0-phase2`

---

## Dependency Graph

```
A1 (DB) ─────┬──→ B1 (Auth)
A2 (Redis) ──┤──→ B3 (Drivers) ──→ B4 (Dispatch)
A3 (Providers)┘──→ B2 (Rides) ────→ B4 (Dispatch)
                                         │
B1 + B2 + B3 + B4 ──→ C1 (WebSocket) ──→ D1-D4 (Frontend)
                                         │
                       E1 (Seed) ────────┘
                       E2 (iOS) ── independent after D2/D3
                       E3 (Preview) ── after C1 + D1
                       E4 (README) ── after all
                       E5 (Push) ── final step
```

## Parallelization Strategy
- **Batch 1**: A1, A2, A3 (infrastructure — can parallelize, isolated scopes)
- **Batch 2**: B1, B2, B3 (core logic — parallelizable, each owns its module)
- **Batch 3**: B4 + C1 (dispatch + WebSocket — sequential, tightly coupled)
- **Batch 4**: D1, D2, D3, D4 (frontend — fully parallel, isolated apps)
- **Batch 5**: E1, E2, E3, E4, E5 (polish — mostly sequential)

## Rejected Alternatives
- **Full PostGIS for geo-queries**: Overkill for current scale (<100 drivers). Redis geo-sorted-sets provide O(log n) queries with simpler setup. PostGIS can be added later for complex polygon geofencing.
- **Kafka/RabbitMQ for event streaming**: Unnecessary infrastructure for single-server deployment. Socket.IO + Redis pub/sub handles the current event volume. Add message queues when multi-region deployment is needed.
- **Docker requirement for local dev**: User is on Windows 21H2 without Docker. Native PostgreSQL + optional Redis (with in-memory fallback) keeps the dev experience frictionless.
- **Real SMS/Payment integration in Phase 2**: External API dependencies add flakiness to demos. Mock-first with interface abstraction means we can swap to real providers without code changes when API keys are ready.
