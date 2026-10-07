# Mobile PIN login and manual driver approval

Passenger and Driver registration/sign-in no longer use SMS OTP. Passenger
registration collects name, Ghana phone number and a four-digit PIN. Driver
applications collect the existing identity, vehicle, photograph and emergency
details plus phone/PIN, and create an inactive `driver_applicant` account.

An authorized operations administrator must review and approve the application
through the existing admin Drivers workflow. Until then, PIN login and going
online are rejected. Approval activates the driver profile and changes the user
role to `driver`; it does not charge a subscription or change free-launch policy.

PINs remain salted/hashed. Login attempts are limited per normalized phone
number and per IP. Public registration cannot overwrite an existing number,
PIN, role, verification status or account. Without OTP, phone-number ownership
is **not** automatically proven. Incorrect/contested numbers and forgotten PINs
require manual support; there is no public PIN-reset/account-reclaim bypass.
Existing accounts without a PIN require controlled credential provisioning by
operations. No existing PIN is changed by this migration.

## One active login

Migration `0008_single_login_session.sql` adds `users.active_session_id` without
changing existing accounts or trips. Every successful login rotates this UUID;
access and refresh tokens carry it. Protected HTTP routes, token refresh and
authenticated ride sockets check it against PostgreSQL. Old refresh tokens
cannot revive a replaced session. Stale logout cannot invalidate a newer login.

Connected old sockets are disconnected on takeover. Mobile apps also recheck
on foreground/resume and while active, including when no ride socket is open.
An offline/background phone cannot receive an immediate notification, but its
old session cannot use protected APIs when it reconnects. This enforces one
active login, not hardware attestation or protection against copying a token.
Temporary network/database failures are not treated as credential revocation.

Existing provisioned **staff** OTP access is retained so the mobile change does
not remove the existing admin sign-in method. OTP endpoints cannot create,
verify, reclaim or reset Passenger/Driver accounts. Staff still need working
staff credentials/SMS delivery or an already provisioned PIN.

## Deployment and builds

Deploy the matching backend and append-only migration before using the new
APKs. Legacy session-less tokens will require a fresh PIN login. Preserve Neon
data, Redis credentials, JWT secrets and the release branch.

APK builds use the live pilot HTTPS API, production JavaScript and review mode
disabled. Local release APKs retain the repository's existing internal/debug
signing configuration; they are not Play Store production-signed releases.
Physical-device launch/keyboard/two-phone takeover testing is still required.

Runtime tests use a separate local PostGIS cluster and unique Redis key prefixes;
they never insert test accounts or trips into the production Neon database.
