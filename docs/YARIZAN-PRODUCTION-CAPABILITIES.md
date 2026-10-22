# Production capabilities

The Backend no longer treats production as one indivisible launch. It serves six independently
reviewed capabilities. Each one is enforced on every route (a global Nest guard) and in the
sensitive services themselves (SMS, signing, payment gateway), so a disabled capability is refused
explicitly with `503 CAPABILITY_DISABLED` and never falls back to fake or test behaviour.

| Capability | Approved in source | Gates it needs | What it serves |
| --- | --- | --- | --- |
| `PRODUCTION_CORE` | yes | `G8_SECRET_CUSTODY` | `/health`, `/ready`, public catalog, `GET commerce/capabilities` |
| `CUSTOMER_AUTH` | no | `G5_TRUSTED_RATE_LIMITS`, `G1_FIRST_CLAIM_ASSURANCE` | customer login, OTP, sessions, account pages |
| `ADMIN_AUTH` | no | `G5_TRUSTED_RATE_LIMITS`, `G6_ADMIN_SMS_MFA` | Admin password + SMS MFA and the Admin console |
| `DESKTOP_PROVISIONING` | no | `G4_DESKTOP_CREDENTIALS`, `G5_TRUSTED_RATE_LIMITS` | device challenges, pairing, desktop credentials |
| `TRIALS_AND_LICENSES` | no | `G1_SIGNING_CUSTODY` | trials, license issue, pickup, sync, activation codes |
| `LIVE_COMMERCE` | no | (owner real-money go/no-go) | quotes, orders, payments, refunds, reconciliation |

## Rules

- A capability serves production traffic only when it is approved in `backend/src/config.ts`, every
  gate it depends on is open in source, the operator lists it in `ENABLED_CAPABILITIES`, and its
  runtime prerequisites validate. No environment variable can approve a capability or open a gate.
- Production requires `ENABLED_CAPABILITIES` and it must include `PRODUCTION_CORE`. An unknown or
  unapproved entry, or one whose gate is closed, refuses startup.
- While a gate of `PRODUCTION_CORE` is closed (today: `G8_SECRET_CUSTODY`), production startup is
  refused whatever is listed.
- Production additionally refuses: fake or sandbox commerce, any commerce mode without
  `LIVE_COMMERCE`, the fake SMS provider and fixture outbox, a live SMS provider without
  `CUSTOMER_AUTH` or `ADMIN_AUTH`, a license-signing key without `TRIALS_AND_LICENSES`, a non-HTTPS or
  loopback browser origin, a database login other than a dedicated runtime login on the internal
  `db` host, and any low-entropy or patterned key.
- With neither `TRIALS_AND_LICENSES` nor `DESKTOP_PROVISIONING` enabled, no signing key is loaded or
  generated; every signing attempt is refused.
- A route that declares no capability is refused (`CAPABILITY_UNDECLARED`); a test inspects every
  controller route.
- Development and test enable every capability unless `ENABLED_CAPABILITIES` narrows them.

## Web

`GET /api/v2/commerce/capabilities` reports `enabled_capabilities`. The full Nuxt site reads it on the
server (30-second cache, fail closed to none) and:

- answers `503` for `/account`, `/login`, `/reset-password`, `/support-reset` without `CUSTOMER_AUTH`,
  `/connect` without `CUSTOMER_AUTH` and `DESKTOP_PROVISIONING`, `/checkout` and `/payment` without
  `CUSTOMER_AUTH` and `LIVE_COMMERCE`, and `/zanyari` without `ADMIN_AUTH`;
- hides the matching navigation entries, and shows the live Backend catalog with the storefront copy
  while customer accounts are disabled.

## Opening a capability

Each capability is opened by its own reviewed change that records its evidence: open its gates,
set `approved: true`, add tests, and list it in the server's `ENABLED_CAPABILITIES`. `G8_SECRET_CUSTODY`
is opened only after production secrets are generated on the server with recorded offline custody
and an isolated restore drill has succeeded.
