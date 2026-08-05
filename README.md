# KansRide

**Tricycle ride-hailing platform for Sekondi-Takoradi, Ghana.**

KansRide connects passengers with tricycle (Pragya/Aboboyaa) drivers through a subscription-based model. Drivers pay a flat GHS 10 daily fee for unlimited ride requests — no per-ride commission.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | NestJS (REST + WebSocket) |
| Mobile Apps | React Native / Expo |
| Admin Dashboard | Next.js 15 |
| Tracking Page | Next.js 15 |
| Database | PostgreSQL 16 + PostGIS |
| Cache / Pub-Sub | Redis 7 |
| ORM | Drizzle ORM |
| Real-time | Socket.IO |
| Auth | Phone OTP → JWT (access + refresh) |
| Language | TypeScript 5.6+ |

---

## Project Structure

```
kansride/
├── .github/workflows/     # CI/CD pipelines
├── apps/
│   ├── backend/           # NestJS API server (port 3000)
│   ├── mobile-passenger/  # Expo passenger app
│   ├── mobile-driver/     # Expo driver app
│   ├── admin-web/         # Next.js admin dashboard (port 3001)
│   └── tracking-web/      # Next.js live tracking page (port 3002)
├── packages/
│   ├── shared-types/      # @kansride/types — shared TypeScript types
│   ├── shared-config/     # @kansride/config — shared configuration
│   ├── shared-db/         # @kansride/db — Drizzle schema + migrations
│   ├── shared-auth/       # @kansride/auth — JWT, OTP, RBAC utilities
│   └── design-system/     # @kansride/ui — shared React Native components
├── docs/                  # Architecture & setup documentation
├── .env.example           # Environment variable template
├── package.json           # Root workspace config
└── tsconfig.base.json     # Shared TypeScript config
```

---

## Prerequisites

- **Node.js** >= 24.x (see `.nvmrc`)
- **npm** >= 11.x
- **PostgreSQL** 16 with PostGIS extension
- **Redis** 7+
- **Expo CLI** (for mobile development)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/kansride.git
cd kansride

# 2. Install all dependencies (workspaces resolved automatically)
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start PostgreSQL and Redis
# (ensure services are running on default ports)

# 5. Run database migrations
npm run db:migrate --workspace=packages/shared-db

# 6. Start the backend
npm run dev --workspace=apps/backend

# 7. Start the admin dashboard (separate terminal)
npm run dev --workspace=apps/admin-web

# 8. Start a mobile app (separate terminal)
npm run start --workspace=apps/mobile-passenger
```

---

## Available Scripts (Root)

| Script | Description |
|--------|-------------|
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run type-check` | TypeScript type-check (no emit) |
| `npm run clean` | Clean build artifacts in all workspaces |
| `npm run test` | Run unit and invariant tests |
| `npm run test:integration` | Run the Postgres/Redis-backed ride journey; fails if services are unavailable |
| `npm run doctor` | Report database, Redis, provider, CORS, and configuration readiness |
| `npm run seed:demo` | Idempotently seed development demo accounts; refuses production |
| `npm run dev:all` | Start backend, admin-web, and tracking-web together |
| `npm run verify:v1` | Run the complete non-destructive V1 verification gate |

---

## Starting Individual Apps

```bash
# Backend API (port 3000)
npm run dev --workspace=apps/backend

# Admin Dashboard (port 3001)
npm run dev --workspace=apps/admin-web

# Tracking Web (port 3002)
npm run dev --workspace=apps/tracking-web

# Passenger Mobile App
npm run start --workspace=apps/mobile-passenger

# Driver Mobile App
npm run start --workspace=apps/mobile-driver
```

---

## Development Workflow

1. **Create a feature branch** from `develop`:
   ```bash
   git checkout -b feat/my-feature develop
   ```

2. **Build shared packages first** (if you changed them):
   ```bash
   npm run build --workspace=packages/shared-types
   npm run build --workspace=packages/shared-db
   ```

3. **Run lint + type-check** before committing:
   ```bash
   npm run lint
   npm run type-check
   ```

4. **Open a PR** targeting `develop`. CI will run lint, type-check, and builds automatically.

5. **Merge to `main`** for production releases.

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | Secret for access token signing |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing |
| `SMS_PROVIDER` | SMS gateway (`mock` for development) |
| `MAPS_PROVIDER` | Maps service (default: `openstreetmap`) |

The backend and migration commands load the ignored repository-root `.env`.
Replace every `change-me` placeholder locally before starting services; never
commit that file.

### Demo and recovery

After PostgreSQL migrations succeed, run `npm run seed:demo` in development or
test mode. It provisions these documented identities without passwords:

- Passenger: `+233200000001`
- Approved driver: `+233200000002`
- Admin: `+233200000003`

Use `npm run doctor` before runtime tests. Use `npm run verify:v1` for the full
non-destructive local gate; the integration portion requires reachable PostGIS
and Redis services. Back up PostgreSQL with `pg_dump` before operational work.
For local-only reset, create a new empty development database and rerun
migrations; never run a destructive reset against production and no production
reset command is provided by this repository.

### Android development builds

The apps keep distinct identifiers: `com.kansride.passenger` and
`com.kansride.driver`. For a simulator, use `npm run start --workspace=apps/mobile-passenger`
or the driver equivalent. For a physical device, set
`EXPO_PUBLIC_DEVICE_MODE=physical` and reachable LAN/HTTPS values for
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`, and passenger
`EXPO_PUBLIC_TRACKING_URL`; localhost is rejected in that mode. Development
build commands are documented in `docs/operations/V1_ANDROID_DEVICE_GUIDE.md`.
Controlled-pilot deployment, backup, rollback, and incident procedures are in
`docs/operations/CONTROLLED_PILOT_RUNBOOK.md`; the field test matrix is in
`docs/operations/V1_PHYSICAL_DEVICE_TEST_PACKAGE.md`.

---

## License

MIT
