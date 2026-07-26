# KansRide Architecture Notes

**Last verified:** 2026-07-26
**Scope:** architecture relevant to recovery and future coding agents

## Monorepo Topology

KansRide uses npm workspaces:

```text
.
├── apps
│   ├── backend
│   ├── admin-web
│   ├── tracking-web
│   ├── mobile-passenger
│   └── mobile-driver
├── packages
│   ├── shared-types
│   ├── shared-config
│   ├── shared-db
│   ├── shared-auth
│   └── design-system
└── docs/recovery
```

Root aliases in `tsconfig.base.json` point `@kansride/*` imports to package source. App-specific TypeScript configurations override module resolution for NestJS, Next.js, and Expo.

## Applications

### Backend — `apps/backend`

NestJS exposes REST under the global prefix `/api/v1` and a Socket.IO namespace at `/rides`.

Backend module topology from `apps/backend/src/app.module.ts`:

| Module | Responsibility |
| --- | --- |
| `database` | Global Drizzle database connection |
| `auth` | SMS OTP request/verification, user creation, JWT issue/refresh |
| `users` | Authenticated user profile retrieval |
| `drivers` | Driver registration/profile, online state, location, subscription, earnings |
| `rides` | Fare, state machine, ride persistence, dispatch, cancellation, rating, tracking |
| `events` | Authenticated Socket.IO connections, rooms, driver location, offer acceptance |
| `admin` | Guarded operational dashboard data |
| `health` | Basic REST health response |
| `redis` | Redis or in-memory key/value and geo operations |
| `providers` | SMS, maps, and payment interfaces/implementations |

Scheduling supports subscription-expiry checks. Throttling is configured globally at 60 requests per 60 seconds; OTP also has a database-backed 3-per-15-minute limit.

### Web applications

- `apps/admin-web`: Next.js App Router dashboard. REST base is `NEXT_PUBLIC_API_URL` or `http://localhost:3000/api/v1`. The client reads `admin_token` from browser local storage.
- `apps/tracking-web`: Next.js App Router landing page and `/track/[rideId]`. REST tracking is public; its Socket.IO client currently sends no token.

### Mobile applications

- `apps/mobile-passenger`: Expo Router auth/main groups, AsyncStorage token client, Zustand auth/ride state, authenticated Socket.IO client.
- `apps/mobile-driver`: Expo Router auth/main groups, AsyncStorage token client, Zustand auth/driver/location state, driver location and ride Socket.IO client.

Both mobile clients default to `http://localhost:3000/api/v1` and use `EXPO_PUBLIC_API_URL`; WebSocket defaults use `EXPO_PUBLIC_WS_URL`.

## Shared Packages

| Package | Key files and contract |
| --- | --- |
| `packages/shared-types` | `auth.types.ts`, `ride.types.ts`, `payment.types.ts`, `vehicle.types.ts`, `api.types.ts` |
| `packages/shared-config` | `env.ts` validates runtime input; `constants.ts` holds business values; `ride-transitions.ts` is the state-transition table |
| `packages/shared-db` | `src/schema/*`, `src/db.ts`, `src/migrate.ts`, `src/migrations/*` |
| `packages/shared-auth` | `jwt.ts`, `otp.ts`, `phone.ts`, `rbac.ts` |
| `packages/design-system` | Theme/colours and reusable React Native UI components |

The current apps declare `@kansride/ui`, but no application source import was found. Treat adoption as unverified, not as an architectural invariant.

## Authentication and Authorization

### OTP and JWT flow

1. A client calls `POST /api/v1/auth/request-otp` with `phoneNumber`.
2. `AuthService` normalizes and validates a Ghana phone number, rate-limits, hashes and persists the OTP request, and invokes the configured SMS provider.
3. `POST /api/v1/auth/verify-otp` validates the latest live OTP and marks it used.
4. The service finds or creates a `users` row.
5. For a passenger-role user, it ensures a unique `passengers` row through `passengers.userId`.
6. `JWTService` issues access and refresh tokens containing `{ userId, phoneNumber, role }`.

The JWT does not contain `sub`, `passengerId`, or `driverId`. `AuthGuard` verifies the bearer access token and assigns the payload to `request.user`.

### RBAC and ownership

`@RequirePermissions(...)` adds route metadata and `RolesGuard` checks it against `packages/shared-auth/src/rbac.ts`. RBAC answers whether a role may attempt an operation. Services must still enforce resource ownership with correctly resolved domain IDs.

Administrative REST routes use per-resource permissions:

| Route | Permission |
| --- | --- |
| `GET /admin/dashboard` | `admin:view_analytics` |
| `GET /admin/drivers` | `admin:manage_drivers` |
| `GET /admin/rides` | `ride:view_all` |
| `GET /admin/users` | `admin:manage_users` |
| `GET /admin/subscriptions` | `admin:manage_subscriptions` |

