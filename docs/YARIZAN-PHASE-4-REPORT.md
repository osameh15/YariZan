# YariZan Phase 4 engineering report

## Preflight and implementation plan

Base: e474a6a92adb4cd341289a7f4238c6f128cb3f99, current origin/main. PR #3 merged 2026-10-15T18:25:12Z; GitHub REST confirmed merged=true and matching merge SHA. Main push CI 38785466716 succeeded (https://github.com/osameh15/YariZan/actions/runs/38785466716). No other main workflows exist for this SHA because backend/web workflows are pull-request triggered. Initial tree clean. Created feat/yarizan-v2-commerce in the existing Web worktree, without a fourth checkout or editing main. Codebase-memory index is unavailable (Transport closed); direct source/migration fallback is used.

Before editing source, inventory confirms 001-008 provide products/prices, orders/items, payment attempts/events, campaigns/codes/reservations/redemptions and refund records, but no commerce API, worker, checkout or finance operations. Existing reusable authority: customer cookies/CSRF/generation, Admin SMS MFA/RBAC/idempotent operations, revisioned notes, immutable audit/outbox, Licenses.ensureLicense and desktop pickup, PostgreSQL migrations/drift checks. Existing 60-route OpenAPI is authoritative, older commerce examples are not implementations.

Plan / requirements mapping:

1. A: forward-only migration 009 extends existing tables with immutable snapshots, device/generation scope, bounded amounts, payment transitions and durable leased jobs; existing identity/license/session contracts remain.
2. B: integer-only quotes and server-side coupons, campaign/code revision management, quota locking/reservations and generic probing errors.
3. C: disabled/fake provider selection; typed ZarinPal adapter with injected offline test transport, fixed TLS endpoints and explicit IRR. Persist attempt before external call, never retry ambiguous creation. Durable verification/reconciliation outside database locks, bounded backoff/operator exceptions.
4. D: verified payment persists before fulfillment. Unique source item and business fulfillment; existing perpetual signed license. Signing failure remains paid/pending. Generation reset, blocks, duplicate captures/references and late released coupons become financial exceptions, never erased payments.
5. E: real Persian RTL quote/checkout/simulated continuation/result/orders, and RBAC/MFA Admin campaigns/codes/orders/payments/jobs/exceptions/finance; revisioned notes and safe refund-request review only.
6. F: PostgreSQL concurrency/failure/restart, adapter unit, browser/security, real C# verifier/provisioning and Windows regressions; 17 actual application screenshots, full contracts/report, focused commits and Draft PR. No production operations.

Safety: no live payment/refund, SMS, merchant credential, production signing key, external gateway request, infrastructure/DNS/PHP/MySQL or real data is authorized. Production startup and real-provider configuration remain closed. Synthetic fulfillment is not commercial readiness.

## Repository and implementation checkpoints

Branch: `feat/yarizan-v2-commerce`. Base remains `e474a6a92adb4cd341289a7f4238c6f128cb3f99`. Draft PR and final validation links are recorded in the delivery evidence below; final HEAD is also the PR head, since a report cannot embed its own commit hash. No main rewrite, merge or force-push is authorized.

Focused commits before final evidence:

- e735936: preflight and implementation plan.
- 7fb8c23: schema, authoritative orders and quotas.
- 56c670c: durable verification and perpetual license fulfillment.
- 2116b51: Persian checkout, orders and Admin commerce, browser tests/screenshots.
- 2fc6d76: recovery/history hardening, crash/refund tests and configuration.

Changed areas: backend/src/commerce (contracts/orders/gateway/payments/administration/controller), migration 009, app/config/seed/Admin notes, migration/runtime/OpenAPI tools and integration/provider tests; Nuxt checkout/payment/order components/routes, Admin commerce, catalog purchase capability, support terms, same-origin allowlists/cache policy, generated client, unit/E2E fixtures; the C# BackendInterop test helper exercises commerce before ordinary desktop pickup. Production Windows source and signed domains are unchanged. CI only adds commerce screenshot artifacts; existing backend/browser/Windows jobs execute the expanded suites and legacy PHP workflow is untouched. Complete inventory: `git diff --name-only e474a6a92adb4cd341289a7f4238c6f128cb3f99 HEAD`.

