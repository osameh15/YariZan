# YariZan Nuxt 4 portals

Persian RTL storefront, customer portal and MFA/RBAC Admin console. Isolated development/review only. No payment completion, live SMS acceptance or production deployment exists. SMS authentication has an explicit local fake provider and a fail-closed MeliPayamak adapter. The supplied server-panel screenshot is not a web design asset or permission to access infrastructure.

## Start locally

Requirements: Node 24, PostgreSQL 17 through Docker Compose, .NET 9, Windows for actual CNG/WPF checks. From repository root:

```powershell
npm --prefix backend ci
npm --prefix backend run build
npm --prefix apps/web ci --ignore-scripts
# Copy backend/.env.example to ignored backend/.env and choose three distinct synthetic secrets.
docker compose --env-file backend/.env -f backend/compose.yaml --profile web up --build -d
```

Open **http://localhost:3200** (use localhost consistently for exact Origin). The database is loopback-only on 55432, API on 3100. Compose explicitly selects development, migrates eight ordered migrations and seeds six products. Health/readiness require the schema. API keys stay in the disposable development volume, never the web image. Stop this named local stack with `docker compose --env-file backend/.env -f backend/compose.yaml --profile web stop`; no volume deletion is required.

For host development, start only Compose `db`, then from backend use Node `--env-file=.env` for migration, seed and main. In another terminal `npm --prefix apps/web run dev`. Defaults point only to 127.0.0.1:3100. On hosts exporting unsupported SOCKS proxy variables, clear HTTP_PROXY/HTTPS_PROXY/ALL_PROXY in that terminal and set NODE_USE_ENV_PROXY=0 before Nuxt commands. This does not change system networking.

## Security boundary

Only the allowlisted browser API is proxied under `/api/v2`. Destinations are fixed to loopback or Compose api port 3100. No arbitrary URL, redirect, Authorization header or desktop proof route is forwarded. Customer/Admin session cookies remain HttpOnly, SameSite Strict and `/api/v2`; separate readable CSRF cookies contain only synchronizer tokens. Mutation Origin must exactly match NUXT_WEB_ORIGIN. Admin reads require same-origin fetch metadata and CSRF before proxy Origin injection. Do not weaken these checks to fix configuration.

Catalog SSR never forwards cookies. Private account/Admin data loads after mount and is no-store, absent from SSR payloads. CSP uses per-render script nonces; local assets/fonts only. Credentials are never localStorage or query parameters. Error text is mapped to Persian safe messages. Abort/timeouts never imply license revocation.

Connect accepts a short-lived ID/code by form. Browser approval returns status only. Windows alone owns CNG proof and calls backend pickup. Additional profiles require the existing owner. The development build has no approved commercial roots; production startup and commercial Windows release remain closed. See ADR-0006 and the Phase 3 report.

Admin bootstrap is the existing development-only backend tool, not a privileged UI shortcut. Use independent synthetic SMS MFA credentials as described in backend/README.md. Sensitive operations require recent MFA, scoped permission, revision, reason and ownership evidence. One-time activation/reset secrets clear when their dialog closes; late responses cannot fill a different dialog.

## Checks

```powershell
npm --prefix backend run build
npm --prefix apps/web run contracts:check
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run format:check
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/web run audit:dependencies
npm --prefix apps/web run check:secrets
# Windows system Edge; CI installs Chromium instead.
$env:PLAYWRIGHT_CHANNEL='msedge'
npm --prefix apps/web run test:e2e
```

Browser tests create/reset only `yarizan_phase3_web_test` on loopback; backend tests use `yarizan_phase2_test`. Never supply a live database. Tests start real NestJS and the Nuxt production output, create synthetic users/MFA by test-only fixtures, and execute actual API operations. The combined browser/C# test uses actual CNG/DPAPI on Windows and a labeled software adapter on Linux. It never adds loopback support to the commercial transport. Browser traces are disabled to avoid recording secrets. Screenshots in docs/Images/phase3 contain synthetic data and no one-time secrets.

CI runs the same commands with an isolated PostgreSQL 17 service, .NET 9, Chromium and Docker. The workflow contains no deployment. Runtime audit is clean; the complete build tree has two **unpatched high advisories**, explicitly reported by audit:dependencies. See docs/YARIZAN-PHASE-3-DEPENDENCY-FINDINGS.md. A passing policy gate does not mean a clean full dependency audit.

## Routes and future integration

Public: `/`, `/products`, `/products/grade-1` through grade-6, `/support`, `/connect`, `/login`, `/reset-password`. Customer: `/account`, `/account/devices`, `/account/licenses`, `/account/security`, `/account/orders` (explicitly unavailable). Admin: `/zanyari` and products/customers/devices/licenses/trials/activation-codes/audit sections, permission-filtered and backend-enforced.

Prices and publication/sale/trial/activation flags come from the live catalog. Integer IRR is displayed as Toman. Checkout offers support assistance, never fabricated settlement. The existing release link is used only where supported; Coming Soon never suggests a downloadable/activated grade. Future payment/finance/support evidence systems and live SMS acceptance need separate authorization. No runtime code reads PostgreSQL from Nuxt; direct SQL exists only in isolated test tools.

## Phase 3.1 manual authentication review

Connect now verifies mobile OTP for first ownership; no initial password is required. Login offers password/OTP, /reset-password is self-service OTP, /support-reset is the independent support-grant fallback, and /account/security supports password/mobile changes. Every form uses the shared novalidate FormShell with Persian inline errors/ARIA/focus; API notices and route errors avoid raw browser/framework text. Admin uses password then SMS, with no TOTP fallback. Notes/search are real permission-scoped backend operations.

Enable only the explicit fake local SMS configuration described in backend/README.md and read fake codes through the operator CLI, not a browser API. Production provider configuration and approved template are absent. Tests use an encrypted fake spool and synthetic mobiles; no real messages are sent. Current acceptance and screenshots are in docs/YARIZAN-PHASE-3-1-REPORT.md; exact APIs/settings in docs/YARIZAN-AUTH-AND-SMS-CONTRACTS.md. Existing Phase 3 reports describe their historical baseline.


## Phase 4 synthetic commerce

Commerce is disabled by default. In isolated local configuration set COMMERCE_MODE=fake to enable the explicitly labeled simulator; no merchant credentials or network gateway are used. Compose forwards this explicit setting. PURCHASE_SMS_TEMPLATE is a safe notification template identifier; the durable purchase event is recorded only, not delivered. Real provider selection refuses startup; production remains blocked.

Customer routes now include /checkout?sku=YARIZAN-G1, /payment/simulate, /payment/result, /account/orders and /account/orders/:id. Admin /zanyari/commerce uses actual permission-protected commerce/finance APIs. Orders replace the previous unavailable placeholder. Checkout first creates an authoritative snapshot, then the detail view offers an explicit simulated payment action. No card data is collected. See docs/YARIZAN-COMMERCE-CONTRACTS.md and docs/YARIZAN-PHASE-4-REPORT.md from the repository root for exact API/state/evidence.

Use the existing disposable PostgreSQL and fake SMS setup. Backend build/test exercises commerce, 20-way coupon concurrency and real .NET verification. Browser test:e2e includes synthetic checkout and Admin flows. Stop Compose api/web before Playwright: its managed servers require ports 3100/3200. Never replace fake mode with a live merchant for these checks.
