# YariZan V2 Phase 3 engineering report

Status: implemented isolated review foundation; independent approval required. **No merge or deployment. Commercial enrollment/startup remains closed.**

## A. Repository and evidence

Base/main: `e7af35f1771c7d85277aea338a26c957176adb85`, merged PR #2. Preflight fetched main, verified ancestry/merge and successful completed main CI [38703949800](https://github.com/osameh15/YariZan/actions/runs/38703949800); no running main workflow remained. Clean new worktree `YariZan-Web`, branch `feat/yarizan-v2-nuxt-portals`. Original worktrees/untracked brand files were preserved. Required source/docs/ADRs and implemented OpenAPI were inspected before changes. Codebase-memory index/coverage calls returned Transport closed; direct source inspection was used, without claiming graph coverage.

Focused checkpoints: `a23aea8` split provisioning/backend authority, `bd0271a` Windows provisioning, `e883715` Nuxt storefront/customer, `f3226ca` MFA/RBAC Admin. `fe1d027` adds browser/C# integration, local Docker and CI checks. Evidence commits and exact final HEAD/Draft PR are recorded below after publication. The report cannot embed its own commit hash; the PR and delivery identify the final evidence commit. Working tree must be clean after final commit/push. No history rewrite is used.

## B. Architecture

`apps/web/` is Nuxt 4, Vue 3, strict TypeScript, Tailwind 4, local Shabnam fonts and approved YariZan logo/symbol. Parchment/cream/gold, brown text and green actions reinterpret the Windows book identity. All product UI is Persian RTL; public identifiers/codes use LTR isolation. Native dialogs support Escape, focus return and visible focus. Reduced-motion and mobile layouts are included; no remote image/font dependency.

Public catalog SSR uses real backend JSON validated at the boundary. Prices are integer IRR converted to Toman at display time; availability flags remain authoritative. Authentication/Connect/Admin pages never SSR-fetch privileged account data: after-mount fetches use the user's HttpOnly cookie and synchronizer CSRF token. No credentials enter Nuxt payloads or localStorage. Customer/Admin cookies and state are separate. Session rotation/logout use existing endpoints. A readable CSRF-only cookie permits safe reload; it is not a session bearer.

The same-origin `/api/v2` proxy uses an explicit browser route/method allowlist and fixed loopback/container destination, rejects desktop proof/pickup/authentication routes, arbitrary hosts/credentials/query destinations and redirects. It forwards only the relevant session cookie and CSRF, never arbitrary Authorization. Original mutation Origin must exactly match configuration. Admin GETs require same-origin fetch metadata and CSRF before supplying the backend's expected Origin; the backend still validates the token/recent MFA. Request/response limits, timeouts, no-store, CSP nonces, no-referrer, frame denial and safe error mapping apply. Nuxt runtime never accesses PostgreSQL directly; SQL helpers exist only in isolated tests.

Backend remains the NestJS modular monolith; new projections are bounded/paginated and permission-scoped. No Redis, broker, payment adapter or service account bypass. UI actions carry request IDs, reason/evidence and expected revisions where required. Late one-time-secret responses are discarded after dialog replacement/unmount.

## C. Implementation and contracts

Public routes: `/`, `/products`, `/products/grade-1` through `grade-6`, `/support`, `/login`, `/connect`, `/reset-password`. Customer: `/account`, devices/licenses/security/orders subsections. Orders explicitly state unavailable. Admin: `/zanyari`, login and products/customers/devices/licenses/trials/activation-codes/audit. Dashboard includes operational report totals. Existing support number is 0918-876-4024. Checkout provides assistance only; no fake payment, download or purchase history. Grades 2–6 remain Coming Soon unless the backend changes their flags.

Changed code is grouped under backend identity/accounts/admin/security/contract tests, Nuxt app/server/shared/test tools, C# DeviceProvisioning/DeviceEnrollment/DesktopAccessController/factory and the small Lock pairing modal, Windows/C# tests, Compose, web CI and documentation. Existing signed paid/trial/license code and legacy PHP deployment workflow are preserved. `git diff --stat BASE..HEAD` provides the complete review inventory.

Implemented additions/refinements (all `/api/v2`):

