# YariZan V2 backend core

NestJS/TypeScript modular monolith, PostgreSQL 17, explicit SQL migrations through node-postgres. This backend is isolated development/review software. **Production startup deliberately fails** until physical ownership assurance, external signing-key custody and desktop credential provisioning are independently reviewed. No production-ready environment flag exists.

See [pre-implementation compatibility review](../docs/YARIZAN-PHASE-2-COMPATIBILITY.md), [implemented OpenAPI](../docs/YARIZAN-OPENAPI-BACKEND-V2.json), [engineering report](../docs/YARIZAN-PHASE-2-REPORT.md), and [enrollment decision](../docs/adr/0005-backend-enrollment-and-transaction-authority.md). Earlier design OpenAPI includes commerce endpoints that this service intentionally does not implement.

## Local development

Requirements: Node 24, .NET 9 for interoperability tests, Docker with Compose. Run from `backend/`. No Redis, broker, payment gateway or remote database is used. SMS defaults to disabled; explicit fake delivery is used for local tests. PostgreSQL binds only `127.0.0.1:55432`. The Compose database/password are disposable public development values.

Copy `.env.example` to ignored `.env`. Set three **different**, cryptographically random 32-byte hex secrets. Never reuse production material. Compose reads `.env`; Node commands can use Node's `--env-file=.env` option:

```sh
npm ci
npm run build
docker compose up -d db
node --env-file=.env dist/src/database/migrate.js
node --env-file=.env dist/src/database/seed.js
node --env-file=.env dist/src/main.js
```

Alternatively `docker compose --profile api up --build -d` builds and runs the whole local stack. Check `/health`, `/ready`, `/api/v2/products`. Readiness reports `production_gate: closed`; a successful readiness response is not commercial approval. The API port is loopback-only in Compose. No production host configuration is included.

Development signing keys are generated at runtime under ignored `.local/development-signing.pem` (or the local-only Compose key volume). They are never image layers or tracked fixtures. Tests use in-memory disposable keys. Public key IDs contain `disposable-development-`; commercial desktop root approval rejects these keys. Retain local keys with local data if restarting a development environment. Destroy only explicitly named disposable volumes after review; this guide does not perform deletion automatically.

## Pairing and sessions

No anonymous fingerprint registration exists. Email is not required; first ownership now requires verified mobile OTP.

1. Desktop creates a persisted per-profile CNG P-256 key and obtains a `PAIR` challenge from `/api/v2/devices/challenges` with fingerprint version 2, uppercase digest and base64url SPKI.
2. It signs `YariZan-Device-Challenge-V2\n` plus canonical `{challenge_id,nonce,fingerprint_version,fingerprint_digest,device_public_key}` and POSTs proof to `/device-pairings`. It displays the five-minute pairing ID/code. Neither code nor credentials enter a URL. Only the pending public UUID is stored locally.
3. Browser POSTs the code to `/device-pairings/:id/preview`, then `/auth/claim` with `pairing_id`, `pairing_secret`, and a pairing-scoped mobile OTP for first ownership (password optional). An additional Windows profile instead requires the current owner's session and CSRF. `/device-pairings/:id/confirm` is the same browser approval. The result contains **only status, username and expiry**.
4. Desktop obtains a fresh `CONFIRM` challenge bound to `pairing_id` and POSTs its key proof to `/device-pairings/:id/pickup`. Pending returns status only. Approved returns the signed enrollment and 15-minute credential exclusively to the proof-capable desktop. Retry uses a new challenge, reuses the certificate and rotates the bearer.
5. Desktop verifies the unchanged ADR-0004 certificate, key digest, fingerprint and machine UUID before DPAPI persistence. `/devices/authenticate` with fresh `AUTH` proof recovers the current certificate and renews the bearer after restart. Renewal never gates an active trial or offline paid launch.
6. `/devices/register` and `/device-pairings/:id/desktop-confirm` are retired with HTTP 410. Migration 007 invalidates old pending pairings; there is one active provisioning protocol.