## Architecture, database and financial authority

The existing modular monolith, customer sessions/CSRF, Admin SMS MFA/RBAC/revisions, immutable audit/outbox and Licenses service are reused. Nuxt is a typed same-origin client, never a database authority. No Redis/broker/service is introduced. PostgreSQL jobs supply durable payment recovery independently of the process-local OTP queue.

Migration `009_commerce_authority.sql` extends the approved 002 tables rather than replacing them. It adds immutable order/item money and identity snapshots, exact expected-payment scope, timestamps/transitions, unique unresolved attempts and pending orders, campaign/code revisions/limits, leased jobs with immutable execution history, financial exceptions, unique item/entitlement/license fulfillment, purchase notification records and commerce note FKs/permissions. Composite FKs bind payment amount/currency/order and fulfillment item/entitlement/license. PURCHASE entitlements require captured order ownership scope. Old migrations are unchanged and drift is checked. Historical non-single-item/unresolvable orders require reviewed backfill rather than destructive migration. Roll forward after application; failed migration transactions roll back atomically.

The synthetic flow is real server authority: eligible G1 quote/order → persisted fake request → deterministic gateway ledger outcome → backend verification → paid state/coupon redemption/job → existing signed perpetual license → authenticated desktop pickup. Browser success parameters do not authorize fulfillment. Price snapshots survive catalog changes. G2–G6 remain unavailable initially. Device locks prevent concurrent duplicate purchase opportunities; campaign/code locks enforce quota under 20 competing checkouts. UNKNOWN holds quota past TTL. Only never-initiated expired orders or definitive unpaid outcomes release it. Zero/under-minimum orders are blocked.

Payment verification and signing are separate transactions: paid evidence survives signing outage, account reset, bans and ownership conflicts. Duplicate references/captures and late released coupons become explicit exceptions, without duplicate licenses or erased funds. Jobs use SKIP LOCKED, 60-second leases/fencing, bounded backoff and review after eight unsuccessful attempts. Manual reconciliation is revisioned/idempotent and preserves attempts/history; it never creates a charge. Worker crash and concurrent-worker recovery are tested.

Exact API/state/quota/currency/lock-order/retention policies are in [Commerce contracts](YARIZAN-COMMERCE-CONTRACTS.md). There are 78 implemented controller routes, 18 added commerce routes, with strict mutation DTOs and five unchanged desktop response profiles. Older proposed commerce contracts are not counted as extra endpoints.

## Requirements matrix

| Requirement / milestone | Status | Evidence or limit |
|---|---|---|
| A: forward schema, integer snapshots, constraints, idempotency | Implemented | 009 and PostgreSQL integration/schema comparison |
| B: percent/fixed/capped coupons, dates/SKU/global/customer quotas | Implemented | Real quote/reservation/redemption APIs, Admin revision checks; 20-way last allocation |
| C: deterministic create/verify/inquire and durable reconciliation | Implemented | Fake ledger, callback-hint verification, restart/duplicate workers, review history |
| Real ZarinPal adapter | Partially Implemented / runtime Blocked | Offline-tested typed adapter; no runtime transport, merchant acceptance absent |
| D: exactly-once entitlement/perpetual license | Implemented for synthetic path | Source item/fulfillment constraints; real C# verifier/pickup and offline restart |
| E: Persian checkout/result/customer orders/Admin finance | Implemented | Actual API-backed pages, permissions, notes/search/date/pagination/revisions |
| Refund request/review foundation | Implemented | No money execution or automatic license revocation |
| Refund execution/settlement/accounting | Blocked / excluded | No vendor operation or merchant permission assumed |
| Purchase confirmation event | Implemented | Durable post-fulfillment event/template, deduplicated order |
| Real purchase SMS delivery | Blocked | Separate reviewed template/variables and Sms consumer acceptance required |
| F: security/concurrency/software integration | Implemented | Backend/browser/Windows suites and adversarial cases below |
| Physical hardware ownership assurance/endurance | Blocked | Software fingerprint/key is not physical proof; independent acceptance remains |
| Production signing/payment/deployment | Blocked | Fail-closed runtime/release gates retained |

## Security review and residual risks

