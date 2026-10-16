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

Branch: `feat/yarizan-v2-commerce`. Base remains `e474a6a92adb4cd341289a7f4238c6f128cb3f99`. Draft PR: https://github.com/osameh15/YariZan/pull/4 (Draft, not merged). Final validation links are recorded in the delivery evidence below; final HEAD is also the PR head, since a report cannot embed its own commit hash. No main rewrite, merge or force-push is authorized.

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


## Delivery evidence checkpoint

Implementation checkpoint 6d354cf5dd5804e66bc1e2689e21e6a39d174076 introduced the report/contracts and reporting additions. Latest full local run: backend 158/158 (140.02s), web unit 17/17, browser 30/30 (2.1m); refreshed all 17 Phase 4 screenshots. A final notification recovery hardening test forces replay of a completed PURCHASE_NOTICE job and checks exactly one existing-outbox purchase event as well as one notification record. This prevents restart retries from emitting duplicate future notifications.

Initial implementation CI (superseded by final evidence commits): backend https://github.com/osameh15/YariZan/actions/runs/38807756776 ; web https://github.com/osameh15/YariZan/actions/runs/38807756770 ; Windows https://github.com/osameh15/YariZan/actions/runs/38807756761 . Final status is not inferred from these runs; exact final-head results are added after completion.


### Validated implementation and CI

Validated implementation HEAD: 0ada8a783d2dcaca9a123dc954b6730a2a6468c3. All three workflows passed on that exact SHA:

