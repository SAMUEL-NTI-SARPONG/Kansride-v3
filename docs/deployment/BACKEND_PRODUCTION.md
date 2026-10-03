# KansRide backend deployment

This deploys the existing backend and preserves its data. Do not create duplicate
Render/Neon/Upstash projects or reset a database to resolve migration errors.
The existing service is `kansride-pilot-api` on Render. `render.yaml` documents its
intended settings; it does not prove those settings have been applied remotely.

## Service configuration

- Repository root is the build root (npm workspaces require it).
- Build: `npm ci --include=dev && npm run build --workspace=@kansride/backend`.
- Start: `npm run db:migrate --workspace=@kansride/db && npm run start:prod --workspace=@kansride/backend`.
- Health path: `/api/v1/health/ready`. `/api/v1/health` is liveness only.
- Let Render supply `PORT`; do not override it with an unnecessary `APP_PORT`.
- Deploy a reviewed, tested source revision. Never deploy the local dirty tree by accident.
- Keep one backend instance: socket rooms and dispatch scheduling are process-local.

## Server-only secrets

Set these in Render's secret environment configuration, never in client builds,
Git, screenshots, or logs:

| Variable | Source / requirement |
| --- | --- |
| `DATABASE_URL` | Existing Neon database, TLS enabled; pooled URL permitted for application queries |
| `MIGRATION_DATABASE_URL` | Same database, direct non-pooler TLS URL for session migration locking |
| `REDIS_URL` | Existing Upstash Redis TCP/TLS URL (`rediss://`), not REST URL/token |
| `JWT_ACCESS_SECRET` | Independently generated random secret, at least 32 characters |
| `JWT_REFRESH_SECRET` | Different independently generated random secret, at least 32 characters |
| `TEXTBEE_API_KEY` | TextBee dashboard; backend only |

Set `NODE_ENV=production`, `PAYMENT_PROVIDER=disabled`, `SMS_PROVIDER=textbee`,
`MAPS_PROVIDER=openstreetmap`, `DRIVER_ACCESS_MODE=free_launch`, and
`WEB_CORS_ORIGINS` to the actual admin/tracking HTTP(S) origins, without paths.
Production rejects mock SMS/payment, absent Redis, weak/shared JWT secrets, and
wildcard/absent CORS. Driver approval remains mandatory during free launch.
PIN login also enforces a shared five-attempt/15-minute account limit, independent
of client IP, and fails closed when the Redis limiter is unavailable.

## Preserve data and apply migrations

1. Confirm the target database/project before using any connection string.
2. Confirm a recoverable Neon backup/restore point or isolated branch is available.
3. Inspect the existing schema, applied migration hashes, and conflicting active trips.
4. Test migrations and `npm run test:integration` on an isolated database and Redis
   instance, never against live customer data. Tests create and remove fixtures.
5. Run `npm run db:migrate --workspace=@kansride/db` on the approved target.
   Migration startup serializes deploys, refuses altered applied history and
   conflicting active passenger/driver rides, and executes append-only SQL transactionally.
   If it refuses, stop and investigate; do not delete records or rewrite history.
6. Run `npm run doctor` with the target configuration. It checks PostgreSQL,
   PostGIS, the actual Drizzle journal, and Redis.

No seed command is part of deployment. Do not enable production demo/review bypass.

## Runtime acceptance

- Confirm `/api/v1/health/ready` responds 200 with both dependency checks true.
- Confirm unauthenticated protected routes return 401 and unauthorized roles return 403.
- With controlled test accounts, verify SMS receipt, OTP registration, PIN login,
  passenger/driver profile identity, pending driver approval, and free-launch access.
- With two devices, verify online location, private offer, single-winner acceptance,
  pickup, passenger trip PIN, start, completion, cancellation, and app reopen/reconnect.
- Verify public tracking requires a token and expires/revokes appropriately.
- Record revision and actual results; an HTTP liveness response alone is not evidence
  that registration, matching, or trips work.

## Remaining operational limits

Render Free can sleep and is unsuitable for reliable live ride operations. An
always-on upgrade requires explicit cost approval. Free Neon/Upstash limits also
need monitoring. TextBee sends through an enabled online Android phone/SIM with
SMS permissions and an applicable carrier plan; API acceptance is not delivery.
Admin OTP settings can choose the sending device/SIM and pause sending, but a phone
label does not change the actual carrier number.

The current OpenStreetMap distance adapter uses straight-line Haversine estimates;
it is not road routing. Verified service-area boundaries and road-route/fare policy
must be settled before treating estimates as road-accurate across communities.
Do not silently invent geographic boundaries or claim offline map display is a
backend routing service.