- Orders/payment objects are customer-filtered and generation checked. Mutations preserve exact Origin, HttpOnly session and CSRF; Admin finance actions require permission/recent SMS MFA/reason/revision/request UUID. Support/catalog roles cannot gain finance mutation rights from the URL.
- Browser sees no desktop bearer, signed enrollment or private material. Existing key-proof pickup, CNG/DPAPI and offline verification remain unchanged. Fingerprint spoofing/preemptive account claims remain an explicit production ownership-assurance gate.
- Provider URLs/merchant callbacks are fixed/allowlisted; no browser price/redirect/success authorizes a license. Real adapter transport rejects redirects, limits body/time, uses HTTPS and normalizes ambiguous results to UNKNOWN. No request was sent to payment/inquiry/refund endpoints.
- Financial mutations append redacted audit/outbox; immutable rows preserve snapshots/transitions/exceptions/job runs. Listings exclude provider credentials/raw responses/lease tokens. Only synthetic fixtures and independent development keys were used.
- A valid cached offline license cannot be immediately revoked while permanently offline, including after refund/reset. Refund approval and revocation are separate; customer support terms disclose this.
- Durable worker leasing is at-least-once execution with idempotent business effects, not exactly-once network delivery. Automatic charge creation retry is forbidden. Unresolved real orphan authorities require merchant/operator recovery. Financial reports are operational, not bank settlement.
- Admin substring searches are bounded/paginated with note/date/scope indexes; high-volume query-plan/load acceptance is outstanding. No throughput or production availability claim is made.
- Purchase SMS is an event foundation only. Future delivery must use the existing SMS abstraction with approved purchase template variables and deduplication; ambiguous sends must not be blindly retried. Existing OTP process-local delivery limitations remain.
- Runtime high/critical dependency audit is zero. Full web build audit still reports the two inherited unpatched high advisories, braces GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv. No advisory is suppressed and no dependency was added. Commercial release requires reassessment.

## Official provider research

Official SDK source/Postman overview and request/verify/inquiry/configuration docs were reviewed; links and exact assumptions are in the commerce contracts. Explicit IRR prevents the tenfold Toman error. Conservative minimum 10,000 IRR follows docs despite differing SDK minimum comments. Verify uses original amount and codes 100/101/ref_id; it does not independently return amount/currency. Inquiry terminal semantics, merchant permissions, callback registration, sandbox/live behavior, reference retention and refund permission need independent merchant acceptance. The adapter cannot be activated by environment configuration. No live or sandbox charge/verification/refund was performed.

## Local validation

Environment: Windows NT 10.0.26300, PowerShell 5.1, Node 24.20.0/npm 12, .NET SDK 10 targeting .NET 9, runtime 9.0.20, Edge 155, isolated Docker PostgreSQL 17.11. Commands run from the stated directory; required keys are independent synthetic values, never commercial credentials.

Backend (`backend/`):

```powershell
npm run build
npm run lint
npm run format:check
npm test
node tools/check-schema.mjs
npm run check:contracts
npx --yes @redocly/cli@2.63.0 lint ../docs/YARIZAN-OPENAPI-BACKEND-V2.json
npm run check:secrets
npm audit --audit-level=high
```

158 tests passed, zero failed/skipped: existing 136 plus 4 provider/money tests and 18 PostgreSQL commerce tests. These include 12 competing duplicate orders, 20 simultaneous last-coupon checkouts, quote/cap/SKU/account quota, mismatch/replay, orphan create, duplicate capture/reference, reset/block/signing failure, expired lease/history/manual idempotency, expiry and refund review. Initial newly added assertions had case/receipt-shape mistakes and were corrected before the passing full run; no failures are hidden.

Real cross-language counts embedded in the backend suite: DOTNET_INTEROP 24, DOTNET_API 10, provisioning 25 software-adapter checks and 26 actual Windows CNG SOFTWARE/DPAPI checks. The optional commerce fixture pays through the synthetic gateway before real desktop pickup/offline/G2/revocation/manual activation checks. These are software/Windows integration evidence, not physical ownership proof.

Migration comparison passes five groups (columns, indexes, constraints, triggers, all public functions) between fresh initialization and 001–008 upgraded through 009. Strict compilation/lint/format/contracts/secret scan pass. OpenAPI lint passes with two pre-existing intentional warnings: retired 410-only endpoints have no success response. Backend npm audit reports zero vulnerabilities.