- [Backend 38808111219](https://github.com/osameh15/YariZan/actions/runs/38808111219): 158 tests, zero failures/skips, 62.08s; real .NET verifier 24, API 10 and software provisioning 25; migration comparison, OpenAPI, scans/audit and Docker startup gates passed.
- [Web 38808111236](https://github.com/osameh15/YariZan/actions/runs/38808111236): 17 unit tests, 30 Chromium browser tests (1.4m), software provisioning 24; production build/type/lint/format/contracts, image build and explicit advisory policy passed. Linux software-adapter counts differ from Windows CNG checks; neither is physical ownership proof.
- [Windows 38808111361](https://github.com/osameh15/YariZan/actions/runs/38808111361): existing grade/access/launcher/book/V2 regression workflow passed. Local corresponding total is 376 checks/groups.

Final local backend rerun including notification replay: 158/158, zero failed/skipped, 141.65s. Local frontend final build 54.5s; unit 17/17 and Edge browser 30/30 (2.1m). Schema, strict compilation/lint/format, contracts, repository/secret scans passed after all tracked files were included. Compose rebuilt successfully; http://localhost:3200 returns 200 with RTL, catalog has six products, /ready reports production_gate=closed and capabilities explicitly report fake checkout=true, real_payments_enabled=false. Only disposable local services were restarted.

The final evidence-only commit adds this CI record and the README link. Its own final SHA and final-head workflow URLs are recorded in Draft PR #4 and the delivery reply; it changes no runtime or test behavior. Final delivery requires an empty git status and local HEAD equal to origin/feat/yarizan-v2-commerce. Main remains the preflight SHA. Draft PR remains unmerged for independent review.


Final boundary review found that the inherited catalog/customer Toman formatter divided a safe integer using floating point. Values near the maximum safe IRR could display an incorrect last decimal even though server charges remained exact. The shared formatter now reuses the exact BigInt whole/remainder implementation used for finance, with regression assertions for 9007199254740983 and 9007199254740987 IRR. This small follow-up supersedes the documentation-only final-head note above; final-head CI is verified and linked in the PR/delivery without changing financial authority or production gates.


A final finance-boundary assertion also verifies that a provider reference reported for a second unrelated order remains an immutable exception but is not counted as new sales or captured money. Sales require an accepted order payment; capture aggregation counts assigned unique provider references. Distinct second captures for the same order remain visible as duplicate funds, while reused references cannot inflate either aggregate. Existing duplicate-capture/reference integration coverage now checks both report totals.


## Independent review follow-up: navigation, build targets and coupon dialog

Reviewed implementation: fd314cb86b3f8653590fdf3095997d250a05eee9. Follow-up starts from 77ccfed (the subsequent requested button-spacing fix), preserving that change. The codebase-memory skill index/coverage transport remained unavailable; the exact component, generated OpenAPI path type, backend list switch and installed Nuxt/Nitro defaults were inspected directly. No backend financial logic, migration, signed artifact, gateway selection or commercial startup gate changed.

### Finding 1: finance navigation resolved

Removed unsupported paid_orders/refund_requests entries and the duplicated redemptions entry/label. The ten distinct sections are orders, payments, campaigns, coupons, reservations, redemptions, jobs, exceptions, finance and refunds. Navigation is typed against the implemented OpenAPI path-section union and permission-filtered (commerce.read; finance.read for aggregates). Existing session, CSRF, recent SMS MFA and mutation authorization remain server-enforced. Paid-order/refund-request counts remain summary fields in the supported finance API; no invented endpoint was added.

Unknown section queries clear stale records, show a controlled Persian error and link back to orders, suppress operation controls/data, and do not dispatch an unsupported API request. The real backend continues rejecting unsupported list sections. API-backed Playwright follows every visible link, requires HTTP 200 and real records or an explicit empty state, checks unique URLs/labels, and exercises three unsupported query values plus backend rejection.

### Finding 2: exact BigInt build compatibility resolved

Installed Nitro rollup defaults targeted es2019 even though the application/Node 24 runtime uses native BigInt. Explicit ES2022 targets now cover Vite client builds, Nuxt esbuild options and Nitro server esbuild options. No floating-point fallback or money behavior change. Supported runtime policy is Node 24 and modern browsers with ES2022/native BigInt; older browsers without those features are not supported or claimed tested. Current Edge and CI Chromium are executed; physical Safari/Firefox acceptance is not claimed.

Unit coverage verifies every IRR remainder near 9007199254740980 and aggregates exceeding Number.MAX_SAFE_INTEGER. A real API/browser checkout at 9007199254740983 IRR verifies the exact Toman decimal in checkout and order details, completes synthetic settlement, and compares the finance aggregate against PostgreSQL using independent integer division/remainder. The disposable product price is restored afterward. Both production and Docker builds emit zero BigInt target-compatibility warnings. Web CI captures both logs and fails if unsupported BigInt warnings recur; unrelated dependency/deprecation warnings are not suppressed.

### Coupon editor accessibility and layout

The dialog now separates its scrollable field area from a persistent Save/Cancel footer. Desktop fields fit where space permits; at 390x700 the footer remains visible while fields scroll. Header/close and footer remain outside the field scroller. Native modal/Escape behavior and return focus are preserved. Keyboard tests walk from close through all fields to reason/Save, verify focused controls and Save remain in the viewport, move between Save/Cancel and verify Escape restores the launch button. The first focused test run had two overly strict assertions (mandatory desktop overflow and a fixed native browser wrap sequence); these were corrected to test actual field/action reachability without depending on browser-chrome tab order. Final full suite has zero failures/skips.

New actual-application viewport evidence, synthetic data only:

- docs/Images/phase4/18-coupon-actions-1440.png
- docs/Images/phase4/18-coupon-actions-390.png
- docs/Images/phase4/19-coupon-keyboard-1440.png
- docs/Images/phase4/19-coupon-keyboard-390.png

Existing commerce screenshots are refreshed for the corrected navigation/dialog. Historical Phase 3 screenshots generated by regression tests are excluded from this change.

### Executed validation

Same Windows/Node/.NET/PostgreSQL toolchain as the main Phase 4 report. From backend: npm run build; npm test; node tools/check-schema.mjs; npm run lint; npm run format:check; npm run check:contracts; npm run check:secrets; npm audit --audit-level=high; npx --yes @redocly/cli@2.63.0 lint ../docs/YARIZAN-OPENAPI-BACKEND-V2.json. Result: 158 tests passed, zero failures/skips (128.25s); upgrade/fresh schema comparison passes five groups; 78 implemented routes/five desktop profiles match. OpenAPI passes with the same two intentional retired-410 endpoint warnings. Audit zero vulnerabilities.

Financial cases rerun include 20-way coupon allocation, duplicate/reused references and report totals, signing outage after capture, worker lease/restart/manual retry, late-paid released quota, exactly-one entitlement/license/notification, reset during capture, SKU bans and real .NET offline perpetual license verification. Embedded C# verifier/API/provisioning and Windows CNG/DPAPI checks pass; counts are in the existing baseline evidence and final CI logs.

From apps/web: npm run typecheck; npm run lint; npm run format:check; npm run contracts:check; npm test; npm run build; PLAYWRIGHT_CHANNEL=msedge npm run test:e2e; npm run check:secrets; npm run audit:dependencies. Result: 18 unit and 34 browser tests passed, zero failures/skips; production build passed (45.3s) with no unsupported BigInt warning. The initial local typecheck invocation encountered the known environment proxy URL issue; clearing proxy variables for that process resolved it without application changes.

From root: docker build --progress=plain -f apps/web/Dockerfile -t yarizan-web-review .; inspected the complete captured log for Big integer literals/BigInt target warnings (none). Image build passed. Existing web CI now enforces the same warning gate for both builds. python tools/Check-PublicRepository.py passes. Run-GradeChecks.ps1, Run-AccessChecks.ps1, Run-LauncherChecks.ps1, Run-BookChecks.ps1, Run-V2Checks.ps1 pass: 5 + 27 + 8 + 36 + 300 = 376 Windows checks/groups, zero failures. No physical hardware ownership or endurance test is claimed.

Runtime high/critical web audit remains zero; full build audit still explicitly reports the inherited unpatched braces and node-forge advisories. No dependency was added and no finding suppressed. Local ignored logs: review-backend.log, review-openapi.log, review-v2/access/launcher/book.log under backend/.local; review-build/docker/browser-full/audit.log under apps/web/.local. Final-head CI links are recorded in the delivery evidence/PR after completion.

Changed files: CommerceConsole.vue (mapping/controlled unsupported state/dialog composition), main.css (dialog scrolling/footer), nuxt.config.ts (ES2022), commerce.spec.ts (four API-backed browser regressions), web.test.ts (integer remainder regression), web-ci.yml (build warning gates/artifacts), this report, web README and commerce screenshots. API/migration contracts are unchanged. Main, production, real payments/SMS, production credentials/signing keys, PHP/MySQL and infrastructure are untouched. PR #4 remains Draft, unmerged and undeployed for independent review.


### Follow-up commit and CI evidence

- a6863c0: supported/typed finance navigation, controlled unsupported URLs, persistent dialog footer and API-backed browser coverage/screenshots.
- 0f1e88f: explicit ES2022 targets, large-integer unit regression and CI warning gates for production/Docker builds.
- 570666a080be06cf61300166775fa5e05dd20c7b: review report/development documentation; this is the runtime implementation verification checkpoint.

Implementation-checkpoint CI links: [Backend 38818182774](https://github.com/osameh15/YariZan/actions/runs/38818182774), [Web/provisioning 38818183328](https://github.com/osameh15/YariZan/actions/runs/38818183328), [Windows 38818182951](https://github.com/osameh15/YariZan/actions/runs/38818182951). Final delivery checks their actual conclusions and the final evidence-only commit workflows separately; final HEAD/run links are also recorded in Draft PR #4 and the delivery reply. No result is inferred from the earlier reviewed head.

All three requested areas are implemented for development review. The remaining limitations are unchanged commercial/merchant/physical-device gates and the two disclosed unpatched build dependencies. No backend financial behavior or release gate was relaxed. Final delivery verifies clean working tree, pushed branch equality, unchanged main base and Draft/unmerged PR state.


## Premium UI/UX design follow-up — 2026-10-16

### Scope and repository continuity

Continues `feat/yarizan-v2-commerce` / Draft [PR #4](https://github.com/osameh15/YariZan/pull/4), starting from `f1de956d9755d6b9088a8ca27b1768c5a3304a81`. The PR base/remote main remains `e474a6a92adb4cd341289a7f4238c6f128cb3f99`; the untouched local main reference is `aef9bbc78d0a9a4357c3625f56b77ad037f672f7`. Earlier navigation, dialog and ES2022/BigInt review corrections are preserved. Final delivery SHA and exact-head CI are recorded in the PR and delivery evidence below. No branch reset or competing worktree was created.

Design assessment: desktop checkout gave explanatory copy equal prominence to payment totals; cream surfaces, loosely spaced controls and repeated card styles weakened hierarchy. Admin navigation lacked task grouping, finance counts competed with monetary metrics, and mobile explanatory content delayed the next action. The design contract uses existing brand references and assets: warm paper, white surfaces, dark brown text, restrained teal actions and grade-specific educational accents. No third-party design assets, new dependencies, stock images or unlicensed fonts.

### Implementation

- Shared `premium.css`: primitive/semantic/component tokens, natural Shabnam typography without negative Persian letter spacing, compact header/active navigation, white control surfaces, restrained shadows, consistent radii, 44–48px control targets and explicit reduced-motion handling. Loaded after legacy layout rules for incremental migration rather than a risky wholesale rewrite.
- Public discovery: book-inspired hero with a defined soft stage; distinct grade accents, stronger grade numerals, publication badges and exact backend prices; compact support/footer; both support numbers, studio/logo and related sites retained.
- Checkout: selected-product cover and device binding, independent coupon row, contrasting sticky desktop order summary, largest monetary treatment for exact payable total, prominent simulation disclosure and clear primary action. Coupon removal requests a new server quote; edited coupons cannot create an order until rechecked. Mobile order puts totals before supplemental explanations; nothing is covered by a bottom overlay.
- Order receipt: restrained symbols and labeled treatments for ready/confirmed, pending/unknown, failed/review; public identifier copy action and accessible completion feedback. Payment timeout never means revocation or ordinary failure. Original state machine and server decision remain authoritative.
- Admin: permission-aware task groups for both workspace navigations, exact active query-section state, structured filters, table/status styling and internal table scrolling. Four money metrics distinguish net orders, gross, discounts and gateway captures; five smaller operational counts replace competing oversized cards. Loading no longer temporarily claims zero revenue. Empty payment-state reports say so explicitly.
- Editors: descriptive configuration/quota groups, full-width reason field, internally scrolling fields and persistent Save/Cancel footer. Existing native focus containment, Escape and return focus retained; narrow-height keyboard tests remain intact.
- Public loading uses stable skeleton geometry and a polite status. Custom Persian validation, error summaries, Origin/CSRF protections and sensitive-response cache policy remain unchanged.

Changed implementation files: `apps/web/nuxt.config.ts`; `app/assets/css/premium.css`; `app/components/{AdminConsole,CommerceConsole,CommerceOrder,LoadState,ProductCard}.vue`; `app/pages/checkout.vue`. Tests: `tests/e2e/{commerce,premium}.spec.ts`. CI only extends screenshot artifact collection. Documentation adds `docs/YARIZAN-WEB-DESIGN-SYSTEM.md` and this section. No backend financial service, API contract, generated client, migration, desktop artifact or release gate changed.

### Requirement status

| Area | Status | Evidence/limit |
| --- | --- | --- |
| Shared tokens, Persian typography, surfaces, actions | Implemented | Shared layer; approved local 400/700 font |
| Homepage, catalog, product detail | Implemented | Real catalog, grade accents, truthful availability |
| Premium checkout/coupon/summary | Implemented | API-calculated integer amounts, server requote on removal |
| Payment status, receipts, orders | Implemented | Original authority; public-ID copy only |
| Customer login, Connect, security/support presentation | Implemented | Shared control/layout/validation styling; auth unchanged |
| Admin navigation, tables and finance hierarchy | Implemented | Same ten supported commerce routes, RBAC preserved |
| Long editor actions and keyboard reachability | Implemented | Native dialog with separate field scroller/footer |
| Five widths, enlarged presentation, reduced motion | Implemented | Automated browser coverage and screenshots |
| WCAG 2.2 AA target | Partially Implemented | Axe/keyboard/contrast checks; full expert/screen-reader audit not claimed |
| Physical mobile / Safari / Firefox acceptance | Not Started | Windows Edge and CI Chromium only |
| Live checkout/signing/SMS/deployment | Blocked | Existing gates intentionally remain closed |

### Before/after review

| Screen | Before | After |
| --- | --- | --- |
| Checkout | [Original](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4/02-checkout-summary.png) | [Product and summary hierarchy](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4-premium/02-checkout-summary.png) |
| Mobile checkout | [Original](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4/15-mobile-checkout.png) | [Compact flow](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4-premium/15-mobile-checkout.png) |
| Finance | [Original](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4/14-admin-financial-overview.png) | [Money versus operational counts](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4-premium/14-admin-financial-overview.png) |
| Mobile editor | [Review baseline](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4/18-coupon-actions-390.png) | [Grouped fields and persistent actions](https://github.com/osameh15/YariZan/blob/30ffa0580f6f743ee4d5241585b584d1dad6ef1a/docs/Images/phase4-premium/18-coupon-actions-390.png) |

Historical Phase 3/3.1 screenshots generated by regression tests are restored rather than overwritten. All new evidence uses synthetic accounts and actual API-backed application pages, not mockups. The finance-unavailable screenshot deliberately injects an HTTP 503 for the negative UI test; it does not claim a real service outage. Finance values can differ between screenshots because each runs against isolated test transactions; values are not fabricated for appearance.

### Screenshot inventory

`docs/Images/phase4-premium/` contains:

- `20-home-1440.png`, `20-home-390.png`, `21-catalog.png`, `01-grade-one-purchase.png`.
- `02-checkout-summary.png`, `15-mobile-checkout.png`, `03-coupon-accepted.png`, `04-coupon-rejected.png`, `28-checkout-enlarged.png`.
- `05-simulated-gateway.png`, `06-payment-verification-pending.png` (UNKNOWN), `07-verified-purchase.png`, `16-mobile-payment-result.png`, `09-order-detail-license.png`.
- `26-customer-dashboard.png`, `08-customer-orders.png`, `22-otp-login.png`, `23-connect-validation.png`.
- `27-admin-dashboard.png`, `14-admin-financial-overview.png`, `10-admin-orders.png`, `11-admin-payments.png`, `12-admin-campaigns.png`, `13-admin-coupon-editor.png`.
- `18-coupon-actions-{1440,390}.png`, `19-coupon-keyboard-{1440,390}.png`, `24-mobile-navigation.png`, `17-accessible-validation-error.png`, `25-friendly-error.png`, `29-finance-unavailable.png`.

### Validation and limitations

Executed on Windows NT 10.0.26300, Node 24.20, .NET SDK 10 targeting .NET 9.0.20, PostgreSQL 17.11, Nuxt 4.6.1 / Vue 3.5.44 / Vite 8.3.4, local Edge 155; CI uses Chromium. No physical-device ownership or commercial hardware acceptance is claimed.

From `backend/`: `npm run build`; `npm test`; `npm run lint`; `npm run format:check`; `npm run check:contracts`; `npm run check:secrets`; `npm audit --audit-level=high`; `npx --yes @redocly/cli@2.63.0 lint ../docs/YARIZAN-OPENAPI-BACKEND-V2.json`; explicit synthetic test environment then `node tools/check-schema.mjs`; `node tools/check-runtime-env.mjs yarizan-backend-fixture` with the isolated Compose network. Backend: 158 passed, zero failures/skips. Migration comparison: five catalog groups match upgraded 001–008→009 versus fresh initialization. OpenAPI: 78 implemented routes/five desktop profiles, valid with two pre-existing lint warnings. Runtime dependency audit: zero vulnerabilities. Docker startup rejects missing/empty/invalid environment, production and live gateway modes; explicit development/test fake paths are checked.

Cross-language execution within backend/browser suites: DOTNET_INTEROP 24; DOTNET_API 10; software provisioning 25; Windows provisioning 26 (real CNG SOFTWARE provider and DPAPI CurrentUser). Windows PowerShell scripts `tests/Run-{V2,Access,Launcher,Book,Grade}Checks.ps1`: 300 + 27 + 8 + 36 + 5 = 376 passed checks/groups. NuGet vulnerability-feed availability warnings occurred locally; they do not establish a clean .NET dependency audit and are not suppressed.

From `apps/web/`: `npm run format`; `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm test`; `npm run contracts:check`; `npm run check:secrets`; `npm run audit:dependencies`; `npm run build`; `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`. Clear invalid inherited proxy environment only for local Nuxt build/typecheck. Unit tests: 18 passed. Browser execution results and final-head CI evidence are appended after the final run below. The new checks cover 360/390/768/1024/1440px, 200% CSS enlarged presentation, a constrained-height mobile menu, existing long-editor keyboard tests, RTL, custom validation, axe A/AA and supported WCAG 2.2 rules, console/hydration errors, API-backed navigation and exact large-safe-integer IRR rendering. CSS enlargement is not claimed as physical-device or browser-chrome zoom acceptance.

The first new visual test incorrectly classified its intentionally requested 404 as an unexpected console failure; the assertion now permits only that exact expected 404. A subsequent all-navigation run exposed an in-flight previous response during full-page navigation; tests now wait for explicit loading completion before moving sections. These corrections do not remove API status/body assertions. No production error is silently suppressed.

From root: `docker build --progress=plain -f apps/web/Dockerfile -t yarizan-web-review .`; inspect production and Docker logs for unsupported BigInt/es2019 warnings (none). ES2022 targets remain explicit. `python tools/Check-PublicRepository.py` passes. Web runtime high/critical vulnerabilities remain zero; full build audit continues to report unpatched build-only braces GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv. No new package or suppression was added.

Financial/security regression coverage remains in the real PostgreSQL suite: 20-way coupon contention, duplicate/reference replay, paid signing failure, worker leases/restart, late payment after quota release, exactly-one fulfillment, generation reset and SKU restrictions. Browser provisioning still never receives device credentials. Paid offline access and online-start-only trials retain their real C# verification/regression evidence.

Known visual limits: legacy illustrative CSS is incrementally overridden rather than fully tokenized; wide financial tables intentionally scroll inside a bounded region; screen-reader/manual full WCAG certification and physical iOS/Android acceptance remain outstanding. Live merchant, payment/refund, SMS, physical ownership assurance and commercial signing custody remain blocked exactly as before.

### Safety

No merge or deployment. Main, production servers, DNS/Traefik, PHP/MySQL, real customer/financial data, live ZarinPal/MeliPayamak, commercial signing keys and release gates are unchanged. Local Compose services are disposable and restored for review after managed browser tests. PR #4 remains Draft and unmerged.


### Premium pre-CI local execution

Initial premium source run: **18 unit / 37 browser tests passed; zero failures or skips**. The final browser suite took 2.0 minutes and includes actual C# provisioning. All five responsive widths, enlarged presentation, custom validation, public/Admin axe checks, coupon removal/requote and finance unavailable/recovery checks passed. Production build 26.4s and final Docker image build passed with zero BigInt compatibility warnings. Typecheck, lint, format, OpenAPI/client and secret checks passed. 32 actual screenshots are committed in the premium evidence directory. No screenshot depends on a browser-claimed payment success; the successful receipt is backed by verified synthetic payment and exactly-one license fulfillment.

Implementation commit: `873992896506828e078844b2803a4226c9932f78` (presentation and design-system reference). Subsequent acceptance/report commit contains the browser changes, artifact configuration and 32 screenshots. CI links are recorded in the following delivery evidence after push. All safety and remaining commercial limitations above remain in force.


### Premium CI evidence

Acceptance checkpoint `7b5d284d445773113b2acbd329392d0190157447` contains all production source, tests and screenshot evidence. Its workflow references are [Backend 38822994297](https://github.com/osameh15/YariZan/actions/runs/38822994297), [Web/provisioning 38822994513](https://github.com/osameh15/YariZan/actions/runs/38822994513), and [Windows 38822994288](https://github.com/osameh15/YariZan/actions/runs/38822994288). The following documentation-only evidence commit changes no runtime source. Delivery verifies both these conclusions and final-HEAD workflows separately; exact final HEAD, final run links and clean-tree/Draft status are recorded in PR #4 and the final handoff. The report does not infer success from a workflow merely starting.


### Chromium CI timing correction

The first premium checkpoint web run completed 36/37 browser tests: the existing mobile-change regression timed out waiting for an OTP request. Investigation showed AccountSecurity offered actions while its verified-mobile response was still pending, temporarily assuming an unverified number and rendering required new-number/password fields. This was a real loading-state defect, not a reason to weaken the test or add retries. AccountSecurity now hides credential controls until actual security data arrives, presents a Persian loading state, and offers retry on failed loading. A deterministic held-response browser regression proves no premature action/form appears and that the released verified response selects MOBILE_OLD. Backend authorization is unchanged. Earlier checkpoint Backend/Windows runs passed; the failed Web run is retained as evidence, superseded by the corrected final workflows reported in PR #4/delivery.


Corrected local verification: **38/38 full browser tests passed (1.8m), 18/18 unit tests passed**, including deterministic account-security loading and both-number verification. The final public order-ID clipboard check and its error styling are additionally validated by rerunning the affected commerce file after rebuilding; this is a rerun of existing unique tests, not an inflated test count. The corrected final CI runs and exact delivery HEAD are linked in PR #4. AccountSecurity.vue and auth-31.spec.ts are additional changed files for this loading correction.


### Corrected implementation checkpoint

`f71c8c661d36691276c45aa19df1f0f9937d1c9f` includes the verified-data loading correction and public order-ID clipboard regression. Corrected workflow links: [Backend 38824178786](https://github.com/osameh15/YariZan/actions/runs/38824178786), [Web/provisioning 38824178776](https://github.com/osameh15/YariZan/actions/runs/38824178776), [Windows 38824178760](https://github.com/osameh15/YariZan/actions/runs/38824178760). Final delivery verifies these actual results and the following report-only HEAD separately; exact final-head conclusions/URLs are in PR #4 and the handoff. Final local affected-commerce rerun: 10/10 passed (49.2s), including clipboard readback of the public order ID. Latest production and Docker builds pass without unsupported BigInt warnings. Local preview restored at http://localhost:3200 with fake checkout only.

Follow-up commits: `8739928` presentation/system; `7b5d284` acceptance/gallery; `9ccc8d2` initial CI references; `f71c8c6` deterministic loading correction/clipboard regression; final documentation-only evidence commit. No source changed after the corrected checkpoint. All 32 screenshot files remain reviewable, and the old Phase 4 images are preserved for comparison. Working tree is checked clean and remote feature branch equality is checked at delivery; main and production are never modified.


## Support copy, Persian controls and screenshot audit follow-up

Continues the same feature branch/Draft PR from `345605794b25f936dd6d69dcb6b8120f69137392`. The support refund-guidance block contained literal ASCII question marks in committed source, not a font-rendering problem. It is replaced with Persian guidance consistent with the existing request/review-only refund boundary. Both support numbers remain; the recovery action has an explicit lower margin. Customer login/password/reset username fields use `YZ-...` as an LTR example; Admin login does not.

New reusable controls: `PersianDatePicker.vue` (Solar Hijri/Jalali calendar and custom local-time controls), `AppSelect.vue` (select-only keyboard combobox), `NumberStepper.vue` (custom plus/minus/editable spinbutton), and `useControlPopup.ts` (bounded popup placement). All existing web/Admin native date, datetime, select and number widgets are replaced. No extra package is installed. `shared/persian-date.ts` converts using Intl/UTC day keys while retaining the existing Gregorian ISO/local datetime API contract; `shared/decimal-input.ts` rejects rounding and exact-step violations before numeric DTO conversion. BigInt scaling preserves integer IRR limits and decimal Toman input intent. FormShell keeps Persian validation and routes errors/focus to visible composite controls. No API, database, financial state machine, signing rule, MFA/RBAC or desktop change.

Visual audit covers all 38 current premium-gallery images (historical before galleries are retained separately). Additional fixes found during inspection: toolbar sizing leaked into an invisible validation proxy and caused one-pixel RTL overflow; empty error nodes created grid gaps/filter misalignment; modal focus rings needed padding; a coupon error replaced the selected product title with a generic heading; customer counts briefly rendered before data completed; and failed finance reporting still displayed a misleading empty-payment claim. These are corrected without hiding document overflow or inventing cached financial totals. Invalid coupons can be cleared and requoted through the server. Modal screenshots now capture the actual viewport, not an artificial full-page extension beyond the native backdrop. Enlarged-layout evidence clears unrelated keyboard focus before capture. Long editor screenshots reset the correct internal scroller when showing the initial form.

New screenshots in `docs/Images/phase4-premium/`: `30-support-restored.png`, `31-mobile-support.png`, `32-persian-calendar.png`, `33-custom-dropdown.png`, `34-mobile-calendar-time.png`, `35-custom-steppers.png`. The existing 32 screenshots are refreshed from real synthetic API-backed flows. Public/customer/checkout/Admin/financial/error/keyboard/mobile states were inspected for text corruption, field/action separation, focus rings and clipped controls. The calendar/dropdown placement was refined after that inspection to avoid a tall blank toolbar and keep Save/Cancel accessible. This review does not claim that screenshots prove software is entirely free of defects or establish physical-device/full manual WCAG acceptance.

Validation uses the same Windows/Node/.NET/PostgreSQL toolchains recorded above. `npm test` now passes **30 unit tests** (previous 18 plus conversion, complete leap/ordinary-year round trips, invalid dates, exact decimal limits, Persian input, dropdown keyboard and required-control focus). The full browser suite passes **41 tests** with real API/PostgreSQL data: support copy/margin/placeholder, exact Gregorian filter submission, calendar keyboard/axe checks, dropdown selection, mobile time controls/stepper bounds and existing security/commerce/provisioning regressions. The first new-control run caught three narrow-screen overflow failures and one obsolete number-field locator; the overflow cause was fixed and selectors now address the actual custom roles. Assertions were not relaxed. Final affected-control/commerce runs and exact-head CI are checked at delivery and linked in Draft PR #4.

Commands from `apps/web`: `npm run format`; `npm run typecheck`; `npm run lint`; `npm run format:check`; `npm test`; `npm run check:copy`; `npm run contracts:check`; `npm run check:secrets`; `npm run audit:dependencies`; `npm run build`; `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`. After final focus/format refinements, affected browser files are rerun against a rebuilt production bundle rather than counted as additional unique tests. Root Docker build uses `docker build --progress=plain -f apps/web/Dockerfile -t yarizan-web-review .`; unsupported BigInt warning gates remain active. Backend/Windows code is unchanged; the final CI workflows repeat their existing acceptance suites rather than inferring results from an old head.

A new `tools/check-ui-copy.mjs` / `npm run check:copy` CI gate prevents recurrence of literal-question-mark/replacement-character corruption. No native validation bubbles are reintroduced. Backend/OpenAPI/client contracts remain unchanged. Production payment/SMS/signing and deployment gates remain closed. No merge, deployment, main change, live infrastructure, PHP/MySQL, real customer/financial data or production credentials are involved.

Final local follow-up verification: **30/30 unit and 41/41 browser tests passed**, zero failed/skipped (full browser run 1.7 minutes, production bundle). Typecheck, lint, formatting, generated OpenAPI/client comparison, copy-encoding guard and secret checks passed. Short pages now stretch the main region so the copyright footer has no stray paper band below it; a 1440x1400 browser assertion covers this. All 38 current screenshots were reviewed, including refreshed validation, mobile time entry and sticky editor actions. Final-head CI evidence is recorded in Draft PR #4 after push. No backend/desktop source or contract changed.

## Persian numeric presentation follow-up

Continues Draft PR #4 from `89aeda0557a0e6eaa1e9db6ea48db17720aee416`. Telephone text, mobile/OTP entry, masked numbers, outstanding Admin quota/count/revision values and display-only commerce references now use Persian digits. Device/profile/license identifiers retain ASCII. URLs, submitted model values, copied identifiers, passwords and cryptographic/activation proofs are untouched. No backend, migration, OpenAPI, signing or financial-authority changes. Reusable display helpers avoid parsing strings as numbers, preserving exact IRR values. Tests cover huge decimal strings, Arabic/Persian input normalization, phone/OTP display, ASCII model emission and device-username exceptions. The first full run found one obsolete English-digit masked-phone expectation (40/41 passed); that assertion now requires the Persian representation. Final full-run results and CI links are recorded in Draft PR #4. Commands: `npm run format`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`, formatting/contracts/copy/secret guards. The premium screenshot gallery is refreshed from these actual runs. No main/production changes, merge, deployment, live gateway/SMS or production keys.

Final local numeric follow-up: **32/32 unit tests and 41/41 Edge browser tests passed**, zero failed/skipped (full browser run 2.7 minutes). Typecheck, lint, production build, formatting, generated OpenAPI comparison, copy and secret guards passed. Refreshed actual screenshots show Persian phone/masked/financial figures; technical device/license identifiers retain English digits.

## Final asynchronous state-consistency review

### Scope and repository

The review cited `345605794b25f936dd6d69dcb6b8120f69137392`; implementation continues the actual latest reviewed feature-branch state `f3d11dfb966957c50026e9b8e1587af319d81be6`, preserving all subsequent Persian controls/digits and premium layout work. Same branch `feat/yarizan-v2-commerce`, [Draft PR #4](https://github.com/osameh15/YariZan/pull/4). Only `apps/web/app/pages/checkout.vue`, `apps/web/app/components/CommerceConsole.vue`, `apps/web/tests/e2e/commerce.spec.ts` and this report change. API/OpenAPI, backend, SQL, desktop and signed artifact contracts are unchanged. No new dependency.

### Finding 1: checkout quote ownership

Checkout snapshots the trimmed submitted coupon before awaiting the server and associates its result with a monotonically increasing quote generation. Editing the input synchronously invalidates the generation and clears the accepted quote, including A -> B -> A edits. Starting another quote also invalidates prior work. Stale successes, failures, authentication redirects and finally blocks cannot update current presentation or loading state. Order creation checks the current accepted quote and matching input inside its handler, snapshots the accepted coupon, and prevents coupon edits/requotation during submission. The original order request idempotency key is retained. All totals and discount validity remain server-authoritative; no new client calculation or coupon rule is introduced.

### Finding 2: Admin request ownership

Each list/report load captures section, search, state, date bounds and offset before the session request. Section changes and synchronous draft-filter edits invalidate previous generations. Current-only checks follow both awaited API calls and guard catch/finally. An old request cannot populate rows/report/pagination, overwrite a newer message, redirect on a stale authentication failure, or clear a newer loading state. Unsupported sections still use controlled Persian feedback after session authorization. Scope disposal invalidates work; existing useApi lifetime cancellation remains intact. RBAC/MFA/CSRF/Origin checks are unchanged.

### Deterministic acceptance

Eight additional API-backed browser regressions hold real synthetic-backend responses with explicit promise barriers rather than timing sleeps: coupon A edited to B with reverse completion and an order-body assertion; stale coupon success after a newer error; stale coupon failure after a newer success; old payments completion while newer orders remain loading; old payments success after newer finance totals; old payments success after a newer finance error; old payments failure after newer finance totals; and filter editing/requotation of the exact latest search query. Existing backend financial, provisioning, security, supported/unsupported navigation and desktop acceptance remain enabled.

The initial affected run passed 15/17: one pre-existing login automation attempted interaction before hydration, and an intercepted Admin request replay was correctly rejected by CSRF/Fetch Metadata validation. Login helpers now await Vue mounting; test-only replay preserves the original session/CSRF headers with the exact local Origin, addressing APIRequestContext Fetch Metadata differences without modifying application security. A targeted rerun of all five Admin race/filter tests passed. Deliberately injected 503 responses remain test-only negative cases. No secrets are logged.

Commands from `apps/web`: `npm run format`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run contracts:check`, `npm run check:copy`, `npm run check:secrets`, `npm run build`, `PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/e2e/commerce.spec.ts`, and final `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`. Environment/toolchain matches the Windows/Node24/PostgreSQL17/.NET evidence above. Final local counts, checkpoint/final-head CI links and source hashes follow below/are pinned in Draft PR #4. Generated screenshot changes from regression runs are not included: this is a state-consistency patch, not another visual redesign.

No main changes, merge/deployment, live ZarinPal/MeliPayamak, real customer/financial data, production/commercial signing keys, PHP/MySQL, DNS/Traefik or infrastructure changes. Commercial gates, offline perpetual licensing and online-start-only trial behavior remain unchanged. Physical-device/manual browser accessibility and merchant-specific production dependencies retain their existing limitations.

Final local asynchronous-review acceptance: **32/32 unit tests and 49/49 full Edge browser tests passed**, zero failures/skips; full browser run 2.7 minutes. The eight new regressions are included in 49, not added again from targeted reruns. Typecheck, lint, formatting, generated OpenAPI/client check, copy/secret guards and production Nuxt build passed (56.1 seconds). Backend and Windows source remain unchanged; CI repeats their full acceptance suites at the final pushed head.

### Async review CI references

Implementation checkpoint: `05db6ab3b8f12c8da4df13862e361d7dd1ced2b0`. Workflow records: [Backend](https://github.com/osameh15/YariZan/actions/runs/38896794710), [Web/provisioning](https://github.com/osameh15/YariZan/actions/runs/38896794729), [Windows](https://github.com/osameh15/YariZan/actions/runs/38896794802). This following commit only records report evidence. [Final-HEAD checks for Draft PR #4](https://github.com/osameh15/YariZan/pull/4/checks) tracks the exact latest head, including this report-only commit; the PR description and final handoff pin the final SHA, actual completed conclusions and individual final run URLs after verification. Workflow creation is not treated as a passing result. The local results above are executed, not planned. Generation guards ignore superseded backend reads rather than aborting each read; existing useApi 15-second timeouts and scope-disposal cancellation still bound request lifetime.
