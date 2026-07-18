# KansRide Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
├──────────────┬──────────────┬─────────────────┬─────────────────────┤
│  Passenger   │   Driver     │   Admin         │   Tracking          │
│  Mobile App  │  Mobile App  │  Dashboard      │   Web Page          │
│  (Expo)      │  (Expo)      │  (Next.js)      │   (Next.js)         │
│  Port: 8081  │  Port: 8082  │  Port: 3001     │   Port: 3002        │
└──────┬───────┴──────┬───────┴────────┬────────┴─────────┬───────────┘
       │              │                │                   │
       │   HTTP/REST + WebSocket (Socket.IO)               │
       │              │                │                   │
┌──────▼──────────────▼────────────────▼───────────────────▼───────────┐
│                     BACKEND (NestJS)                                   │
│                     Port: 3000                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │  Users   │ │  Rides   │ │ Drivers  │ │  Events   │  │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │ │  Gateway  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└───────────────────────┬──────────────────────────┬───────────────────┘
                        │                          │
              ┌─────────▼─────────┐      ┌─────────▼─────────┐
              │   PostgreSQL 16   │      │     Redis 7        │
              │   + PostGIS       │      │   (Cache/PubSub)   │
              │   Port: 5432      │      │   Port: 6379       │
              └───────────────────┘      └─────────────────────┘
```

---

## Package Dependency Graph

```
@kansride/types          (no internal dependencies)
       │
       ├──► @kansride/config     (depends on: types)
       │
       ├──► @kansride/db         (depends on: types, config)
       │
       └──► @kansride/auth       (depends on: types, db)

@kansride/ui             (depends on: types)

@kansride/backend        (depends on: types, config, db, auth)
@kansride/admin-web      (depends on: types, config)
@kansride/tracking-web   (depends on: types)
@kansride/mobile-*       (depends on: types, ui)
```

Build order: `types` → `config` → `db` → `auth` → apps

---

## Module Responsibilities

| Module | Package | Responsibility |
|--------|---------|---------------|
| **shared-types** | `@kansride/types` | TypeScript interfaces, enums, DTOs, ride states |
| **shared-config** | `@kansride/config` | Environment validation, app constants, feature flags |
| **shared-db** | `@kansride/db` | Drizzle schema, migrations, database client, queries |
| **shared-auth** | `@kansride/auth` | JWT utilities, OTP generation/verification, RBAC helpers, phone validation |
| **design-system** | `@kansride/ui` | Shared React Native components (buttons, inputs, cards) |
| **backend** | `@kansride/backend` | REST API, WebSocket gateway, business logic |
| **admin-web** | `@kansride/admin-web` | Admin dashboard for managing users, drivers, rides |
| **tracking-web** | `@kansride/tracking-web` | Public real-time ride tracking page |
| **mobile-passenger** | `@kansride/mobile-passenger` | Passenger app (request rides, track, rate) |
| **mobile-driver** | `@kansride/mobile-driver` | Driver app (accept rides, navigate, manage subscription) |

---

## Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │ Backend  │         │   SMS    │
│  (App)   │         │  Server  │         │ Provider │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                     │                     │
     │  POST /auth/otp     │                     │
     │  {phone: "+233..."} │                     │
     │────────────────────►│                     │
     │                     │  Send OTP via SMS   │
     │                     │────────────────────►│
     │                     │                     │
     │   200 {message}     │                     │
     │◄────────────────────│                     │
     │                     │                     │
     │  POST /auth/verify  │                     │
     │  {phone, otp}       │                     │
     │────────────────────►│                     │
     │                     │ Validate OTP        │
     │                     │ Create/find user    │
     │                     │ Generate tokens     │
     │                     │                     │
     │  200 {accessToken,  │                     │
     │       refreshToken, │                     │
     │       user}         │                     │
     │◄────────────────────│                     │
     │                     │                     │
     │  (All subsequent requests)                │
     │  Authorization: Bearer <accessToken>      │
     │────────────────────►│                     │
```

### Token Strategy
- **Access Token**: Short-lived (15 min), used for API calls
- **Refresh Token**: Long-lived (7 days), stored securely, used to rotate access tokens
- **Roles**: `passenger`, `driver`, `admin`
- **Phone Format**: Ghana numbers only (`+233XXXXXXXXX`)

---

## Ride Lifecycle (State Machine)

```
                    ┌──────────────┐
                    │   REQUESTED  │ ← Passenger creates ride
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │      SEARCHING          │ ← Finding nearby drivers
              └────────────┬────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                  │
         ▼                 ▼                  ▼
  ┌──────────┐    ┌───────────────┐   ┌────────────┐
  │ ACCEPTED │    │ NO_DRIVERS    │   │  EXPIRED   │
  └────┬─────┘    └───────────────┘   └────────────┘
       │
       ▼
  ┌──────────────┐
  │ DRIVER_EN    │ ← Driver heading to pickup
  │ ROUTE        │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │   ARRIVED    │ ← Driver at pickup point
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  IN_PROGRESS │ ← Ride started
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  COMPLETED   │ ← Ride finished
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │    RATED     │ ← Passenger rated driver
  └──────────────┘

  (Cancellation possible from: REQUESTED, SEARCHING, ACCEPTED, DRIVER_EN_ROUTE, ARRIVED)
  ┌──────────────────────────┐
  │  CANCELLED_BY_PASSENGER  │
  │  CANCELLED_BY_DRIVER     │
  │  CANCELLED_BY_SYSTEM     │
  └──────────────────────────┘
```