Web (`apps/web/`):

```powershell
npm run contracts:check
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e
npm run check:secrets
npm run audit:dependencies
```

17 unit tests and 30 actual browser tests pass. Browser tests run real NestJS/PostgreSQL and production Nuxt; financial success is not a mocked browser response. Existing 26 auth/provisioning/Admin/RTL/accessibility tests remain; four commerce tests cover quote/discount/error/checkout/payment/UNKNOWN/cancel/customer/Admin. Updated dialog layout and financial reporting are included in the final evidence run below. Browser/C# integrated provisioning adds 25 actual Windows checks in its existing non-commerce flow. Proxy variables were cleared only for local Nuxt build/typecheck to avoid tooling proxy interference.

Root/container checks:

```powershell
docker build -t yarizan-backend-fixture backend
# backend/: explicit NODE_ENV=test, disposable DATABASE_URL and independent synthetic keys
# RUNTIME_DOCKER_NETWORK=yarizan-v2-local_default
# RUNTIME_DATABASE_URL=postgresql://yarizan:local-disposable@db:5432/yarizan_phase2_test
node tools/check-runtime-env.mjs yarizan-backend-fixture
dotnet build src/YariZan.sln --configuration Release --nologo
powershell.exe -NoProfile -File tests/Run-GradeChecks.ps1
powershell.exe -NoProfile -File tests/Run-AccessChecks.ps1
powershell.exe -NoProfile -File tests/Run-LauncherChecks.ps1
powershell.exe -NoProfile -File tests/Run-BookChecks.ps1
powershell.exe -NoProfile -File tests/Run-V2Checks.ps1
python tools/Check-PublicRepository.py
```

Docker checks pass: missing/empty/invalid NODE_ENV rejected; production rejected; test+zarinpal rejected; explicit development/test migrate/seed/readiness/signing-mode/graceful shutdown pass; image has no key, runs UID1000 and loads Argon2. Windows regression: 5 grade, 27 access, 8 launcher, 36 book and 300 V2 = 376 checks/groups, zero failures. Solution build passes with 11 NU1900 vulnerability-feed connectivity warnings and zero errors; npm runtime scans remain active. Physical restart/endurance/multiple real Windows accounts and live provider acceptance were not performed.

## Screenshot inventory

Actual application, synthetic data only, in `docs/Images/phase4/`:

1. 01-grade-one-purchase.png
2. 02-checkout-summary.png
3. 03-coupon-accepted.png
4. 04-coupon-rejected.png
5. 05-simulated-gateway.png
6. 06-payment-verification-pending.png
7. 07-verified-purchase.png
8. 08-customer-orders.png
9. 09-order-detail-license.png
10. 10-admin-orders.png
11. 11-admin-payments.png
12. 12-admin-campaigns.png
13. 13-admin-coupon-editor.png
14. 14-admin-financial-overview.png
15. 15-mobile-checkout.png
16. 16-mobile-payment-result.png
17. 17-accessible-validation-error.png

Checkout/mobile/dialog screenshots were visually inspected. All payment views clearly label simulation. Browser traces are disabled; screenshots contain no OTP, session token, signing key or desktop credential. Regression-generated historical Phase 3 screenshots are not included as unrelated changes.

## Commercial readiness and safety declaration

The synthetic checkout-to-license foundation is implemented; commercial operation is not ready or approved. Outstanding: merchant-specific ZarinPal acceptance/credentials/transport, bank settlement policy, real refunds, approved purchase SMS templates/consumer, first-claim physical assurance/support disputes, external signing custody/public roots, physical commercial Windows acceptance, production load/backup/monitoring and separately authorized deployment. See [commercial checklist](YARIZAN-COMMERCIAL-RELEASE-CHECKLIST.md).

No modifications to main, production/staging/live server, PHP/MySQL service, DNS/CDN/Traefik/VPS, real customer records, ZarinPal merchant, MeliPayamak account, production signing keys, live payment/refund or settlement infrastructure. No merge, deployment, real charge/refund/SMS, commercial key creation or force-push. Only feature-branch commits and a Draft PR are delivered for independent review.
