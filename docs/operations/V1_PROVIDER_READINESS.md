# KansRide V1 Provider Readiness

## Implemented and testable

- SMS: `mock` and Hubtel adapters exist. Mock mode logs a deterministic delivery result for development. Hubtel requires `HUBTEL_SMS_API_KEY` and `HUBTEL_SENDER_ID` in the deployment environment.
- Maps: `openstreetmap` selects the deterministic Haversine adapter used for fare/dispatch estimates. It intentionally does not return route polylines.
- Payments: `mock` returns deterministic successful references and supports verification. It is development-only and production configuration rejects it.

## Not live or claimed

- A production Mobile Money adapter is not implemented. `PAYMENT_PROVIDER=momo` is credential-gated but startup fails explicitly until an approved adapter is added behind `IPaymentProvider`.
- A Google maps adapter is not implemented. `MAPS_PROVIDER=google` fails explicitly rather than silently using Haversine.
- No WhatsApp or USSD interface exists in the current V1 architecture, so no adapter or live-service claim is made for either channel.

## Owner activation actions

1. Select and approve the production SMS provider and supply its deployment secret through the secret manager.
2. Select the Mobile Money provider, provide sandbox/production credentials, callback or verification contract, and assign an integration owner.
3. Select the production maps/routing provider and provide its key, quota, billing, and allowed-origin restrictions.
4. If WhatsApp or USSD is added to V1 scope, approve its interface and provider contract before implementation.
5. Run `npm run doctor` and `npm run verify:v1` in the target environment after services and credentials are provisioned.

No provider secrets belong in `.env.example`, chat, logs, or commits.
