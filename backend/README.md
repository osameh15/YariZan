# YariZan V2 backend core

NestJS/TypeScript modular monolith, PostgreSQL 17, explicit SQL migrations through node-postgres. This backend is isolated development/review software. **Production startup deliberately fails** until physical ownership assurance, external signing-key custody and actual desktop credential provisioning are independently reviewed. No production-ready environment flag exists.

See [pre-implementation compatibility review](../docs/YARIZAN-PHASE-2-COMPATIBILITY.md), [implemented OpenAPI](../docs/YARIZAN-OPENAPI-BACKEND-V2.json), [engineering report](../docs/YARIZAN-PHASE-2-REPORT.md), and [enrollment decision](../docs/adr/0005-backend-enrollment-and-transaction-authority.md). Earlier design OpenAPI includes commerce endpoints that this service intentionally does not implement.

## Local development

Requirements: Node 24, .NET 9 for interoperability tests, Docker with Compose. Run from `backend/`. No Redis, broker, gateway, SMS or remote database is used. PostgreSQL binds only `127.0.0.1:55432`. The Compose database/password are disposable public development values.

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

No anonymous fingerprint registration exists. No email/SMS OTP is required.

1. Generate a per-profile P-256 key. POST `/api/v2/devices/challenges` with `fingerprint_version:2`, uppercase `fingerprint_digest`, base64url SPKI `device_public_key`, and `purpose:PAIR`.
2. Sign `YariZan-Device-Challenge-V2\n` plus canonical `{challenge_id,nonce,fingerprint_version,fingerprint_digest,device_public_key}`. POST `/device-pairings` with the four identity/proof fields and `challenge_id`, `challenge_signature`. The nonce belongs only to the transcript, not the proof DTO. Receive a high-entropy pairing secret and ID, valid five minutes.
3. Browser POST `/device-pairings/:id/confirm` with `pairing_secret`, correct Origin, and (for an additional profile) existing customer cookie and CSRF token. Receive a browser token. Additional profiles must have the existing machine fingerprint and owner authorization.
4. Desktop requests purpose `CONFIRM` challenge with `pairing_id`, then signs the same domain transcript and POSTs proof to `/device-pairings/:id/desktop-confirm`. Receive one-time claim grant.
5. POST `/auth/claim` (or explicit paired `/devices/register`) with pairing ID, browser token and claim grant. A first claim additionally supplies the chosen password (12–128 characters). Atomic uniqueness creates one active customer/machine generation. Additional profiles reuse the existing customer, machine UUID, entitlement and trial budget. The result contains the exact signed enrollment and short-lived enrolled bearer; this development protocol still requires reviewed production desktop/browser delivery integration.
6. Renew a bearer through purpose `AUTH` challenge and POST `/devices/authenticate`. Bearers last 15 minutes. Renewal is needed only for later online operations, never active trial gameplay or paid offline startup.

The development-only `NODE_ENV=development HARNESS_PASSWORD=... node tools/pairing-harness.mjs` exercises steps 1–5 with a synthetic key/fingerprint against loopback. On PowerShell, set environment variables before running it. It prints only a public username. It is **not** a production UI or evidence of physical ownership.

Username/password login uses `/auth/login`. Session responses provide `csrf_token`; session cookies are HttpOnly, SameSite Strict, path `/api/v2`. Development HTTP cookies are deliberately non-Secure; production startup is blocked. Every authenticated browser mutation requires exact configured Origin and `X-CSRF-Token`. Admin reads also require CSRF/recent authentication. No permissive CORS or trusted forwarding headers are enabled. `/auth/session/rotate` replaces a session; `/auth/logout` revokes it.

## Desktop access

The five desktop routes and JSON are unchanged from ADR-0004. `GET /desktop/trials/:sku/status` consumes nothing. `POST /desktop/trials/:sku/start` locks the machine and counter, checks account generation and durable SKU ban, then returns or stores one exact nonce-bound signed response. Different profiles share the same budget. Two distinct starts succeed; the third returns HTTP 403 `TRIAL_EXHAUSTED`. Same nonce with changed process UUID returns 409 `IDEMPOTENCY_MISMATCH`.