The recovered admin authentication design assumes an already provisioned administrative `users` row authenticates through the normal phone-OTP flow. Provisioning and the admin-web login UI still require investigation.

## Identity Mapping

```text
JWT req.user.userId
        │
        └── users.id
             ├── passengers.userId ──> passengers.id ──> rides.passengerId
             └── drivers.userId    ──> drivers.id    ──> rides.driverId
```

Additional actor columns:

- `rides.cancelledBy` stores the authenticated actor’s `users.id`. It is a nullable UUID with no foreign key in `rides.ts`.
- `rides.ratedBy` stores the rating actor’s `users.id` and references `users.id`.

Architectural invariant: never compare or write `users.id` directly to `rides.passengerId` or `rides.driverId`.

## Ride Lifecycle

The schema/type status set is:

```text
draft
requested
searching
driver_offered
driver_assigned
driver_en_route
driver_arrived
waiting_for_passenger
passenger_verified
in_progress
completed
cancelled_by_passenger
cancelled_by_driver
cancelled_by_admin
no_driver_found
passenger_no_show
driver_no_show
payment_pending
payment_failed
disputed
emergency_hold
```

`packages/shared-config/src/ride-transitions.ts` is the implemented transition policy. The main configured path is:

```text
draft
  -> requested
  -> searching
  -> driver_offered
  -> driver_assigned
  -> driver_en_route
  -> driver_arrived
  -> waiting_for_passenger
  -> passenger_verified
  -> in_progress
  -> completed
  -> payment_pending
  -> payment_failed
```

Cancellation and exception branches depend on the current state and actor. Configured terminal states have no outgoing transitions: the three cancellation statuses, `no_driver_found`, `passenger_no_show`, `driver_no_show`, `payment_failed`, and `disputed`. `emergency_hold` may return to `in_progress` or be cancelled by an admin.

Important qualifications:

- Presence in the schema does not prove a status is reachable. `driver_no_show` and `disputed` have no inbound transition in the current table.
- Rating is persisted on a completed ride; it is not a ride status transition.
- The driver client currently skips configured intermediate states in parts of its progression. This is a known contract gap.
- `RidesService.updateStatus` defaults its actor to `system`, while the controller does not pass the authenticated role. Whether current driver status calls can satisfy actor rules requires correction and runtime verification.

## Cancellation Semantics

`RidesService.cancelRide` has an explicit role mapping:

| Authenticated role | State-machine actor | Target status |
| --- | --- | --- |
| `passenger` | `passenger` | `cancelled_by_passenger` |
| `driver` | `driver` | `cancelled_by_driver` |
| `super_admin` | `admin` | `cancelled_by_admin` |

Other roles are rejected by the service even if a future RBAC change accidentally grants `ride:cancel`.

The state machine still decides whether that actor may cancel from the ride’s current status. On success:

- the ride status, optional reason, `cancelledBy` (`users.id`), and `updatedAt` are persisted;
- `ride:update` is emitted to `ride:{rideId}`;
- if assigned, `ride:cancelled` is emitted to the driver via its connected user sockets.

The database write occurs before emission. There is no outbox or durable event delivery.

## Rating Semantics

Rating is stored on `rides` through migration `0001_ride_rating_columns.sql`:

- `rating`: integer;
- `ratingComment`: text;
- `ratedAt`: timestamp;
- `ratedBy`: `users.id`.

`RidesService.rateRide` enforces:

- integer rating from 1 through 5;
- ride status exactly `completed`;
- passenger role;
- ownership after resolving `passengers.id`;
- one rating per ride.

The conditional update includes `rated_by IS NULL`, so a concurrent loser receives a conflict. That ride update, live `AVG(rides.rating)` query, and `drivers.rating` update share one database transaction. `drivers.completedRides` is not used in the rating calculation and is not authoritative for this operation.

## Database and Migrations

`packages/shared-db/src/schema` defines:

- `users`, `passengers`, `drivers`, `vehicles`;
- `rides`;
- `payments`, `driver_subscriptions`;
- `otp_requests`, `audit_logs`.

`packages/shared-db/src/db.ts` creates a singleton `pg` pool and Drizzle database. `DatabaseModule` exposes it globally.

Drizzle Kit reads `packages/shared-db/drizzle.config.ts` and writes to `packages/shared-db/src/migrations`.

Current migrations:

- `0000_unusual_morlun.sql`: PostGIS extension, enums, core tables, foreign keys, and indexes.
- `0001_ride_rating_columns.sql`: ride rating fields and `rated_by` foreign key.