The development-only `NODE_ENV=development SMS_PROVIDER=fake node --env-file=.env tools/pairing-harness.mjs` (with the explicit encrypted fake spool and independent keys; HARNESS_PASSWORD is optional) exercises the split with synthetic loopback identity and prints only the public username. It is not physical ownership evidence. See [ADR-0006](../docs/adr/0006-web-and-desktop-provisioning.md) and [web development guide](../apps/web/README.md).

Username/password login uses `/auth/login`. Session responses provide `csrf_token`; session cookies are HttpOnly, SameSite Strict, path `/api/v2`. Development HTTP cookies are deliberately non-Secure; production startup is blocked. Every authenticated browser mutation requires exact configured Origin and `X-CSRF-Token`. Admin reads also require CSRF/recent authentication. No permissive CORS or trusted forwarding headers are enabled. `/auth/session/rotate` replaces a session; `/auth/logout` revokes it.

## Desktop access

The five desktop routes and JSON are unchanged from ADR-0004. `GET /desktop/trials/:sku/status` consumes nothing. `POST /desktop/trials/:sku/start` locks the machine and counter, checks account generation and durable SKU ban, then returns or stores one exact nonce-bound signed response. Different profiles share the same budget. Two distinct starts succeed; the third returns HTTP 403 `TRIAL_EXHAUSTED`. Same nonce with changed process UUID returns 409 `IDEMPOTENCY_MISMATCH`.

No heartbeat, game authorization, trial deadline or online lease exists. Once the desktop verifies a start, the process can continue offline indefinitely. Perpetual paid artifacts have `expires_at:null`. Pickup returns the existing entitlement/license independently of subsequent sales shutdown. Sync returns only signed ACTIVE/REVOKED decisions with monotonic revisions. Network errors never become signed revocation.

Manual codes contain 160 random bits. The backend stores only a versioned domain-separated HMAC verifier. Codes are device/customer/generation/SKU-scoped and expire. Redemption atomically consumes once, issues a license, records audit/outbox and preserves exact retry result. A revoked current-generation license requires explicit same-ID recovery; codes cannot replace it. Issuance and reset grants are displayed once; Admin idempotent retries return only `secret_already_delivered`, not the secret. Cancel/reissue after lost delivery. Version `v1` verifier-key retention is mandatory for outstanding codes; a multi-key production rotation adapter remains a go-live dependency.

## Admin and independent ownership review

Seed creates roles/permissions, **no Admin account or known password**. For local development only, set temporary ADMIN_USERNAME, ADMIN_PASSWORD (at least 16 characters), independently verified ADMIN_MOBILE, NODE_ENV and all required independent keys/provider settings; run `node tools/provision-admin.mjs`. It emits only creation status, never a TOTP secret. Remove temporary credentials afterward. Production provisioning remains unavailable.

Admin login is now two-step SMS MFA: `/admin/auth/login` checks username/password and returns a challenge receipt; `/admin/auth/sms/verify` creates the session only after a valid, unused OTP. Old TOTP login is retired; migration 008 revokes old Admin sessions and requires explicit SMS session provenance. Existing Admins need an independently verified mobile enrollment. Development bootstrap requires ADMIN_MOBILE and MOBILE_ENCRYPTION_KEY and emits no TOTP secret.

Sensitive requests still require a session established within five minutes, scoped RBAC, CSRF, request ID, reason and expected revision. Notes additionally require notes.manage plus the entity read permission. Passwords/OTPs/vendor secrets and full phone values are excluded from listings/logs. See [Auth and SMS contracts](../docs/YARIZAN-AUTH-AND-SMS-CONTRACTS.md) for complete OTP/session/rate/delivery rules.

Ownership-sensitive operations require an `evidence_ref` to independent support verification. This is an auditable **human verification assertion**, not automatic validation of purchase documents. Staff must not approve evidence based on username/fingerprint alone. Production support policies, external evidence system and dispute escalation remain gates.

Reset preserves the device anchor, username, durable bans, consumed-code history, signed license decisions, audit and commerce history. It tombstones the old customer, clears operational password and mobile data, revokes sessions/profile credentials, cancels unused codes, and advances generation once. New approved enrollment receives a fresh generation budget. A trial-only Admin reset advances the selected product allocation epoch and replenishes two entries in the existing generation. Historical grants remain immutable. A retired nonce returns HTTP 409 `TRIAL_ALLOCATION_CHANGED` without spending a new entry; it cannot return an old grant. Identical retries return the original result only within their allocation epoch. Admin request retries advance the epoch once. Other grades and profile enrollment remain unchanged.