| Route | Contract and boundary |
|---|---|
| POST `/devices/challenges` | Existing P-256 proof challenge; PAIR, AUTH or pairing-bound CONFIRM; desktop only |
| POST `/device-pairings` | Key proof creates five-minute profile pairing, device/generation binding; code never in URL |
| POST `/device-pairings/:id/preview` | Code in body; public username/status/expiry/owner requirement only |
| POST `/auth/claim`, `/device-pairings/:id/confirm` | First password or current-owner session/CSRF approval; **receipt only** |
| POST `/device-pairings/:id/pickup` | Fresh CONFIRM key proof; PENDING or enrollment + short-lived desktop bearer |
| POST `/device-pairings/:id/cancel` | Scoped browser cancellation; atomic status/audit |
| POST `/devices/authenticate` | Fresh AUTH proof recovers active certificate and rotates scoped bearer |
| POST `/devices/register`, `/:id/desktop-confirm` | Retired protocol, HTTP 410; no compatibility bypass |
| GET `/account/entitlements` | Current customer only, safe owned-product projection |
| GET `/admin/auth/session` | Safe Admin identity/permission list; MFA/CSRF |
| GET `/admin/products`, customers, devices, licenses, trials, activation-codes | Bounded pages, permission and recent MFA; no password/hash/verifier/key/raw fingerprint |

Existing login/logout/rotation/recovery, product mutation, block/unblock/reset/trial epoch, entitlement issue/revoke/same-ID recovery, activation issue/cancel, audit/report and five desktop licensing routes are integrated, not replaced by frontend rules. The generated implemented OpenAPI covers **50 controller routes**, exact receipt/pickup and safe array/one-time-secret schemas; frontend generated types are drift checked. Retired endpoints expose only 410 in that document. Older design commerce routes remain proposed, not implemented.

Migration **007_split_provisioning.sql** adds captured machine/generation and protocol version, cancellation state, scoped foreign key/index, and invalidates historical pending protocol-2 pairings. Migrations 001–006 are unchanged, checksum/ordering verified. Issuance/reset serialize on the machine then pairing/key rows; a fresh challenge is consumed once. Account claim checks cheap conditions before Argon2 without row locks across hashing; final transaction revalidates owner session under SHARE lock, pairing/code/expiry/generation. Account reset cancels pending approvals. Fresh pickup retries reuse one signed enrollment/history record and rotate bearer. Historical profile keys cannot obtain new-generation access. Existing two-entry counters remain machine/generation/SKU/allocation-epoch scoped. No historical trial record is deleted.

Roll forward only after reviewing a migration failure; never downgrade to the old browser-delivery protocol. Apply migration 007 and regenerate contracts together. Local disposable keys/data must be retained together for restart; no production migration or MySQL import was attempted.

### Browser-to-Windows sequence

1. Windows uses persisted CNG key to prove PAIR, displays pairing UUID/code and opens fixed Connect URL without secrets. Only public pending UUID is DPAPI-persisted.
2. Browser previews via code in POST body, confirms first password or existing-owner approval. It receives only APPROVED/username/expiry. No claim grant, certificate or desktop bearer is returned.
3. Windows polls only while Lock pairing modal is open, obtains a fresh pairing-bound CONFIRM proof and picks up its own artifact/bearer. Pending status does not issue credentials. An unrelated key, browser cookie or code cannot pick up.
4. Existing pinned-root/domain/strict-claim verifier validates enrollment, device UUID, fingerprint and CNG key digest before atomic DPAPI write. Bearer stays in memory; AUTH proof renews after restart. Lost pickup responses recover with fresh proof, without duplicate enrollment.
5. Second Windows profile uses its own key, current-owner approval and the same machine UUID/account/entitlement/trial budget. Reset advances generation and requires new approval. CNG private keys/ACLs are unchanged.

ADR-0004 ECDSA P-256/SHA-256, P1363 64-byte base64url, RFC 8785/domain-separated artifacts are unchanged. No expiration is added to perpetual licenses. Trial internet is required only to begin; verified current-process access survives disconnection indefinitely. Paid sync is non-blocking and a network error never constitutes revocation. Only an authenticated signed newer decision applies at the intended launch boundary. Arbitrary cross-ID replacement remains blocked.

## D. Security review and production gates

**First-claim physical assurance remains unresolved.** A software key plus a reported fingerprint does not prove possession of genuine hardware. A spoofed unclaimed fingerprint can be preempted. Tests verify that competing/wrong-key/unauthorized existing-owner requests fail; they do not establish hardware attestation. Commercial startup remains unconditionally `PRODUCTION_GATE_CLOSED`, commercial roots stay empty, and synthetic development keys cannot become commercial trust. No flag in this phase authorizes production.

