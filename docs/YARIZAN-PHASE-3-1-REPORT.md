# YariZan Phase 3.1 engineering handoff

Status: implemented for independent review in Draft PR #3. No merge/deployment. Live SMS acceptance and commercial startup remain blocked; there is no production-ready override.

## 1. Repository state

Repository osameh15/YariZan; branch `feat/yarizan-v2-nuxt-portals`; worktree `YariZan-Web`. Latest reviewed Phase 3 baseline verified against the open Draft PR before editing: `79a0e34c87b4e6ebb1388c4ecdfd521adac29a4d`. Main remains `e7af35f1771c7d85277aea338a26c957176adb85`. Initial tracked working tree was clean. Original worktrees and ignored local fixtures were preserved. Codebase-memory index/coverage returned Transport closed; source reads and searches were used, without claiming graph completeness.

[Draft PR #3](https://github.com/osameh15/YariZan/pull/3). Follow-up checkpoints: `ba8998c` backend SMS/OTP/notes authority and regression tests; `ce570a0` OTP-aware local pairing harness; `94f56f3` custom Persian forms, customer/Admin flows, note UI and browser tests. Subsequent configuration/evidence commits are listed in the PR. Final delivery HEAD and final CI links are recorded in the publication section/PR after validation; a report cannot contain its own commit hash. The final worktree is committed/clean and pushed, with no force-push or main changes.

## 2. Architecture and changed files

The existing Nuxt 4/NestJS/PostgreSQL modular monolith is retained. No frontend/backend directory move, new service, Redis, SDK dependency or microservice. `src/YariZan.Core/V2` and production WPF/Lock files have no Phase 3.1 diff. Only the test-side C# browser-approval helper was updated to obtain an OTP from an encrypted fake delivery fixture. Desktop signed claims/roots/key ACLs/transport and offline access remain unchanged.

Backend additions: accounts/otp.ts (purpose-bound proof authority), sms.ts (provider abstraction, fake and fixed-endpoint MeliPayamak adapter), auth-flows.ts (customer/Admin actions), read-fake-sms.ts (explicit local synthetic operator view), admin/notes.ts (RBAC/revision/FK authority). Controllers, schemas, configuration, Admin reset, signing-independent account/session handling, seeds, migration 008, OpenAPI generator, bootstrap/harness and integration tests are updated.

Nuxt additions: shared FormShell/ApiNotice, AuthAccess for password/OTP/Admin/reset, AccountSecurity, support-reset fallback route and auth-31.spec browser tests. Connect, existing account/Admin screens, terminology, route errors, CSP/private-response boundary, browser proxy allowlist and generated API types are updated. Dialogs are centered explicitly because CSS reset had displaced native desktop dialogs; focus/keyboard handling remains native and tested.

Configuration/docs: .env.example, Compose explicit SMS fields, web CI screenshot artifacts, README guides, ADR-0007, Auth/SMS contracts, this report and 25 application screenshots. Use `git diff --stat 79a0e34..HEAD` for the exact final inventory.

## 3. Requirement matrix

| Requirement | Status | Evidence/limit |
|---|---|---|
| A custom validation and errors | Implemented | All forms use novalidate FormShell, Persian inline/summary/ARIA/focus, safe API notices, retry/disabled states and custom route errors |
| B1 first claim by mobile OTP, optional password | Implemented | Pairing/phone proof bound to captured machine generation; atomic initial browser session and safe receipt; no password required |
| B2 independent password and OTP login | Implemented | Two UI choices, generic username/mobile challenge receipts, one-time verification/session |
| B3 password set/change | Implemented | Existing verified-mobile proof, no locks across Argon2, final session/stamp recheck and all browser sessions revoked |
| B4 mobile self-service reset | Implemented | OTP-based primary reset; independent support fallback for lost number/legacy accounts |
| B5 mobile management | Implemented | Masked display; old and new phone proofs; legacy password accounts need current password plus first-number OTP |
| B6 sessions/rate/audit | Implemented | HttpOnly cookies, exact Origin, CSRF, rotation, purpose/session/generation binding, counters and audit |
| C SMS Admin MFA | Implemented | Password admission then SMS, no TOTP acceptance/fallback; recent MFA/RBAC preserved |
| C MeliPayamak live delivery | Blocked | Real credentials, approved one-variable pattern, credit/service permissions and authorized acceptance test missing |
| D notes per primary record | Implemented | Customers/devices/licenses/codes/trial counters/products; revisioned text, preview/editor, real parent FKs and audit |
| E Persian terminology/content | Implemented | Clear purchase-license, activation-code, block/reset/recovery actions and consequences; OTP/support/optional-password guidance rewritten |
| F broader search | Implemented | Username/record/profile IDs, SKU, note text and exact normalized phone; escaped literal queries and bounded pages |
| G consistent RTL design | Implemented | Existing local assets/fonts, accessible forms/dialogs, responsive browser evidence |
| H desktop/offline/signing invariants | Implemented/preserved | Browser never gets device bearer/certificate; C# verifier/transport and Windows regression pass |
| I database/API/env | Implemented | Additive 008, strict DTOs, 60 implemented routes, generated client drift validation and explicit provider configuration |
| J automated tests/CI | Implemented | Exact final runs below; no real SMS/physical phone acceptance claimed |
| K fresh screenshots | Implemented | 25 implemented-app captures, including every requested auth/notes/error/mobile category |
| L report/contracts/ADR | Implemented | This report, Auth/SMS contracts and ADR-0007 committed |
| Production/hardware assurance | Blocked | Existing commercial gates remain closed; SMS does not establish genuine physical device ownership |

## 4. Database and transaction design

Migration `008_mobile_otp_and_notes.sql` is additive; 001-007 are unchanged. Phone ciphertext is AES-256-GCM under a dedicated key; masked last-four and verified timestamp are consistent under a CHECK. Domain-separated HMAC lookup has an active-customer B-tree index. A family phone can serve multiple device accounts, disambiguated by public username.

OTP rows store only keyed code verifiers and encrypted phones. They have real customer/Admin/pairing foreign keys via generated typed columns, bounded attempts, purpose/binding/generation checks and a database-enforced maximum five-minute lifetime. Unknown username/mobile combinations create non-deliverable decoy rows. Login/reset cooldown keys are phone/purpose-only for known and unknown accounts, preventing a bucket-difference enumeration oracle. Fresh proof issuance retires older unused proofs for the same purpose/principal or pairing, including a changed proposed phone.

New active customer inserts require verified mobile. Migrated password accounts can attach their first phone after current-password proof and OTP; a flag distinguishes that migration case. Migration revokes existing Admin sessions, adds explicit SMS session provenance and constrains legacy TOTP sessions to already-revoked state. Security queries accept only SMS sessions. Rolling back to a pre-008 binary is not supported.

Argon2id work runs after cheap pairing/OTP/scope admission without PostgreSQL row locks. Final account creation/change rechecks pairing code, expiry, owner, device generation, customer stamp and authorizing session atomically. OTP consumption and session/business effects commit together under locks. Wrong attempts commit independently before errors are returned, so retries cannot roll back the attempt budget. Mobile replacement consumes both proofs in sorted lock order. Password/mobile changes revoke customer browser sessions, without revoking perpetual desktop licenses or active trial processes. Customer Admin reset also clears operational phone data, while preserving mandatory history and durable SKU bans.

Notes have one typed row per primary identifier, 0-2000-character text and safe integer revision. Generated FK columns reference customers/devices/licenses/activation codes/products or the exact trial counter composite key. Empty text clears the visible note but advances history/revision. The actor/type/revision is audited without copying note content into logs. Notes survive customer tombstoning. GIN trigram indexes cover note text, usernames and UUID text. Offset/limit remain bounded and deterministic. Cross-entity joins and very short search terms can still scan; no production-scale performance claim is made.

Migration checksums/ordering and fresh PostgreSQL catalog drift comparison pass. Safe recovery is roll-forward; back up disposable data before applying. Do not edit applied migrations, downgrade to password-first/TOTP code, drop history or import live MySQL. Production backup/key rotation/retention procedures remain separately reviewed operations.

## 5. API and user flows

Full request/response table: [Auth and SMS contracts](YARIZAN-AUTH-AND-SMS-CONTRACTS.md). Generated implemented OpenAPI contains 60 controller routes and the unchanged five desktop artifact profiles. Frontend types are generated and drift checked.

First claim: desktop proves its CNG key and creates a five-minute pairing; browser previews ID/code, verifies mobile OTP and approves without a required password. The browser receives status, username, expiry, authenticated:true and first-claim csrf_token, with the customer session in an HttpOnly cookie. Initial session creation commits with the account/OTP/pairing; existing-owner approval preserves its current session. Fresh device-key CONFIRM pickup alone delivers enrollment/bearer; AUTH renewal/recovery remains desktop-only. Existing-owner approval for additional Windows profiles uses the existing cookie/CSRF, shared machine and trial budget. No browser proxy route forwards desktop challenges, pickup, bearer auth or private key material.

Customer login defaults to username/mobile OTP; username/password remains an independent alternative. OTP reset is primary at /reset-password. Security shows masked mobile and password status, supports password set/change and both-number verification, and closes sessions after changes. Support-grant reset is explicitly separate at /support-reset for independently verified exceptional recovery. No email, fabricated SMS confirmation or username/HWID-only support authorization.

Admin login is now primary password, then a fresh random SMS challenge, then session creation. TOTP DTOs are rejected. SMS MFA controls the recent-authentication clock; RBAC, exact Origin, CSRF, role filtering, reason/evidence, request IDs and optimistic revisions remain in force. Notes additionally require notes.manage and the entity's existing read permission. Notes cannot become an alternate route to another record's privileges.

Forms use custom Persian messages for required/format/length/range/mismatch, expired/replayed OTP, wrong login, rate/session/CSRF failure and unavailable services. Focus moves to the first invalid field, error text sits outside the label and is linked by aria-describedby, and inline space is reserved. This prevents error text from changing the input's accessible name. Native validation popups are disabled. API errors are mapped, never raw framework/English text. Modal placement/focus/keyboard, mobile overflow and public-page axe checks pass.

Terminology now explains the operation: registering a purchased license for a device, creating an activation code, recovering a purchased license, revoking license validity, restricting one grade and resetting operational account access. Destructive reset copy explains phone/password/session/access removal, fresh generation, preserved history/bans and the impossibility of instant revocation on a permanently offline desktop. Support content now describes verified mobile and optional password accurately.

## 6. MeliPayamak assumptions and local path

Provider abstraction is injected outside business logic. The implementation uses the vendor's fixed HTTPS BaseServiceNumber pattern endpoint with form fields username/password/to/text/bodyId, one approved OTP variable `{0}`, TLS verification, no redirects, ten-second timeout and 8 KiB response cap. Success requires HTTP success, RetStatus=1 and a positive receipt Value. Tests inject a transport; no vendor SDK/network request is used in CI.

Required live settings: SMS_PROVIDER=melipayamak, MOBILE_ENCRYPTION_KEY, OTP_HMAC_KEY, MELIPAYAMAK_USERNAME, MELIPAYAMAK_PASSWORD, approved MELIPAYAMAK_BODY_ID and SMS_ALLOW_LIVE=true. All cryptographic keys are independent. Missing selected-provider configuration refuses startup; disabled SMS refuses issuance/verification while independent customer password login still works. Production mode remains unconditionally closed even with complete SMS settings. No live credentials, key custody or production configuration are included.

Live blockers: real provider credentials/API entitlement, approved security/service template with at least `{0}`, exact template-variable/receipt validation, account credit and operator authorization for a live test. No real SMS was sent. SMS is susceptible to SIM swap/interception and is not phishing-resistant; this requested factor requires independent production risk acceptance. Mobile verification does not fix fingerprint preemption or hardware ownership assurance.

Fake mode is explicitly development/test-only. It records deterministic observable test delivery in memory; optional fixture delivery is encrypted under the synthetic local phone key, never an API mailbox. Local operator command `node --env-file=.env dist/src/accounts/read-fake-sms.js` (or Compose exec) shows only a current unused/unexpired synthetic code and masked target. This is explicit test delivery inspection, not application logging or real-provider code exposure. The OTP-aware pairing harness uses only explicit fake configuration and prints no code/credential/private key.

Delivery reserves 20 total in-process slots, uses a FIFO with four concurrent sends and rejects excess admission uniformly before persistence, with generic receipts independent of provider timing. Expired/superseded queued proofs are skipped and audited. No automatic retry follows an ambiguous timeout. Process interruption/failed delivery requires a fresh challenge after cooldown; durable carrier reconciliation is not claimed. Provider acceptance is not handset delivery. Key custody/rotation, re-encryption/blind-index migration, maintenance/retention and production delivery reliability remain reviewed deployment dependencies.

## 7. Executed local validation

Windows 10.0.26300.0; Node 24.20.0; npm 12.0.2; .NET SDK 10.0.401 targeting .NET 9 runtime 9.0.20; PostgreSQL 17.11 on Docker Desktop; Microsoft Edge 155.0.4283.45 (Chromium). CI uses isolated PostgreSQL 17, Node 24, .NET 9 and Playwright-managed Chromium.

Commands below were executed from the stated directory. All databases/keys/accounts are disposable and loopback-only.

| Directory/command | Result |
|---|---|
| backend: npm run build / lint / format:check | Pass |
| backend: npm test (DATABASE_URL ending yarizan_phase2_test) | 129 tests passed; zero failed/skipped/cancelled |
| backend: NODE_ENV=test node tools/check-schema.mjs with synthetic secrets | Eight migrations; five catalog groups match fresh PostgreSQL |
| backend: npm run check:contracts | 60 routes; five desktop profiles; pass |
| backend: Redocly 2.63.0 lint implemented OpenAPI | Pass; two expected no-2xx warnings for intentionally retired HTTP-410 routes |
| backend: npm run check:secrets / public scanner / npm audit --audit-level=high | Pass; backend dependency audit zero |
| apps/web: npm run contracts:check / typecheck / lint / format:check | Pass |
| apps/web: npm test | 14 unit/component tests passed |
| apps/web: npm run build | Nuxt production SSR/output build passed |
| apps/web: PLAYWRIGHT_CHANNEL=msedge npm run test:e2e | 25 browser tests passed; latest run 1.2 minutes; CI Chromium 47.1 seconds |
| apps/web: npm run audit:dependencies | Runtime zero; same two unpatched build advisory roots explicitly reported |
| apps/web: npm run check:secrets | Pass |
| root: docker build -t yarizan-backend-fixture backend | Pass |
| backend: node tools/check-runtime-env.mjs yarizan-backend-fixture with explicit synthetic keys/local network | All six mode checks pass; production/missing/invalid refused, development/test ready and graceful shutdown |
| root: git diff --check / python tools/Check-PublicRepository.py | Pass |

Backend test assertions include real C# verifier24, API/controller10, provisioning24 software-adapter checks and actual Windows CNG SOFTWARE/DPAPI25. These are assertions within Node test cases, not additional Node tests. The combined browser/C# flow also executes 25 actual Windows checks locally while only the browser approves the SMS claim; Linux CI uses 24 labeled software-adapter checks. No TypeScript-only compatibility claim.

Windows regression executed: `& tests/Run-V2Checks.ps1`, AccessChecks and LauncherChecks; `powershell.exe -NoProfile -File tests/Run-GradeChecks.ps1`, and BookChecks. Results: 300 V2, 27 access, 8 launcher, 5 grade groups and 36 book = 376 checks/groups passed. Local token is non-elevated, Administrators group disabled, TPM-preferred baseline selected TPM, and forced SOFTWARE/DPAPI paths passed. Actual clipboard round-trip ran. An initial combined PowerShell 5 redirection treated an expected negative grade subprocess stderr as terminating; the unchanged standalone grade script passed all five groups. Local NU1900 vulnerability-feed network warnings are retained, not called a clean NuGet audit.

Browser tests cover all auth methods/OTP-only claim/password set/change/reset/both-number mobile change, no native validation, Persian field/server/404 errors, first-invalid focus, six public/mobile/tablet/desktop layouts, dialog placement/Escape/focus, SMS Admin login, note create/edit/search/stale revisions, session expiry/rotation/CSRF/Origin, role denial, code plaintext once, customer reset/bans/trial epochs, product revision changes, SSR private-payload isolation and browser exclusion of device credentials. Public-page axe A/AA/2.1AA and custom-error forms checks report zero violations. This is automated evidence, not a full manual assistive-technology audit.

Security negatives cover decoy/unknown requests, phone-only public cooldown (both request orders), wrong/expired/replayed OTP, persisted attempt exhaustion, parallel one-time login, foreign pair/customer/session scope, stale generation, password/mobile session revocation, disabled/provider-failed SMS, old TOTP rejection, new-account mobile DB constraint, legacy-session DB constraint, scoped note writes, nonexistent parents and all six note types. Existing concurrent trials/code redemption and no-heartbeat/offline tests stay green.

Ignored logs: backend/.local/31-*.log and apps/web/.local/31-*.log. Durable final CI evidence and artifact links are appended below/PR. Nonfatal local build warnings include third-party Rollup annotations and NuGet feed availability; no failed check is hidden as a pass.

## 8. Fresh screenshots

All images are from the implemented Nuxt production build with real isolated PostgreSQL/API fixtures, not mockups. They contain synthetic users/mobiles and no desktop bearer, enrollment, OTP or password values.

| Required evidence | File under docs/Images/phase3-1 |
|---|---|
| Connect custom field errors | 12-connect-validation.png |
| First-time mobile setup | 13-first-claim-mobile.png |
| First-time OTP step | 14-first-claim-otp.png |
| Account security/password status/masked phone | 15-account-security.png |
| SMS Admin MFA step | 16-admin-sms-mfa.png |
| Password login | 17-login-password.png |
| OTP login | 18-login-otp.png |
| Admin note preview/list | 19-admin-note-list.png |
| Search by Persian note text | 20-admin-note-search.png |
| Full note detail/editor | 21-admin-note-detail.png |
| Custom server/revision error | 22-custom-server-error.png |
| Mobile OTP viewport | 23-mobile-otp-login.png |
| Friendly real 404 | 24-friendly-not-found.png |
| New-number verification | 25-mobile-number-verification.png |

01-11 also refresh homepage/catalog/product/Connect/customer/Admin/products/devices/licenses/mobile navigation/dialog evidence. Historical Phase 3 images remain separate. Screenshot review checked the custom validation and centered note dialog; no stock photos or remote assets were added.

## 9. Security findings, limitations and non-goals

Resolved during implementation: principal-dependent public cooldown could distinguish account matches; public login/reset now use the same phone/purpose bucket and a dedicated test covers both orders. Field error text had been inserted inside label, changing its accessible name; it now sits outside with aria-describedby. The security-page rewrite initially omitted the existing rotation action; it is restored and tested. Native dialog CSS reset displaced desktop modals; explicit centering plus a browser geometry check fixes it. New active accounts and SMS Admin sessions now have database constraints, not only controller checks.

Production gates still include physical first-claim assurance/fingerprint preemption/disputes, commercial signing custody/root approval/lifetime public-key retention, physical multi-profile/reboot/TPM-loss/offline-endurance acceptance, and separately approved infrastructure/support evidence/retention/backups/capacity. No external phone, live provider, real payment/SMS customer, production signing key or live customer data was used. SMS proof alone is not hardware attestation. No arbitrary cross-license-ID replacement, live payments/orders/refunds, production deployment or DNS migration is included.

Dependency residual remains from Phase 3: runtime web audit zero, full build tree 11 high affected nodes from two unpatched root advisories (braces GHSA-vfj7-8cjw-p6xm and node-forge GHSA-86w9-cpqp-85rv), zero critical. The policy gate explicitly reports only those known build findings and scans deployed output; it is not a clean full audit. No new dependency was introduced. See YARIZAN-PHASE-3-DEPENDENCY-FINDINGS.md. Independent commercial acceptance remains blocked pending upstream remediation/review.

## 10. Safety and publication

Unchanged: main, production/staging/live servers, legacy PHP/MySQL service/workflow, DNS/Traefik/firewall, real customer data, ZarinPal, real MeliPayamak account/services, production signing keys and live payment/refund infrastructure. No merge, deployment, force-push or production private-key generation. Work stays in the existing Phase 3 feature worktree/branch/Draft PR. Only named disposable local databases/containers and synthetic fixtures were used. Stop for independent review after final commit/push and passing CI.

## 11. Passing implementation-head CI and full Compose evidence

Tested implementation/documentation HEAD `9d0444a502c1cca163e5576291fbcc35c1d043d8`, pushed to the existing feature branch. All three workflows succeeded:

- [Backend CI 38753804609](https://github.com/osameh15/YariZan/actions/runs/38753804609), job `116486801402`: 129 tests, zero failures/skips; real C# verifier24/API10/provisioning24 on Ubuntu; eight-migration/five-group schema comparison; 60-route snapshot; lint/build/format/OpenAPI; 60-file backend secret scan/public scanner, zero backend dependency vulnerabilities; non-root Docker/no embedded key/native Argon2 and all six explicit runtime modes including production refusal.
- [Web/provisioning CI 38753804711](https://github.com/osameh15/YariZan/actions/runs/38753804711), job `116486801348`: 14 unit/component tests, 25 Chromium/PostgreSQL browser tests (47.1s), including 24 real C# software-adapter provisioning checks; strict type/build/lint/format/contracts, secret scan, explicit dependency policy and web Docker build. [Screenshots/HTML/dependency report artifact](https://github.com/osameh15/YariZan/actions/runs/38753804711/artifacts/11983011213). Full build audit remains nonzero as disclosed; runtime audit is zero.
- [Windows CI 38753804650](https://github.com/osameh15/YariZan/actions/runs/38753804650), job `116486800839`: 300 V2 plus existing 27 access/8 launcher/5 grade groups/36 book = 376 checks/groups; success. Hosted Windows 10.0.26100.0, .NET 9.0.21, elevated token/Administrators group and SOFTWARE provider. This is distinct from local non-elevated TPM-preferred/CNG SOFTWARE/DPAPI evidence.

Fresh local `docker compose --env-file backend/.local/demo.env -f backend/compose.yaml --profile web up --build -d` passed with explicit fake SMS and synthetic independent keys. Existing disposable local data rolled forward from 007 to 008; no live data. A guarded ignored Node smoke script asserted SSR RTL, six real API products, production_gate:closed, operator-only encrypted fake delivery, primary Admin admission without a session, and SMS verification yielding an HttpOnly Admin cookie. No OTP/password/bearer was printed or placed in app logs. A new synthetic local review Admin was created; access notes remain ignored. Log: backend/.local/31-compose-smoke.log. The full browser/backend/C# claim/pickup flow is separately covered above.

The final evidence-only commit corrects remaining historical README wording, records these CI/Compose results and triggers all three workflows again. Exact final HEAD/run links and clean-tree status are recorded in Draft PR #3 and the delivery response. No runtime changes follow the passing implementation head. Main remains e7af35f1771c7d85277aea338a26c957176adb85. Nothing was merged or deployed.

## Footer and support-reset review follow-up

Added the owner's additional public contact number (0936-964-2754), retained the existing support number, and linked OAR Nova Games Studio (oarnova.games) and the developer website (osameh.dev) in the shared footer. Reused the existing Windows studio logo as a local asset. Support-assisted reset actions now use a wrapping flex row with explicit gaps and top margin.

Validation: web ESLint passed; Prettier applied to all three changed source files; git diff --check passed; local Docker Nuxt production build and container restart passed. A real headless Edge check verified footer destinations, loaded studio logo, separated reset actions and no horizontal overflow at 1280px and 390px. Screenshots: 26-support-reset-1280.png and 26-support-reset-390.png. No authentication, licensing or production behavior changed.

Footer refinement: retained the studio PNG's existing alpha transparency, removed the CSS white background, and placed the logo to the right of its English studio name. Added the requested Persian site ownership statement and design/development credit wording. Refreshed desktop/mobile screenshots after the local production rebuild.

Footer contrast follow-up: placed studio/developer credits and copyright in a full-width dark brown band, preserving transparent logo rendering and vertically centered logo/text with the logo on the right. Removed copyright paragraph margins to prevent a light bottom strip. Added the second phone to the support page. Local Docker production build, changed-component ESLint and real Edge checks passed at 1280px/390px: dark background, logo/text center alignment within one pixel, no bottom gap, no horizontal overflow, and main-content phone link. Evidence: 27-support-footer-1280.png and 27-support-footer-390.png.

Copyright row refinement: all three desktop credit groups now share one vertically centered row (studio/logo, copyright, design/development). Studio logo uses an explicit 48px block box and unit line height to eliminate inline baseline spacing; logo remains on the right. Mobile wraps safely. Local Docker production build and ESLint passed; real Edge asserted three sibling groups, desktop group centers within one pixel, logo/text centers within one pixel and no mobile overflow. Screenshots: 28-footer-row-1280.png and 28-footer-row-390.png; desktop screenshot visually reviewed.


## 12. Independent review final fixes (reviewed HEAD 2074522)

Implementation starts from current clean feature HEAD b1475e7, preserving all intervening requested footer/contact changes. Reviewed 2074522 is an ancestor; no history rewrite. Checkpoints: badd739 (atomic first-claim sessions/bounded OTP admission) and 2875463 (OTP-default customer login/authenticated Connect). This section supersedes earlier receipt-only/no-initial-session and delivery-capacity descriptions. Current complete auth contracts are in YARIZAN-AUTH-AND-SMS-CONTRACTS.md.

### Finding-by-finding resolution

1. **Implemented:** first mobile claim consumes OTP, creates the account and initial eight-hour customer session, appends customer.login_claim and transitions pairing in one PostgreSQL transaction. Shared customerSession/sessionCookies helpers also serve existing password/OTP login and rotation. Cookies are set after commit: HttpOnly yz_customer, exact existing /api/v2 path, SameSite=Strict, configured Secure, readable synchronizer CSRF cookie and csrf_token. The JSON receipt adds authenticated:true and optional csrf_token, never session/desktop bearer/enrollment/key material. Existing-owner approval revalidates the owner's current session and does not create or replace one. Invalid/replayed/expired/cancelled/mismatched/consumed proofs cannot mint sessions. Three simultaneous same-pair claims plus competing first-claim tests produce one owner/initial session; forced audit failure rolls account/session/OTP/pairing back together. Connect offers /account directly; the browser E2E asserts exactly one claim OTP, zero LOGIN OTPs for that account and immediate authenticated dashboard access. Desktop pickup remains fresh key-proof-only.

2. **Implemented:** customer login defaults to OTP, shown first. Password remains an independent alternative; Admin still begins with password and then SMS MFA. Existing pressed-button group semantics and native keyboard activation are retained. Browser tests assert initial selection, keyboard Enter/Space switching, password completion, OTP-default login completion and Admin primary fields.

3. **Implemented:** bounded FIFO reserves 20 total in-process admission/delivery slots, including all decoys; at most four concurrent vendor calls. Excess/shutdown admission rejects explicitly with generic 503 SMS_UNAVAILABLE before challenge persistence. Every accepted request is enqueued, rather than silently dropped at four active calls. Matched and unmatched public requests use the same reservation/rate/receipt/error path and do not await vendor delivery. Workers check persisted expiry/used/superseded/delivered state immediately before dispatch, audit skipped/failing delivery and never automatically retry an ambiguous timeout. Graceful shutdown closes admission, audits queued interruption, drains active calls and only then closes PostgreSQL. Database teardown moved from module destruction to application shutdown; CLI/bootstrap/test callers use the renamed close hook.

No new migration, dependency, provider credential, endpoint, service or broker. Eight migrations and five signed desktop artifact profiles are unchanged. Implemented OpenAPI still has 60 routes; claim and confirm schemas now document browser session receipt fields and confirm's OTP input. Strict C# test receipt verification is updated without relaxing production desktop signed verification.

### Changed files

- backend/src/accounts/sessions.ts: shared transaction-local customer session creation and cookie writer.
- backend/src/accounts/accounts.ts, auth-flows.ts; backend/src/identity/identity.ts; backend/src/api/controllers.ts: session reuse, atomic claim and safe response.
- backend/src/accounts/otp.ts: bounded queue, uniform admission, stale checks and shutdown/failure handling.
- backend/src/database/database.ts, migrate.ts, seed.ts; accounts/read-fake-sms.ts; tools/check-schema.mjs, provision-admin.mjs; apps/web/tools/test-api.mjs: PostgreSQL closes after delivery drain.
- backend/test/integration.test.ts: seven new PostgreSQL/session/queue tests; existing safe-receipt expectations extended. Existing adapter/fake/MFA/security suites remain active.
- apps/web/app/components/AuthAccess.vue, pages/connect.vue; tests/e2e/auth-31.spec.ts, portals.spec.ts: OTP default, authenticated continuation and browser regressions.
- backend/tools/check-contracts.mjs, docs/YARIZAN-OPENAPI-BACKEND-V2.json, apps/web/shared/api.generated.ts; tests/BackendInterop/ProvisioningTransportChecks.cs: exact browser receipt contract updates.
- Auth/SMS contracts, this report and refreshed application screenshots, including 29-first-claim-authenticated.png and 30-login-otp-default.png. Both new images were visually inspected; neither contains OTP/session/desktop secrets.

### Executed local validation

Windows 10.0.26300.0; Node 24.20.0/npm 12.0.2; .NET SDK 10.0.401 targeting .NET 9/runtime 9.0.20; isolated PostgreSQL 17.11; Edge 155.0.4283.45. No external SMS or production services. Exact commands run from the named directory:

| Directory | Commands | Actual result |
|---|---|---|
| backend | npm run build; npm test | 136 passed; 0 failed/skipped/cancelled; 57.54s. Real PostgreSQL, 7 new review tests. |
| backend | npm run lint; npm run format:check; npm run check:contracts; npm run check:secrets | passed; 60 routes/5 desktop profiles; 61 tracked text files, no secret matches |
| backend | node tools/check-schema.mjs with explicit synthetic NODE_ENV=test/DATABASE_URL and three original synthetic keys | all eight migrations/five catalog groups match fresh disposable reference database |
| backend | npx --yes @redocly/cli@2.63.0 lint ../docs/YARIZAN-OPENAPI-BACKEND-V2.json | valid; two expected warnings for retired 410-only routes |
| apps/web | npm run contracts:check; npm run typecheck; npm run lint; npm run format:check; npm run build; npm test | passed; 14 unit/component tests |
| apps/web | PLAYWRIGHT_CHANNEL=msedge npm run test:e2e (PowerShell env assignment) | 26 passed, 0 failed, 53.9s; real API/PostgreSQL and C# browser callback |
| root | docker build -t yarizan-backend-fixture backend | passed; synthetic non-root image, no embedded signing key |
| backend | node tools/check-runtime-env.mjs yarizan-backend-fixture with RUNTIME_DOCKER_NETWORK=yarizan-v2-local_default and disposable RUNTIME_DATABASE_URL=postgresql://yarizan:local-disposable@db:5432/yarizan_phase2_test | missing/empty/staging/production refused; development/test migrated, seeded, ready, signing mode and graceful shutdown passed |
| root | powershell.exe -NoProfile -File tests/Run-V2Checks.ps1 | 298 passed/0 failed; two conditional physical clipboard round-trips NOT executed because OS clipboard unavailable. Injected clipboard/error checks passed. Non-elevated token, TPM-preferred selected TPM; no source change to Windows checks. |
| root | powershell.exe -NoProfile -File tests/Run-AccessChecks.ps1; Run-LauncherChecks.ps1; Run-GradeChecks.ps1; Run-BookChecks.ps1 (each via its own PowerShell process) | 27 access, 8 launcher, 5 grade groups, 36 book passed; 374 local checks/groups total including V2; two physical clipboard checks unavailable, distinct from hosted baseline 376 |
| root | python tools/Check-PublicRepository.py; git diff --check | passed |
| backend/apps/web | npm audit --audit-level=high / npm run audit:dependencies | backend zero vulnerabilities; web runtime high/critical zero; existing explicit build-advisory policy passes with disclosed unpatched findings, not a clean full build-tree audit |

The backend suite executed real C# verifier24/API10/provisioning24 (software adapter) plus 25 actual Windows CNG SOFTWARE/DPAPI checks. The browser suite separately executed the 25-check Windows CNG/DPAPI callback integration. These prove test-key interoperability and protected storage; no physical hardware ownership/commercial signing acceptance is claimed. Local logs remain ignored under backend/.local/review-final-* and apps/web/.local/review-final-browser.log.

During validation, the strict C# test initially rejected the intentionally extended receipt, a new rollback assertion initially expected HTTP500 rather than the existing sanitized503, and a password browser regression initially assumed the old default. Those tests were corrected to assert the new approved contract/default; full reruns above passed. An initial schema command omitted its disposable DATABASE_URL; rerun with explicit test configuration passed. These are not reported as successful initial runs.

Backend/web implementation CI on 2875463 passed (136 backend; 14 unit and 26 Chromium browser in 36.9s); Windows V2 checks passed and the workflow was finishing API lint at this evidence snapshot. Implementation CI is linked below; final evidence-only HEAD and its exact run links are recorded in Draft PR #3/final delivery after all workflows finish. No runtime changes are intended after this checkpoint.

- [Backend review CI](https://github.com/osameh15/YariZan/actions/runs/38764181479)
- [Web/provisioning review CI](https://github.com/osameh15/YariZan/actions/runs/38764181423)
- [Windows review CI](https://github.com/osameh15/YariZan/actions/runs/38764181366)

### Residual risks and safety

The queue is process-local and bounded, not a durable SMS outbox: abrupt process/database failure can lose a queued plaintext code or final delivery audit. Persisted undelivered challenges remain unusable; restart never resends old codes, and the customer must request a fresh challenge after cooldown. Already-dispatched vendor calls cannot be recalled if expiry/supersession occurs during the call. Provider acceptance is not handset delivery. No automatic ambiguous-timeout retry or production reliability claim. Commercial startup and real SMS remain closed; live MeliPayamak credentials/template/carrier acceptance, hardware first-claim assurance/disputes, production signing custody and physical Windows endurance acceptance remain blockers. Existing build-only dependency findings remain disclosed.

Main stays e7af35f1771c7d85277aea338a26c957176adb85. Production/staging/live infrastructure, PHP/MySQL, DNS/Traefik, real customer data, payment/SMS services and commercial signing keys are unchanged. No merge, deployment, force-push, live provider call or production key generation. Draft PR #3 stays Draft for independent review.

Local Compose was rebuilt and restarted with explicit fake SMS. `node --env-file=.local/demo.env .local/31-compose-smoke.mjs` passed SSR RTL/catalog/closed gate, primary Admin admission without session, encrypted synthetic SMS inspection, and SMS verification with HttpOnly cookie. The initial invocation without the env file refused the fake-provider guard; no live call was made. Preview remains local at http://localhost:3200.

Related-sites footer refinement: moved osameh.dev from the copyright/design credit into a new Persian related-links column alongside oarnova.games. Retained the studio name/logo and exactly centered copyright in the dark desktop row, with responsive wrapping. Future Chista/Dooma destinations are not invented. Docker Nuxt production rebuild and changed-component ESLint passed. Real Edge verified destinations, four desktop columns, no developer credit in the copyright row, copyright center and logo/text alignment within one pixel, and no overflow at 1280/800/390px. Screenshots: 31-related-sites-footer-1280.png, -800.png, -390.png.
