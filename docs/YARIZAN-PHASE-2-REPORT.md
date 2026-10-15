# YariZan V2 Phase 2 engineering report

Date: 2026-10-15, Asia/Tehran. Scope: implemented backend foundations for isolated development and independent review, **not commercial release approval**. Production startup deliberately fails closed. Trial remains online-to-start only; purchased access remains perpetual/offline.

## A. Repository and commits

- Repository: `osameh15/YariZan`.
- Branch: `feat/yarizan-v2-backend-core`.
- Required/current main base: `c9ebb75c3d8fad98c2a685965cf6d9fc5c3a5d20`.
- PR #1 is merged at that exact commit. [Main CI 38634463214](https://github.com/osameh15/YariZan/actions/runs/38634463214) succeeded before implementation.
- Work uses a clean separate `YariZan-Backend` worktree. Original `YariZan` worktree's untracked brand assets are preserved. No tracked changes were present there.
- `50872bc`: PostgreSQL/database/runtime foundation and pre-implementation compatibility report.
- `09bc63c`: paired enrollment, password sessions and security primitives.
- `25adf99`: transactional trials and signed licenses.
- `2d1a4fb`: activation codes and audited Admin lifecycle.
- `bdcaa5b78961f1de81bb50a1f351df2421e63973`: complete implementation, hardening, tests, CI and documentation.
- [Draft PR #2](https://github.com/osameh15/YariZan/pull/2), open and unmerged. Final delivery is a documentation-only evidence commit after that implementation. Exact final HEAD/run links are in the PR body and delivery handoff; a report cannot contain its own commit hash. [Current branch commits](https://github.com/osameh15/YariZan/commits/feat/yarizan-v2-backend-core).
- Feature worktree is clean after delivery; all five implementation checkpoints are pushed. Original branding assets remain untouched in the original worktree.

Graph indexing/coverage calls returned `Transport closed`. No complete graph claim is made. Source verification covers the mandatory merged V2 files, relevant fixtures and documents. The [compatibility report](YARIZAN-PHASE-2-COMPATIBILITY.md) was written before implementation.

## B. Architecture

The NestJS modular monolith lives in `backend/src`: foundation/configuration/database, identity/enrollment/pairing, accounts, desktop trials/licenses, activation, Admin, audit and outbox. Dependency injection separates key management, access authority and transport. No Redis, broker, microservices, Nuxt frontend or deployment service is added.

Explicit SQL/node-postgres replaces the proposed Prisma ORM with a justified compatible solution: PostgreSQL constraints, advisory locks, row locks, partial indexes, price exclusions and trigger definitions stay directly reviewable. Strict TypeScript compilation, ESLint and Prettier are enforced. Zod DTOs reject unknown/missing fields. A bounded pre-parser rejects duplicate fields, fractional/exponent numbers, lone surrogates, excessive depth and >32 KiB JSON. Correlation IDs are server-generated. Logs whitelist method/status/duration/correlation and never serialize request bodies, authorization, cookies, URLs or raw errors.

Browser sessions and enrolled-device bearers are separate boundaries. Browser cookies are HttpOnly, SameSite Strict, path `/api/v2`; exact Origin and CSRF token protect mutations. Development HTTP cookies are non-Secure; production cannot start. Device credentials require key proof and expire after 15 minutes. Each business transaction rechecks key status, customer state, account generation, device binding and product restrictions. Credential expiry does not affect an already-started trial or local paid verification.

Argon2id uses 64 MiB, three passes, parallelism one. Password work is bounded to four concurrent operations. Login protects enumeration, stale-password races and rate limits. Support reset grants last ten minutes, are one-use, force password selection, disable old-password login and revoke sessions. Admin passwords also use Argon2id; TOTP secrets are AES-GCM encrypted, accepted steps cannot replay, and sensitive requests need recent MFA, scoped RBAC, CSRF and revision/request binding.

Signing is an injectable interface, not JWT. Every artifact uses unchanged ADR-0004 P-256/SHA256/P1363/JCS domains and strict claims. Development keys live only in ignored runtime storage or a local named volume; tests generate ephemeral keys. Private keys are absent from Git, fixtures, desktop binaries and images. Development key IDs are explicitly disposable and cannot pass commercial root approval. External production custody remains unimplemented and gated.

## C. Database and migrations

| Migration | Implemented scope |
|---|---|
| `001_core.sql` | Devices/customers/generations, keys/credentials/challenges/pairings, password sessions/reset grants, SKU restrictions, trial counters/starts, entitlements/licenses/decisions, activation codes/redemptions, Admin roles/permissions/sessions/idempotency, reset/recovery history, immutable audit, outbox, rate buckets |
| `002_commerce.sql` | Integer IRR price history, product releases, future orders/items/payments/events, discount campaign/code/product/reservation/redemption and refund tables; no transaction endpoints |
| `003_integrity.sql` | Username/digest consistency, product publication checks, composite scope FKs, customer-generation trial/redemption links, immutable operations/recovery history and query indexes |
| `004_enrollment_history.sql` | Immutable profile enrollment issuance history and future cross-ID replacement records; no replacement endpoint |
| `005_credential_scope.sql` | Issuance-time customer/device/generation binding, immutable credential authority; pre-migration revoked bearers expire fail-closed |

Six products seed exactly once at 12,990,000 IRR each. G1 is published with sales/trial/activation enabled; G2–G6 are coming soon with all three disabled. Repeated seed preserves operator-edited prices/availability. Catalog visibility, sales, trials and activation have distinct fields. Existing issued entitlements survive disabled new activation/sales.

Actual constraints include restrictive FKs; unique fingerprint/version, public username and profile key digest; partial active customer/device and entitlement/product uniqueness; quota CHECK 0–2; nonce/request/code consumption uniqueness; same-device/SKU license-entitlement FK; safe-integer positive revisions; one current price plus non-overlapping price ranges; money/total checks; and immutable audit/decision/start/redemption/reset/enrollment/operation history triggers. Future provider authority/reference, source order item and event indexes prevent duplicate business fulfillment. No cascade erases audit/financial data during reset.

Migrations run in lexical order in one transaction with an advisory lock. Applied-file hashes normalize CRLF to LF. Hash/order mismatch fails. Fresh-schema comparison checks columns, indexes, constraints, triggers and function definitions. Only explicitly named disposable test/reference databases are rebuilt. `tools/runtime-role.sql` provides a NOLOGIN runtime group without schema/migration/history mutation rights; local Compose intentionally uses a disposable migration owner. Superuser compromise remains outside trigger protection.

Trials lock the device and product restriction, insert-or-lock the generation-scoped counter, look up nonce and digest, then sign/store the response and increment once. Identical retries return stored response, including after exhaustion. Code redemption locks the same device/restriction then code, verifies recipient/generation/status/expiry, checks request digest and revocation policy, and commits consumption, entitlement/license, audit, outbox and exact retry result together. Signing failure rolls back all business changes. Admin operations serialize on Admin and relevant device/revision; immutable request-bound results prevent duplicate mutations.

Outbox dispatch uses SKIP LOCKED and requires idempotent consumers. No external consumer is enabled. Failed delivery remains retryable; crash-after-delivery can redeliver. Retention, legal pseudonymization, production backups and restore drills remain operational dependencies. Prefer safe roll-forward after real issuance/commerce; never restore an old snapshot without reconciling later rights, decisions and money. No live MySQL migration or destructive down-migration is included.

## D. API contracts

The [implemented OpenAPI snapshot](YARIZAN-OPENAPI-BACKEND-V2.json) lists **39 actual controller routes**; the route/snapshot checker fails on drift. It is distinct from the earlier design OpenAPI, which includes future commerce. Full local setup, exact enrollment transcript, DTO fields and errors are in [backend/README](../backend/README.md).

| Group | Actual operations | Boundary |
|---|---|---|
| Runtime/catalog | GET health/readiness; GET products/list and individual SKU | Public; readiness reports closed production gate |
| Enrollment | POST device challenges, pairing creation, browser confirmation, desktop confirmation, paired claim/register, device authentication | Key proof, one-use pair/claim secrets; owner cookie+CSRF for extra profiles |
| Customer | Password login, session rotation/logout, one-time reset completion, account/devices/license metadata | Password or scoped cookie+CSRF |
| Admin sessions | TOTP/password login and logout | MFA login; CSRF logout |
| Desktop | Trial status/start, license pickup/sync, manual code redeem, entitlement metadata | Enrolled bearer and current authority; tombstone-only historical exception |
| Admin lifecycle | Customer reset, SKU block/unblock, trial reset, manual entitlement issue, revoke, same-ID reissue, code issue/cancel, support password reset, product patch, audit query/report | Scoped RBAC, recent MFA, CSRF, request UUID/reason/revision; evidence for ownership-sensitive operations |

The five established desktop routes preserve every body/response field, including direct SignedLicense pickup/redemption and direct SignedDecision sync. Errors use `{error:{code,request_id}}`; no raw inputs are echoed. Trial exhaustion is HTTP 403 `TRIAL_EXHAUSTED`; invalid input 400, missing auth 401, restrictions 403, hidden resources 404, stale/idempotency conflict 409, expired pairing/reset 410, rate limits 429 and unavailable dependencies/signing 503. The compatibility report enumerates expected redemption codes.

Sync supports signed ACTIVE/REVOKED only, matching the current desktop. Reissued/recovery-pending states cannot be invented inside that signed schema. Same-ID recovery produces a newer ACTIVE decision after independent review; arbitrary cross-ID recovery stays absent/blocked. Sales shutdown never revokes an existing perpetual license. No heartbeat, periodic authorize or per-game endpoint exists.

## E. Security findings and gates

| Finding | Resolution / residual risk |
|---|---|
| Self-reported fingerprint plus new software key cannot prove physical ownership | Explicitly unresolved; production startup fails closed. Paired development protocol is not hardware attestation. A spoofed unclaimed fingerprint can win a first-claim race. |
| Existing-owner spoof/additional profile | Owner-authenticated CSRF approval plus candidate-key proof, same machine UUID and account generation; unauthorized profile fails. |
| First-claim race | Real PostgreSQL uniqueness/locks create one active owner, not necessarily the rightful physical owner. Throttling/audit and human dispute recovery are required. |
| Stock desktop cannot provision real enrollment credentials | Gate preserved. Real C# client/verifier/controller exercise injected local API credentials in tests; no claim of completed commercial CNG/browser enrollment UX. |
| Customer reset and offline caches | Signed old-license revocation retained; operational rights revoked and generation advances. A permanently offline cache cannot be immediately invalidated. |
| Code theft/replay | 160-bit CSPRNG; versioned HMAC-only storage; recipient/SKU/generation checks; transactional one-time consume; request-bound retries. No secret query or plaintext stored Admin retry. |
| Trial overspend | Shared device/product/generation counter, row lock, unique nonce and exact persisted response. Patched binaries/VM snapshots remain outside server guarantees. |
| Support/Admin abuse | Scoped roles, recent MFA, CSRF, reason, expected revisions, immutable audit; evidence reference is a human assertion requiring independent real verification. No reset from username/HWID alone. |
| Reset/reapproved profile key | Credentials retain issuance-time customer/generation with a DB immutability trigger. Old revoked bearers cannot inherit a new account or read its ACTIVE/REVOKED decisions. Regression tested. |
| Password reset race | Old password disabled; snapshot password hash rechecked under lock before creating sessions. Dummy hash cannot authenticate a null-password account. |
| Signing compromise/rotation | Production manager unavailable and startup gated. Retain old public roots and enrollment verification keys forever as required for perpetual licenses. Retain v1 code-verifier secret while codes exist; multi-key custody/rotation integration pending. |
| Cross-ID reissue | Blocked. No local revocation deletion or arbitrary replacement artifact. Only current-account same-ID decision recovery is implemented. |
| Logging/DB authority | Whitelisted logs; test-injected secret-bearing signing error does not leak. Runtime role cannot edit schema/audit/migration ledger. Malicious DB owners remain trusted. |
| Operational cleanup/capacity | Bounded pools, payloads, password work and rate limits; maintenance scheduling, production restore and shared-VPS load acceptance pending. |

No third-party penetration test or hardware attestation has been performed. No production support evidence system, signing KMS or commercial root approval is claimed.

## F. Executed validation

Local host: Windows `10.0.26300.0`, Node `24.20.0`, npm `12.0.2`, TypeScript `5.9.3`, NestJS `11.2.7`, PostgreSQL **17.11** in isolated Docker Linux container, Docker engine `29.8.2`, .NET SDK `10.0.401` / runtime `9.0.20`. Dependencies are pinned with package-lock; npm audit found zero vulnerabilities at validation time.

| Command | Executed result |
|---|---|
| `npm run build` | Strict TypeScript compile passed |
| `npm run lint` | ESLint passed |
| `npm run format:check` | Prettier passed |
| `npm test` | **89 passed, zero failed** |
| `.NET BackendInterop` invoked by integration suite | **24 verifier checks + 10 actual API/client/controller checks**, zero failures |
| `node tools/check-schema.mjs` | Five fresh PostgreSQL catalog groups matched; five migrations verified |
| `npm run check:contracts` | 39 route snapshot and five desktop response profiles checked |
| `npx --yes @redocly/cli@2.63.0 lint ../docs/YARIZAN-OPENAPI-BACKEND-V2.json` | Valid, no errors/warnings after snapshot cleanup |
| `npm audit --audit-level=high` | Zero vulnerabilities |
| `docker build -t yarizan-backend-fixture .` | Local image built; Compose health/readiness/catalog/pairing smoke passed, uid 1000 and no embedded image keys verified |
| `dotnet build src/YariZan.sln -c Release -p:IncludeGameBundle=false -p:IncludeGameKey=false --nologo` | **0 warnings, 0 errors** |
| `tests/Run-V2Checks.ps1` | **289 passed, 0 failed** |
| `tests/Run-AccessChecks.ps1` | **27 passed, 0 failed** |
| `tests/Run-LauncherChecks.ps1` | **8 passed, 0 failed** |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Run-GradeChecks.ps1` | **5 groups passed**; expected invalid selections returned nonzero |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Run-BookChecks.ps1` | **36 passed, 0 failed** |

Desktop baseline is **365 checks/groups**, zero failures. Worktree support changes only the V2 test helper's `.git` directory/file detection; desktop runtime source is unchanged. Initial direct grade-script invocation with redirected native stderr stopped on its intentional negative case; rerunning as an independent PowerShell process passed all five groups. No invalid-selection failure was treated as a successful game pack.

Actual local Windows evidence: `TokenElevation.TokenIsElevated=0`, `AdministratorsGroupEnabled=False`, TPM-preferred provider selected **TPM**, forced software checks also pass, actual clipboard round-trip executed. This is local non-elevated/TPM evidence. Hosted Windows CI is reported separately; do not infer its token/provider from this run.

PostgreSQL tests execute real HTTP calls against Nest and actual transactional storage: 20 parallel distinct trials yield exactly two starts; 20 identical nonce calls yield one stored grant; 20 concurrent distinct code-redemption requests yield one consumption; same-request retries reproduce the signed result. Tests cover competing claims, spoofed known identity, authorized/unauthorized profiles, generation reset, durable ban, signing rollback, reset-session races, MFA/RBAC/CSRF, immutable history, runtime-role restrictions, outbox workers and rotated-credential rate limits.

The standalone C# project compiles the **unchanged production** SignedArtifactVerifier, CanonicalJson, CommercialReleasePolicy, DesktopV2Client and DesktopAccessController. Identity/local storage adapters and loopback host mapping are test-only. Fixed canonical message bytes are committed without private keys. Nest-generated enrollment, trials, perpetual licenses and decisions verify in C#. Negative checks cover wrong SKU/UUID/fingerprint/profile-key digest, unknown kid, raw signature corruption/encoding, altered payload, wrong domain, zero revision, invalid enrollment and an incorrectly expiring paid license. Actual API tests prove trial status/start, offline process continuation, optional pickup failure, paid pickup, ACTIVE sync, offline paid restart and timeout preservation.

**Disconnection is simulated transport failure.** No physical 60+ minute endurance test, actual second Windows account, reboot, TPM loss, physical touch/DPI/accessibility, clean commercial installer or live server test was performed in Phase 2.

### Final validation / CI evidence

Implementation HEAD `bdcaa5b78961f1de81bb50a1f351df2421e63973` passed both independent workflows:

- [Backend CI 38693113913](https://github.com/osameh15/YariZan/actions/runs/38693113913), Ubuntu runner, job `116283369535`: **89 Node tests, zero failed**, plus **24 C# verifier and 10 actual C# API/controller checks**. PostgreSQL 17 service, five-group migration catalog comparison, 39-route snapshot, strict/lint/format, OpenAPI lint, backend/public secret scanners and dependency audit all passed. Docker build, native Argon2 loading, uid 1000/no embedded key check, readiness and catalog smoke passed. The API container was removed by the job; no deployment occurred.
- [Windows CI 38693113846](https://github.com/osameh15/YariZan/actions/runs/38693113846), job `116283369370`: **289 V2 + 27 Access + 8 Launcher + 5 Grade groups + 36 Book = 365 checks/groups, zero failed**. Build had **0 warnings/errors**; OpenAPI/public scanner/smoke checks passed. Actual hosted token `TokenIsElevated=1`, `AdministratorsGroupEnabled=True`; provider **SOFTWARE**, runtime **9.0.21**, Windows **10.0.26100.0**. Clipboard round-trip executed. This is elevated/software evidence, distinct from local non-elevated/TPM evidence.

Final local rerun: **89 passed, zero failed, zero skipped**. The .NET nested check counts above are not added again to the Node test count. Both OpenAPI documents linted cleanly. Backend scanner checked 49 tracked backend/interop files. A final five-migration fresh PostgreSQL comparison passed. Final local Docker build/start applied all five migrations; health/readiness/catalog and synthetic browser/desktop pairing passed. Production-mode image startup refused with exit 1. Public signing-key digest remained unchanged across local container restart; only the public digest was inspected, not private-key bytes. Runtime PID 1 is Node, with shutdown hooks enabled.

The final documentation-only delivery commit is checked again by both workflows; its exact SHA and run links are recorded in Draft PR #2 and the handoff. No runtime source changes follow the implementation evidence above.

## G. Requirement and milestone matrix

| Major requirement / milestone | Status | Practical limit |
|---|---|---|
| A: Nest/database/config/Compose/seeds | Implemented | Isolated local/test only |
| Real constraints and migration/hash/catalog validation | Implemented | Production backup/restore remains operational acceptance |
| B: Paired claim, passwords, sessions and key proof | Partially Implemented | Development protocol works; production physical/ownership assurance and desktop provisioning gated |
| Additional profile reuses device/entitlement/trials | Implemented backend | Real Windows multi-account acceptance pending |
| Support-assisted password reset | Implemented | Independent human evidence and support policy required; no SMS |
| C: Real two-entry trials and retries | Implemented | Modified clients/VM snapshots not prevented |
| Exact signed enrollment/license/trial/decision interoperability | Implemented | Synthetic key custody; commercial roots/KMS blocked |
| Paid pickup and same-ID sync/recovery | Implemented | Arbitrary cross-ID snapshot migration blocked |
| D: One-time codes, issuance/cancellation/redemption | Implemented | v1 verifier key retention required; production multi-key rotation pending |
| Admin MFA/RBAC/CSRF, reset/ban/unban/trial/manual issue/catalog | Implemented | Real operator onboarding/evidence and retention review required |
| Immutable audit and outbox | Implemented | External consumers and maintenance schedules not enabled |
| Future-commerce data model | Implemented | No working checkout, payment, coupons settlement or refund API |
| E: Automated API/PostgreSQL/.NET/Windows hardening | Implemented | Physical Windows and production acceptance not substituted |
| Cross-ID recovery | Blocked | Official desktop lacks authenticated atomic replacement protocol |
| Commercial production enrollment/signing | Blocked | No source/config bypass; no real roots or keys introduced |
| Nuxt portal, real ZarinPal, MeliPayamak | Not Started (excluded scope) | Subsequent authorized phases |
| Deployment/DNS/legacy migration | Not Started (excluded scope) | Separate operational approval |

## H. Remaining dependencies and Phase 3

Phase 3 can build the Persian RTL Nuxt store/customer/Admin portals over these scoped APIs. It must keep G2–G6 coming soon unless an authorized availability change is made. Customer pairing needs a reviewed real browser/desktop secret-delivery UX and stock CNG credential provider integration. First-claim physical ownership/dispute policy must be independently reviewed before opening production enrollment. Production key custody/rotation/public-root retention, code-key rotation, TLS/cookie/CSRF deployment configuration, operator MFA/evidence handling and retention need completion.

Payment checkout, authoritative gateway verification/reconciliation, discount settlement, refunds, SMS and live product downloads remain future scope. Physical Windows acceptance, production backup/restore, shared-VPS resource budget, alerting and maintenance schedules remain release dependencies. No frontend, deployment or payment completion is implied by future tables or documented contracts.

## I. Safety confirmation

No main branch changes, merge, production/staging server modifications, existing PHP/MySQL changes, DNS/Traefik changes, real customer-data access, ZarinPal merchant calls/settings, MeliPayamak changes, production signing-key generation/rotation, live payments or refunds occurred. The existing legacy deployment workflow is unchanged. All PostgreSQL data and cryptographic material used here are disposable local/test data. Feature-branch pushes and a Draft PR are the authorized delivery only; stop for independent review before merge/deploy.