Block affects one SKU, all profiles and future customer generations; it signs revocations for affected licenses. Unblock recreates neither entitlements nor trials. Same-ID recovery requires evidence and a newer ACTIVE decision, preserving trial history. **Arbitrary cross-ID replacement and old desktop snapshot migration remain blocked.** Reset cannot instantly invalidate a permanently offline license. Old proof-capable profiles have a narrow signed-tombstone sync path; they cannot retrieve new-account access.

## Database and operational boundaries

Migrations `001`–`007` run in lexical order inside a transaction protected by a PostgreSQL advisory lock. Hashes normalize CRLF to LF. Applied-file changes or ordering drift fail. Explicit SQL supports CHECKs, partial UNIQUE indexes, restrictive FKs, price-range exclusion, immutable-history triggers, and row locks without an ORM shadow schema.

Transactions lock machine before product restriction/counter/code/license. Reset/block/issue/trial/code operations serialize on that machine. Signing or SQL failure rolls back consumption and entitlement creation. Unique business keys remain final protection. Outbox rows commit with business changes; `Outbox.dispatch` uses `FOR UPDATE SKIP LOCKED`. Consumers must deduplicate event IDs because delivery is at least once. No external outbox consumer or broker is enabled. SMS has a separate bounded provider dispatch after admission, described below.

Use a separate migration owner and runtime login in a future reviewed deployment. `tools/runtime-role.sql` defines a NOLOGIN group with no schema/migration/history mutation rights; provision a login outside source. Local Compose deliberately uses a disposable owner for migration/testing. Triggers do not protect against a malicious DB superuser. Retention/pseudonymization rules need legal/operator approval; no automatic financial/audit deletion exists. Expired challenges/sessions/rate buckets can later be removed through a reviewed maintenance job.

Before schema changes: snapshot a disposable test database, apply migrations and compare a fresh schema. After real issuance or money, prefer safe roll-forward; do not restore an old database without reconciling later entitlements, revocations, codes and payments. No destructive down migration or live MySQL import is provided. PostgreSQL native backups, restore drills and production capacity planning remain deployment work. No legacy PHP/MySQL, DNS, Traefik or payment infrastructure is touched.

## Tests

`npm test` refuses any database name except `yarizan_phase2_test` and rebuilds only that disposable schema. Set `DATABASE_URL` to the loopback test database on your Compose port; the suite creates it using the local PostgreSQL operator. CI uses an isolated PostgreSQL 17 service on port 5432. Unit/API/concurrency tests generate synthetic secrets if not supplied; migration tools require configured values.

```sh
npm run build
npm run lint
npm run format:check
npm test
node tools/check-schema.mjs
npm run check:contracts
npm run check:secrets
npm audit --audit-level=high
npx --yes @redocly/cli@2.63.0 lint ../docs/YARIZAN-OPENAPI-BACKEND-V2.json
```

`check-schema` requires the test URL and temporarily creates only `yarizan_phase2_schema_reference`. It compares column, index, constraint, trigger and function catalogs with fresh migrations. Never use a production URL. The test configuration refuses non-local database hosts.

The C# interoperability project compiles the unchanged production verifier, DesktopV2Client and DesktopAccessController. Only local identity/storage adapters and test-only loopback transport mapping replace platform/host boundaries. PostgreSQL/API authority is real. Physical Windows account/TPM/reboot/endurance acceptance remains separate. Existing Windows suites remain in their own CI job. Backend CI has no deployment job.

## Independent review hardening

Executable startup requires an explicit, exact `NODE_ENV=development|test|production`. Missing/empty values fail with `NODE_ENV_REQUIRED`; unsupported values fail with `NODE_ENV_INVALID`. The Docker image has no environment default. Compose explicitly selects development and CI selects test. Production still fails with `PRODUCTION_GATE_CLOSED`, regardless of any readiness flag. Migration and seed entrypoints enforce the same configuration before database access. No production configuration or signing material is provided.