Existing-owner approval is revalidated at commit, including logout/reset races. Login/claim/reset have bounded rate/work admission. Backend authorization remains authoritative for every object. Admin reads omit secrets/raw fingerprints; support evidence is an audited human assertion requiring independent verification, not validation of a document by software. Reset cannot instantly revoke a permanently offline cached paid license; durable SKU bans survive reset, unblock does not recreate entitlements. Same-ID recovery preserves history/trials, cross-ID recovery remains blocked.

CSP/XSS escaping, exact Origin/CSRF, cookie scoping, SSR isolation, fixed proxy URLs, no-store and no URL/localStorage secrets are tested. One-time codes/reset grants are held only for immediate display, never re-read from stored verifiers or captured in routine screenshots. Browser traces are disabled. Debug/test tools are absent from deployed .output. Signing material remains backend-only synthetic development storage. Runtime SQL privileges still require a separately reviewed production login and operational backup/retention policy.

**Dependency finding:** runtime npm audit is zero. Full web build tree reports **11 high affected nodes from two unpatched advisory roots** (braces and node-forge), zero critical. The policy gate explicitly reports/allowlists only these known build-only roots and scans the deployed artifact; it is not a clean full audit. See [dependency findings](YARIZAN-PHASE-3-DEPENDENCY-FINDINGS.md). Review/patch remains a commercial acceptance dependency. Local NuGet vulnerability-source lookup produced NU1900 network warnings; local Windows build success does not establish a clean NuGet audit.

## E. Executed tests and evidence

Local Windows `10.0.26300.0`; Node `24.20.0`, npm `12.0.2`, .NET SDK `10.0.401` targeting .NET 9 (`9.0.20` runtime); PostgreSQL `17.11` in Docker Desktop. Browser is installed Microsoft Edge (Chromium); CI uses Playwright-managed Chromium. Microsoft Edge version `155.0.4283.45`. CI evidence is appended after publication.

| Executed command (repository-relative cwd) | Result |
|---|---|
| backend: `npm run build`, `npm run lint`, `npm run format:check` | Pass |
| backend: `DATABASE_URL=<loopback>/yarizan_phase2_test npm test` | **104 passed, 0 failed/skipped/cancelled** |
| backend: `NODE_ENV=test node tools/check-schema.mjs` with synthetic secrets | Seven migrations; five schema catalog groups match fresh PostgreSQL |
| backend: `npm run check:contracts`, Redocly lint implemented OpenAPI | 50 routes / five desktop response profiles; pass, two expected Redocly warnings because retired routes intentionally have only HTTP 410 |
| backend: `npm run check:secrets`, `npm audit --audit-level=high` | Pass; backend dependency audit zero |
| web: `npm run contracts:check`, typecheck, lint, format:check | Pass |
| web: `npm test` | **11 unit/component tests passed** |
| web: `npm run build` | Nuxt production SSR/.output build passed; non-fatal third-party Rollup annotation warnings |
| web: `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e` | **19 passed, 0 failed** (54.7 seconds) |
| web: `npm run audit:dependencies`, `npm run check:secrets` | Runtime/artifact checks pass; full audit residual above |
| root: `docker build -t yarizan-backend-fixture backend` | Pass; no embedded key, native Argon2, uid 1000 |
| root: `docker build -f apps/web/Dockerfile -t yarizan-web-fixture .` | Pass; runtime is .output only, non-root |
| backend: `node tools/check-runtime-env.mjs yarizan-backend-fixture` with local disposable Docker network/secrets | Missing/empty/staging/production refused; development/test migrate/seed/ready/key-mode/graceful shutdown pass |

Backend tests execute the **real C# verifier (24 checks)**, existing API/controller checks (10), new provisioning production transport checks (24 software-adapter checks), and **25 actual Windows CNG SOFTWARE/DPAPI checks**. These are assertions within the 104 Node tests, not additional Node test cases. Browser+C# integration independently performs actual first approval/reset reapproval through Playwright while C# owns the key/proof; **25 Windows checks** locally, 24 software-adapter checks on Linux. No TypeScript-to-TypeScript-only compatibility claim.

Windows regression commands executed in this worktree: `powershell -File tests/Run-V2Checks.ps1`, `tests/Run-AccessChecks.ps1`, `tests/Run-LauncherChecks.ps1`, `tests/Run-GradeChecks.ps1`, and `tests/Run-BookChecks.ps1` (each through PowerShell). **300 V2 + 27 access + 8 launcher + 5 grade groups + 36 book = 376 checks/groups passed**, preserving and extending the 365 baseline by 11 Lock/provisioning UI checks. Local evidence: non-elevated token, Administrators group disabled, TPM-preferred baseline and forced software cases, real clipboard round-trip. Injected WPF dialog tests are UI simulations; CNG/DPAPI API tests are real platform operations. Physical second-user acceptance, reboot/TPM-loss, commercial-root build, real family onboarding and prolonged offline endurance were **not executed**.