### Key States
| State | Description |
|-------|-------------|
| `REQUESTED` | Passenger submitted ride request |
| `SEARCHING` | System broadcasting to nearby drivers |
| `ACCEPTED` | A driver accepted the ride |
| `DRIVER_EN_ROUTE` | Driver heading to pickup location |
| `ARRIVED` | Driver arrived at pickup point |
| `IN_PROGRESS` | Passenger picked up, ride underway |
| `COMPLETED` | Ride finished, awaiting rating |
| `RATED` | Passenger provided rating |
| `NO_DRIVERS` | No available drivers found |
| `EXPIRED` | Request timed out |
| `CANCELLED_*` | Cancelled by passenger/driver/system |

---

## Payment Model

KansRide uses a **subscription-based model** — no per-ride fare:

| Aspect | Detail |
|--------|--------|
| **Fee** | GHS 10 per day |
| **Who pays** | Drivers |
| **What it unlocks** | Unlimited ride requests for 24 hours |
| **No subscription** | Driver cannot receive ride requests |
| **Passengers** | Ride for free (no in-app payment) |
| **Revenue model** | Daily subscription × active drivers |
| **Payment methods** | Mobile Money (MTN MoMo, Vodafone Cash, AirtelTigo Money) |
| **Storage** | All monetary values stored as integers (pesewas, 1 GHS = 100 pesewas) |

---

## Real-time Architecture (Socket.IO)

### Connection Flow
```
Client connects → Authenticate (JWT in handshake) → Join rooms → Listen/Emit events
```

### Event Categories

| Event | Direction | Description |
|-------|-----------|-------------|
| `driver:location-update` | Driver → Server | GPS coordinates update |
| `ride:requested` | Server → Drivers | New ride available nearby |
| `ride:accepted` | Server → Passenger | Driver accepted ride |
| `ride:driver-location` | Server → Passenger | Driver's live location |
| `ride:status-changed` | Server → Both | Ride state transition |
| `ride:arrived` | Server → Passenger | Driver arrived at pickup |
| `ride:completed` | Server → Both | Ride finished |
| `driver:subscription-expired` | Server → Driver | Subscription ran out |

### Rooms
- `driver:{driverId}` — individual driver channel
- `passenger:{passengerId}` — individual passenger channel
- `ride:{rideId}` — ride-specific channel (driver + passenger + trackers)
- `admin` — admin broadcast channel

---

## Data Model (Key Tables)

```
┌──────────────────┐       ┌──────────────────┐
│      users       │       │     drivers      │
├──────────────────┤       ├──────────────────┤
│ id (uuid)        │       │ id (uuid)        │
│ phone            │◄──────│ user_id (FK)     │
│ name             │       │ license_number   │
│ role             │       │ vehicle_plate    │
│ avatar_url       │       │ vehicle_type     │
│ is_active        │       │ status           │
│ created_at       │       │ current_location │
│ updated_at       │       │ rating_avg       │
└──────────────────┘       │ is_verified      │
                           └────────┬─────────┘
                                    │
┌──────────────────┐                │
│      rides       │                │
├──────────────────┤                │
│ id (uuid)        │                │
│ passenger_id(FK) │                │
│ driver_id (FK)───┼────────────────┘
│ status           │
│ pickup_location  │ (PostGIS POINT)
│ dropoff_location │ (PostGIS POINT)
│ pickup_address   │
│ dropoff_address  │
│ started_at       │
│ completed_at     │
│ distance_meters  │
│ duration_seconds │
│ rating           │
│ created_at       │
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  subscriptions   │       │   otp_codes      │
├──────────────────┤       ├──────────────────┤
│ id (uuid)        │       │ id (uuid)        │
│ driver_id (FK)   │       │ phone            │
│ amount_pesewas   │       │ code             │
│ payment_method   │       │ expires_at       │
│ payment_ref      │       │ verified         │
│ starts_at        │       │ created_at       │
│ expires_at       │       └──────────────────┘
│ is_active        │
│ created_at       │
└──────────────────┘
```

---

## Key Design Decisions

### 1. Drizzle ORM over Prisma
- **Type safety**: Drizzle generates types from schema, no separate generation step
- **SQL-like API**: Closer to raw SQL, easier to optimize PostGIS queries
- **Bundle size**: Significantly smaller than Prisma client
- **Migration control**: SQL-based migrations, full control over DDL

### 2. Money as Integers (Pesewas)
- Avoids floating-point precision errors
- GHS 10.00 stored as `1000` pesewas
- All calculations done in integers; format only at display layer
- Consistent with payment processor APIs (which use smallest currency unit)

### 3. npm Workspaces (over Turborepo/Nx)
- Zero additional tooling — native npm feature
- Sufficient for current team size and build complexity
- No lock-in to third-party monorepo tools
- Simple dependency resolution via workspace protocol

### 4. PostGIS for Geospatial
- Native PostgreSQL extension — no additional service
- Efficient spatial indexing (GiST) for "nearest driver" queries
- Standard `ST_DWithin`, `ST_Distance` functions for radius search
- Stores coordinates as `POINT(lng, lat)` geometry

### 5. Subscription over Commission
- Simpler payment flow (one daily charge vs per-ride calculation)
- Drivers keep 100% of ride fares (cash collected)
- Predictable revenue for platform
- No need for complex fare estimation or splitting

### 6. Socket.IO over raw WebSocket
- Built-in reconnection and fallback (polling → WebSocket)
- Room/namespace support for targeted broadcasting
- Acknowledgements for reliable delivery
- Broad client support (React Native, web, Node.js)

### 7. Phone-only Authentication
- Target users may not have email accounts
- Phone numbers are universal in Ghana
- SMS OTP is familiar to the target demographic
- No password management complexity