Browser claim/confirm share the exact Origin and bounded IP/pairing hashing budgets. Pairing status, expiry, code, generation and owner are checked before Argon2id, without row locks across hashing. Final commit rechecks all conditions and the authorizing session under transaction locks. Retired registration routes cannot bypass this protocol. Browser receipt and desktop-controlled pickup are now implemented for isolated review; commercial startup remains blocked by physical ownership assurance and signing custody.

To test the built Docker image with only disposable data, explicitly set the three synthetic secrets, `DATABASE_URL`, and (on Docker Desktop) `RUNTIME_DOCKER_NETWORK=yarizan-v2-local_default` plus `RUNTIME_DATABASE_URL=postgresql://yarizan:local-disposable@db:5432/yarizan_phase2_test`. Run `node tools/check-runtime-env.mjs yarizan-backend-fixture`. The checker verifies missing, empty, invalid, development, test and production startup; non-root execution; native Argon2; no image key; readiness; signing persistence mode; and graceful shutdown. It removes only its uniquely named disposable containers.

## Phase 3.1 authentication and notes

First browser claim requires mobile OTP and does not require an initial password. Customer login supports password or username/mobile OTP. Account security supports optional password setting, changes and two-number mobile verification; credential changes revoke sessions. Self-service mobile reset is primary; independently verified support grants remain the fallback for lost numbers/migrated accounts.

SMS_PROVIDER defaults to disabled and fails OTP issuance closed. Explicit fake mode is local/test only. MeliPayamak selection requires credentials, approved one-variable body ID, independent MOBILE_ENCRYPTION_KEY/OTP_HMAC_KEY and SMS_ALLOW_LIVE=true; no live sends were executed. The provider has a fixed verified-TLS pattern endpoint, bounded timeout/body, no redirect or ambiguous retry. Do not place real credentials in Compose examples or CI.

For manual local review, set SMS_PROVIDER=fake, two independent synthetic keys and SMS_FAKE_OUTBOX=.local/local-sms-outbox.jsonl in ignored .env. Rebuild/start the local Compose stack. After a UI request, `docker compose exec api node dist/src/accounts/read-fake-sms.js` explicitly inspects only an unused/unexpired encrypted fake delivery. No browser OTP mailbox exists. The equivalent host command is `node --env-file=.env dist/src/accounts/read-fake-sms.js`. Synthetic code output is an explicit operator action, never application logging or production delivery.

Migration 008 adds phone encryption/lookup, purpose-bound OTP records, SMS session provenance, new-account mobile constraints and revisioned notes with actual parent FKs/trigram indexes. It preserves old password accounts for verified phone attachment. Do not roll back to password-first/TOTP runtime after applying it; use reviewed roll-forward. No real customer data or production schema was changed. See [Phase 3.1 report](../docs/YARIZAN-PHASE-3-1-REPORT.md).


## Phase 4 synthetic commerce

Commerce is disabled by default. In isolated local configuration set COMMERCE_MODE=fake to enable the explicitly labeled simulator; no merchant credentials or network gateway are used. Compose forwards this explicit setting. PURCHASE_SMS_TEMPLATE is a safe notification template identifier; the durable purchase event is recorded only, not delivered. Real provider selection refuses startup; production remains blocked.

Customer routes now include /checkout?sku=YARIZAN-G1, /payment/simulate, /payment/result, /account/orders and /account/orders/:id. Admin /zanyari/commerce uses actual permission-protected commerce/finance APIs. Orders replace the previous unavailable placeholder. Checkout first creates an authoritative snapshot, then the detail view offers an explicit simulated payment action. No card data is collected. See docs/YARIZAN-COMMERCE-CONTRACTS.md and docs/YARIZAN-PHASE-4-REPORT.md from the repository root for exact API/state/evidence.

Use the existing disposable PostgreSQL and fake SMS setup. Backend build/test exercises commerce, 20-way coupon concurrency and real .NET verification. Browser test:e2e includes synthetic checkout and Admin flows. Stop Compose api/web before Playwright: its managed servers require ports 3100/3200. Never replace fake mode with a live merchant for these checks.