`src/migrate.ts` applies migrations from `./src/migrations`. Local execution remains runtime-unverified because the recovery log records PostgreSQL `28P01`.

Money is represented as numeric integer pesewas in the database, backend calculations, shared TypeScript contracts, API/event payloads, and client state. Monetary field names identify the unit with a `Pesewas` suffix, including `estimatedFarePesewas`, `actualFarePesewas`, `farePesewas`, and `amountPesewas`. UI components convert once at the presentation boundary and render `GHS 0.00`-style strings. Missing, negative, fractional, or non-finite presentation inputs render a safe placeholder rather than `NaN`.

`FareService.calculateFare` returns `FareBreakdown` with `baseFarePesewas`, `distanceFarePesewas`, `timeFarePesewas`, and `totalFarePesewas`. Distance and time components use the existing upward rounding, and the priority total is rounded upward after multiplication, so every returned value remains an integer. The minimum is applied before the existing 1.5× `priority_tricycle` multiplier.

## Redis and Provider Boundaries

`RedisModule` selects:

- `RedisService` when `REDIS_URL` is present;
- `MemoryRedisService` otherwise.

The abstraction supports key/value TTLs, geo indexing/search, sets, and health. Driver geo members are `drivers.id`.

`ProvidersModule` selects mock or Hubtel SMS, Haversine mapping, and mock payment implementations. These are interfaces and development implementations, not proof of production integration.

## WebSocket and Event Architecture

`EventsGateway` uses Socket.IO namespace `/rides`.

Confirmed behavior:

- Connections require an access JWT in `handshake.auth.token` or a bearer authorization header.
- The gateway tracks socket IDs by JWT `users.id`.
- `ride:subscribe` joins room `ride:{rideId}`.
- `driver:location` resolves `drivers.id`, updates Redis on every event, debounces database writes, and emits `ride:driver-location` for an active ride.
- `driver:accept-ride` delegates to dispatch and emits `ride:driver-assigned` to the ride room.
- `driver:decline-ride` deletes that driver’s offer key.
- Services can emit to a ride room, a user’s sockets, or a driver after resolving `drivers.userId`.

Confirmed gaps:

- `DispatchService.offerToDrivers` stores Redis offers but never calls `emitToDriver(..., 'ride:offered', ...)`.
- `RidesService.updateStatus` does not emit `ride:update`.
- The driver-assigned payload contains only `rideId`, `driverId`, and a message.
- Tracking web supplies no JWT to an authenticated namespace.
- Passenger emits `ride:unsubscribe`, but the gateway has no handler.
- Rooms are process-local; no Socket.IO Redis adapter is configured.
- There is no durable event log/outbox, delivery acknowledgement strategy, or reconnect replay.

## Frontend/Backend API Boundaries

Backend REST prefix: `http://<host>:<port>/api/v1`.

Principal current routes:

- Auth: `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/refresh-token`
- User: `GET /users/me`
- Drivers: register, go-online/offline, location, subscribe, profile, earnings
- Rides: create, actor-scoped own history, ownership-checked get by ID, cancel, update status, rate, public track
- Admin: dashboard, drivers, rides, users, subscriptions
- Health: `GET /health`

Known contract mismatches requiring recovery:

- Passenger auth uses `phone` instead of `phoneNumber`.
- Passenger OTP response expects `user.phone` / `user.name`.
- Passenger cancellation uses `POST`, while the backend declares `PATCH /rides/:id/cancel`.
- Admin login UI does not implement the backend’s phone-OTP design.
- Tracking socket authentication is absent.
- Driver ride-status handling does not fully match the configured state machine.

Do not “fix” one side without inspecting and approving the complete boundary.

`POST /rides` accepts only the schema-supported `RideType` values: `standard_tricycle`, `priority_tricycle`, `shared`, and `parcel_delivery`. An omitted type defaults to `standard_tricycle`; any supplied unsupported value is rejected before fare or database work. The passenger selector currently exposes Standard and Priority, mapped directly to the first two canonical values. `priority_tricycle` retains the implemented 1.5× fare multiplier.

The `POST /rides` response implements the shared `CreateRideResponse` contract. Its authoritative fare is `estimatedFarePesewas: number`, and `fareBreakdown` uses only explicit pesewa-suffixed fields. The passenger active-ride state copies this backend value directly; the removed local estimate cannot override it.

`GET /rides/my-rides` uses the JWT role to resolve either `passengers.id` or `drivers.id`, returns a bounded deterministic history array, and accepts no profile identifier from the caller. Its selected actual-or-estimated value is transported as `farePesewas`; conversion to GHS occurs in the activity screen.

