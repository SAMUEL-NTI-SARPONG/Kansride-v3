# KansRide V1 Android Device Guide

## App identities

- Passenger: `com.kansride.passenger`
- Driver: `com.kansride.driver`
- Driver location policy: foreground-only in V1. Background permissions are not declared until a real background task is implemented.

## Prerequisites

- Node.js 24 and npm 11+
- Android Studio, Android SDK/platform tools, and a configured emulator or USB-debuggable Android phone
- PostgreSQL/PostGIS and Redis reachable by the backend
- Backend bound to a LAN-reachable interface/port when using a physical phone
- A root `.env` with local non-production credentials; never commit it

## Simulator development

```powershell
npm install
npm run db:migrate --workspace=packages/shared-db
npm run seed:demo
npm run dev:all
npm run start --workspace=apps/mobile-passenger
# In another terminal:
npm run start --workspace=apps/mobile-driver
```

## Physical-device development build

Replace `192.168.1.20` with the development computer's LAN address or use an approved HTTPS/tunnel endpoint:

```powershell
$env:EXPO_PUBLIC_DEVICE_MODE = "physical"
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:3000/api/v1"
$env:EXPO_PUBLIC_WS_URL = "http://192.168.1.20:3000"
$env:EXPO_PUBLIC_TRACKING_URL = "http://192.168.1.20:3002"

npm run start --workspace=apps/mobile-passenger -- --dev-client
# In another terminal:
npm run start --workspace=apps/mobile-driver -- --dev-client
```

If a native development build is required rather than Expo Go, use the Expo local Android build command after installing the Android toolchain:

```powershell
npx expo run:android --project-directory apps/mobile-passenger
npx expo run:android --project-directory apps/mobile-driver
```

The repository does not claim that either build was installed on a phone. The owner must confirm installation and perform the device matrix below.

## Required device matrix

- Grant foreground location permission.
- Deny permission once, then test the retry path; test permanently blocked permission through system Settings.
- Disable device location services and verify the explicit GPS error.
- Go online with a real GPS fix; verify no location is emitted before the first fix.
- Background and foreground the driver app; confirm the V1 foreground-only policy and stale/offline messaging.
- Kill and relaunch both apps; verify active-ride reconciliation and socket resubscription.
- Drop and restore network connectivity; verify reconnect banners, offer resubscription, and ride-state refresh.
- Request, accept, progress, complete, rate, and cancel a ride.
- Verify the passenger tracking link opens from the phone and no private identifiers, fare, PIN, contact data, or raw coordinate text are exposed.
- Confirm both package identifiers install side by side without replacing the other app.