Browser coverage: real catalog/price refresh, all six grades/availability, SSR/RTL, login/logout/rotation/expiry, owner-approved profile, no browser device secret, expired/forged proofs, Admin MFA/permissions/revisions, SKU block/unblock, trial epoch/reset/bans/history, issue/cancel one-time codes, delayed-response isolation, support reset/replay, failure/retry/empty/XSS states, exact Origin/proxy denial/private payload/no-store, mobile360/tablet768/desktop1440. Axe WCAG A/AA/2.1AA scans on five public pages report zero violations. Accessibility tooling is a partial automated assessment, not a full assistive-technology audit.

Screenshots come from the running Nuxt production output with actual isolated PostgreSQL fixtures:

| Screen | Evidence |
|---|---|
| Homepage | [01](Images/phase3/01-homepage.png) |
| Catalog | [02](Images/phase3/02-catalog.png) |
| Grade 1 | [03](Images/phase3/03-grade-one.png) |
| Connect | [04](Images/phase3/04-connect.png) |
| Customer dashboard | [05](Images/phase3/05-customer-dashboard.png) |
| Admin dashboard | [06](Images/phase3/06-admin-dashboard.png) |
| Product management | [07](Images/phase3/07-admin-products.png) |
| Device management | [08](Images/phase3/08-admin-devices.png) |
| Mobile navigation/dialog | [09](Images/phase3/09-mobile-navigation.png), [10](Images/phase3/10-mobile-dialog.png) |
| License management | [11](Images/phase3/11-admin-licenses.png) |

Ignored local logs are under backend/.local and apps/web/.local; reproducible CI logs/artifacts provide durable evidence. Tests touch only loopback named disposable databases. No real account/purchase data was used.

## F. Requirements and milestones

| Requirement/milestone | Status | Practical limit |
|---|---|---|
| A Nuxt foundation/design/typed client/tests | Implemented | Local assets, strict builds, responsive RTL |
| B six-grade storefront/details/support | Implemented | Backend catalog; assistance replaces unavailable checkout |
| C customer sessions/account/security/support | Implemented | Current implemented account APIs; no invented orders |
| C split provisioning across browser/backend/WPF | Implemented | Review/dev foundation; commercial gate closed |
| C physical first-claim ownership assurance | Blocked | Spoof/preemption/dispute policy unresolved |
| D MFA/RBAC Admin and safe paginated reads | Implemented | Recent MFA; backend enforces every operation |
| D product revision/price/flags | Implemented | No frontend-only availability decision |
| D reset, SKU ban/unban, trial epoch/history | Implemented | Offline revocation cannot be instant |
| D manual entitlement, code issue/cancel, revoke | Implemented | Synthetic/authorized Admin ownership, no fake payment |
| D recovery/reissue | Partially Implemented | Support reset and same-license-ID recovery; cross-ID blocked |
| E API/browser/C#/Windows/concurrency/security/CI | Implemented | Physical multi-user/endurance acceptance outstanding |
| Accessibility | Partially Implemented | Keyboard/focus/contrast + five-page axe; full manual audit pending |
| Order/payment/refund/coupon settlement | Not Started | Explicit future phase; schema/UI unavailable notices only |
| SMS delivery | Not Started | Explicit future phase; support instructions only |
| Production signing/deployment | Blocked | No keys, roots, infrastructure change or commercial gate override |
| Build dependency remediation | Blocked | Two unpatched upstream high advisories, explicit report |

## G. Remaining dependencies

Independent security review of this split, physical-device first-claim assurance and dispute policy; external signing custody, approved commercial roots and lifelong public-key retention; physical Windows multi-profile/reboot/TPM/offline acceptance; upstream build-dependency patches; production support evidence/retention/backup/least-privilege and capacity policies; real Nuxt production Origin/TLS/reverse proxy configuration through separately approved infrastructure work; real payments/orders/refunds/finance and SMS in later phases. No UI suggests these are completed.

## H. Safety confirmation

**Unchanged:** main branch, production/staging/live server, existing PHP/MySQL, DNS/Traefik/firewall, real customer data, ZarinPal merchant, MeliPayamak, production signing keys, live payment/refund infrastructure. Only this feature worktree/branch, local disposable Docker/test data and Draft PR review material are authorized changes. No force-push, merge, deployment or production private-key generation. Stop for independent review.