Tracking uses `estimatedFarePesewas`; admin ride lists use `farePesewas` and `totalRevenuePesewas`; driver offer/state and earnings contracts use `estimatedFarePesewas`, `todayPesewas`, and `thisWeekPesewas`. These consumers format GHS at their UI boundary. The driver offer producer remains absent and belongs to Task 3b.

## Environment Validation

`packages/shared-config/src/env.ts` uses Zod and caches the parsed result. In production it requires explicit JWT access/refresh secrets, database URL, and database password, and rejects the documented default JWT secrets.

`apps/backend/src/main.ts` calls `getEnv()` before `NestFactory.create()` and uses validated `APP_PORT`. This provides shared startup validation.

Some backend modules still read `process.env` directly and contain development fallbacks for database/JWT/provider selection. Startup parsing establishes valid environment shape, but those direct reads and fallback consistency should be reviewed before production deployment.

Relevant variable names include database, Redis, JWT access/refresh, SMS, maps, logging, node environment, and application port. Do not copy secret values into recovery documents.

## Validation and Build Commands

Root scripts discovered:

```powershell
npm run build
npm test
npm run lint
npm run type-check
```

Qualification:

- Root build delegates to workspace build scripts.
- No workspace currently defines a `test` script, so `npm test` provides no automated coverage.
- Root `type-check` is a bare `tsc --noEmit`; historical audit evidence says root/base checking is not a valid all-app signal.
- Backend/mobile lint uses ESLint, but the installed ESLint 9 does not use the checked-in legacy `.eslintrc.json`.
- Admin/tracking `next lint` is present but deprecated in the current Next.js toolchain.

Use focused TypeScript checks during recovery:

```powershell
npx tsc --noEmit -p packages/shared-types/tsconfig.json
npx tsc --noEmit -p packages/shared-config/tsconfig.json
npx tsc --noEmit -p packages/shared-db/tsconfig.json
npx tsc --noEmit -p packages/shared-auth/tsconfig.json
npx tsc --noEmit -p packages/design-system/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npx tsc --noEmit -p apps/admin-web/tsconfig.json
npx tsc --noEmit -p apps/tracking-web/tsconfig.json
npx tsc --noEmit -p apps/mobile-passenger/tsconfig.json
npx tsc --noEmit -p apps/mobile-driver/tsconfig.json
```

Relevant builds and migration:

```powershell
npm run build --workspace=apps/backend
npm run build --workspace=apps/admin-web
npm run build --workspace=apps/tracking-web
npm run db:migrate --workspace=packages/shared-db
```

Run only the commands appropriate to the approved scope and record static versus runtime outcomes honestly.

## Architectural Invariants

- JWT `userId` is always `users.id`.
- Resolve passenger/driver profile IDs before querying or writing ride ownership.
- Never compare `users.id` directly with `rides.passengerId` or `rides.driverId`.
- `rides.cancelledBy` and `rides.ratedBy` use `users.id`.
- RBAC permission and resource ownership are separate checks.
- `VALID_RIDE_TRANSITIONS` remains the transition authority until an approved design replaces it.
- Persist a state change before broadcasting it.
- Ride rating persistence and driver aggregate recomputation remain atomic.
- The conditional duplicate-rating guard must remain part of the database mutation.
- Ride type must be validated against the canonical shared/schema set before fare calculation and persistence; fare and insert must use the same validated value.
- Monetary persistence uses integer pesewas.
- Monetary API/event/state fields must be numeric integer pesewas and carry an explicit `Pesewas` suffix; currency strings belong only in presentation code.
- The fare persisted and returned by ride creation must come from the backend `FareService`; a client estimate must never replace it after creation.
- Migrations are append-only history; do not rewrite applied migration intent casually.
- Do not weaken authenticated Socket.IO access to solve public tracking without an approved security design.
- Provider mocks must not be represented as production integrations.

## Areas Requiring Investigation

- `RidesService.updateStatus` actor propagation and missing configured intermediate states.
- Atomic single-driver assignment under concurrent offer acceptance.
- Complete dispatch event payload and Redis offer cleanup/indexing.
- Reliable real-time delivery, multi-instance Socket.IO, and reconnect behavior.
- Public tracking authorization model.
- Admin user provisioning and admin-web login/session design.
- Client auth navigation guards beyond root redirects.
- Maintenance semantics for `drivers.completedRides` and `passengers.completedRides`.
- Reachability/meaning of `driver_no_show`, `disputed`, and post-completion payment statuses.
- PostGIS usage: migration enables PostGIS, but current driver/ride coordinates are numeric columns and Redis geo search performs dispatch.
- Production CORS, secret handling, providers, observability, and database connection policy.
- Automated test architecture and CI script correctness.