No heartbeat, game authorization, trial deadline or online lease exists. Once the desktop verifies a start, the process can continue offline indefinitely. Perpetual paid artifacts have `expires_at:null`. Pickup returns the existing entitlement/license independently of subsequent sales shutdown. Sync returns only signed ACTIVE/REVOKED decisions with monotonic revisions. Network errors never become signed revocation.

Manual codes contain 160 random bits. The backend stores only a versioned domain-separated HMAC verifier. Codes are device/customer/generation/SKU-scoped and expire. Redemption atomically consumes once, issues a license, records audit/outbox and preserves exact retry result. A revoked current-generation license requires explicit same-ID recovery; codes cannot replace it. Issuance and reset grants are displayed once; Admin idempotent retries return only `secret_already_delivered`, not the secret. Cancel/reissue after lost delivery. Version `v1` verifier-key retention is mandatory for outstanding codes; a multi-key production rotation adapter remains a go-live dependency.

## Admin and independent ownership review

Seed creates roles/permissions, **no Admin account or known password**. For local development only, set temporary `ADMIN_USERNAME`, `ADMIN_PASSWORD` (at least 16 characters), NODE_ENV and three independent secrets; run `node tools/provision-admin.mjs`. It emits a one-time synthetic TOTP SHA1 secret in hex to the local issuer. Protect that output; remove temporary environment variables afterward. Production provisioning is deliberately unavailable.

Admin login requires password and a valid unused six-digit TOTP. Encrypted MFA records use AES-256-GCM with a separate secret. Sensitive requests require an MFA session established within five minutes, scoped RBAC, CSRF, unique `request_id`, reason and expected revision. Use fresh MFA login for reauthentication. Roles: owner (all defined scopes), support (password recovery only), catalog (product changes), auditor (audit/report reads). No hidden URL authorizes access.

Ownership-sensitive operations require an `evidence_ref` to independent support verification. This is an auditable **human verification assertion**, not automatic validation of purchase documents. Staff must not approve evidence based on username/fingerprint alone. Production support policies, external evidence system and dispute escalation remain gates.

Reset preserves the device anchor, username, durable bans, consumed-code history, signed license decisions, audit and commerce history. It tombstones the old customer, clears operational password, revokes sessions/profile credentials, cancels unused codes, and advances generation once. New approved enrollment receives a fresh generation budget. A trial-only Admin reset explicitly replenishes the selected product in the existing generation, preserving old nonce grants/audit; it is not a profile-enrollment reset.

Block affects one SKU, all profiles and future customer generations; it signs revocations for affected licenses. Unblock recreates neither entitlements nor trials. Same-ID recovery requires evidence and a newer ACTIVE decision, preserving trial history. **Arbitrary cross-ID replacement and old desktop snapshot migration remain blocked.** Reset cannot instantly invalidate a permanently offline license. Old proof-capable profiles have a narrow signed-tombstone sync path; they cannot retrieve new-account access.

## Database and operational boundaries

Migrations `001`–`004` run in lexical order inside a transaction protected by a PostgreSQL advisory lock. Hashes normalize CRLF to LF. Applied-file changes or ordering drift fail. Explicit SQL supports CHECKs, partial UNIQUE indexes, restrictive FKs, price-range exclusion, immutable-history triggers, and row locks without an ORM shadow schema.

Transactions lock machine before product restriction/counter/code/license. Reset/block/issue/trial/code operations serialize on that machine. Signing or SQL failure rolls back consumption and entitlement creation. Unique business keys remain final protection. Outbox rows commit with business changes; `Outbox.dispatch` uses `FOR UPDATE SKIP LOCKED`. Consumers must deduplicate event IDs because delivery is at least once. No external consumer, timer, SMS or broker is enabled.

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
