# KansRide Controlled Pilot Runbook

## Scope and gates

This runbook covers staging and controlled-pilot operations. It does not claim a deployment, provider activation, CI success, physical-device test, or production backup until an owner records actual evidence.

Required gates before pilot:

- PostgreSQL 16 with PostGIS and Redis 7 reachable from the backend.
- HTTPS API/admin/tracking URLs and restrictive `WEB_CORS_ORIGINS`.
- Non-default production JWT secrets supplied through a secret manager.
- Approved SMS, payment, and maps provider decisions and credentials.
- First admin and pilot drivers provisioned through controlled operations.
- Android two-phone test matrix completed by the owner.

## Staging environment contract

Required backend variables:

- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...`
- `REDIS_URL=redis://...`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `APP_PORT`
- `WEB_CORS_ORIGINS=https://admin.example,https://tracking.example`
- `SMS_PROVIDER` and provider credentials when using a live SMS adapter
- `PAYMENT_PROVIDER` and approved adapter credentials
- `MAPS_PROVIDER` and approved adapter credentials

Required web variables:

- Admin: `NEXT_PUBLIC_API_URL=https://api.example/api/v1`
- Tracking: `NEXT_PUBLIC_API_URL=https://api.example/api/v1`, `NEXT_PUBLIC_SOCKET_URL=https://api.example`
- Tracking map: `NEXT_PUBLIC_TRACKING_TILE_URL`, `NEXT_PUBLIC_TRACKING_TILE_ATTRIBUTION`

Required mobile variables for physical devices:

- `EXPO_PUBLIC_DEVICE_MODE=physical`
- reachable HTTPS or approved LAN values for API, WebSocket, and tracking URLs
- Android map-key injection only through the deployment/build secret mechanism; never commit the key

## Deployment sequence

1. Provision an isolated staging database and Redis instance.
2. Validate environment variables with `npm run doctor`.
3. Build the release commit with `npm run build`.
4. Apply append-only migrations with `npm run db:migrate --workspace=packages/shared-db`.
5. Run `npm run seed:demo` only when `NODE_ENV` is development/test; never seed production.
6. Start the backend with `npm run start:prod --workspace=apps/backend` after shared packages are built.
7. Start admin/tracking with their production `start` commands and configured HTTPS URLs.
8. Verify health/readiness, authenticated admin access, OTP flow, and a controlled ride.
9. Promote only after owner approval and recorded evidence.

## Startup, shutdown, and readiness

- Startup: validate configuration, verify database/Redis reachability, apply migrations before serving traffic, then start the backend.
- Shutdown: stop accepting traffic, allow active requests to finish, close Redis and PostgreSQL pools, then stop the process.
- Health: `/api/v1/health` confirms the HTTP process is alive.
- Readiness: `npm run doctor` must pass database/PostGIS, Redis, provider, CORS, and production-safety checks before pilot traffic.
- A healthy HTTP process with an unavailable database or Redis is not pilot-ready.

## Observability and safe logging

- Keep structured request logs with method, route, status, duration, and a correlation/request ID supplied by the deployment proxy where available.
- Never log access/refresh tokens, passwords, OTP values, verification PINs, payment secrets, full phone numbers, or public tracking tokens.
- Log provider failures with provider name, operation, status class, and correlation ID—not credentials or request bodies.
- Monitor process restarts, 5xx rate, authentication failures, database pool errors, Redis errors, dispatch offer expiry, and tracking-token failures.
- Preserve the existing exception filter’s generic external error response; detailed diagnostics stay server-side and privacy-safe.
- Add a vendor-neutral log/metrics export at the deployment boundary rather than requiring a paid monitoring vendor.

## Backup, restore, and rollback

### PostgreSQL

Before migrations or a pilot release, run a non-destructive logical backup against the intended staging database:

```powershell
pg_dump --format=custom --file=kansride-staging-YYYYMMDD.dump "$env:DATABASE_URL"
```

Restore only into a new empty development/staging database:

```powershell
createdb kansride_restore_check
pg_restore --dbname="$env:RESTORE_DATABASE_URL" --exit-on-error kansride-staging-YYYYMMDD.dump
```

Record the actual backup path, database target, migration level, exit code, and restore verification. Do not run restore or reset against production without explicit owner approval.

### Redis

Redis contains dispatch offers, driver geo availability, and tracking capabilities. It is operational state, not the system of record. Use Redis persistence/managed snapshots according to the deployment service. After Redis loss, expect pending offers and public tracking grants to be lost or require reconciliation; PostgreSQL ride state remains authoritative.

### Application rollback

- Roll back the application image/release to the previous immutable commit.
- Do not roll back database migrations by editing or deleting migration history.
- Every migration must remain forward-compatible with the previous application during rollout.
- If a migration is incompatible, stop promotion and restore the database only into a separate recovery environment for investigation.
- Re-run health/readiness and a controlled ride before reopening traffic.

## Provider activation checklist

- SMS: choose Hubtel or another approved provider; configure `SMS_PROVIDER`, API secret, sender ID, timeout and failure monitoring. Verify OTP delivery and failure reporting.
- Mobile Money: choose a provider through owner decision D2; implement/approve the adapter behind `IPaymentProvider`, configure credentials, callback/verification URL, signature validation, timeout, retry and provider-reference idempotency. Do not activate `mock` in production.
- Maps: choose an approved maps/routing provider; configure the adapter and API key/quota restrictions. Current Haversine mode is deterministic development behavior, not a production routing SLA.
- WhatsApp/USSD: no current V1 interface exists; do not claim activation until the owner approves a contract and provider.

## Incident checklist

1. Declare the incident and record UTC start time.
2. Confirm whether the failure is API, database, Redis, provider, network, or device-specific.
3. Preserve logs and correlation IDs without copying secrets or private payloads.
4. Stop new pilot rides if authorization, fare, location, or payment correctness is uncertain.
5. Keep PostgreSQL ride state authoritative; do not reset or manually delete production data.
6. Notify the owner and record affected ride references using non-sensitive IDs only.
7. Restore service through the documented rollback/restart path.
8. Re-run readiness and one controlled ride before resuming pilot traffic.
9. Record root cause, evidence, owner action, and follow-up commit.

## Physical-device handoff

Use `docs/operations/V1_ANDROID_DEVICE_GUIDE.md`. The owner must record for each phone: app build/profile, package ID, backend URL, permission result, GPS result, network interruption result, restart result, ride reference, and failure evidence. No local session claims physical-device success.
