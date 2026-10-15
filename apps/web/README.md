# YariZan Nuxt 4 portals

Persian RTL storefront, customer portal and MFA/RBAC Admin console. Isolated development/review only. No payment completion, SMS delivery or production deployment exists. The supplied server-panel screenshot is not a web design asset or permission to access infrastructure.

## Start locally

Requirements: Node 24, PostgreSQL 17 through Docker Compose, .NET 9, Windows for actual CNG/WPF checks. From repository root:

```powershell
npm --prefix backend ci
npm --prefix backend run build
npm --prefix apps/web ci --ignore-scripts
# Copy backend/.env.example to ignored backend/.env and choose three distinct synthetic secrets.
docker compose --env-file backend/.env -f backend/compose.yaml --profile web up --build -d
```

Open **http://localhost:3200** (use localhost consistently for exact Origin). The database is loopback-only on 55432, API on 3100. Compose explicitly selects development, migrates seven ordered migrations and seeds six products. Health/readiness require the schema. API keys stay in the disposable development volume, never the web image. Stop this named local stack with `docker compose --env-file backend/.env -f backend/compose.yaml --profile web stop`; no volume deletion is required.

For host development, start only Compose `db`, then from backend use Node `--env-file=.env` for migration, seed and main. In another terminal `npm --prefix apps/web run dev`. Defaults point only to 127.0.0.1:3100. On hosts exporting unsupported SOCKS proxy variables, clear HTTP_PROXY/HTTPS_PROXY/ALL_PROXY in that terminal and set NODE_USE_ENV_PROXY=0 before Nuxt commands. This does not change system networking.

## Security boundary

Only the allowlisted browser API is proxied under `/api/v2`. Destinations are fixed to loopback or Compose api port 3100. No arbitrary URL, redirect, Authorization header or desktop proof route is forwarded. Customer/Admin session cookies remain HttpOnly, SameSite Strict and `/api/v2`; separate readable CSRF cookies contain only synchronizer tokens. Mutation Origin must exactly match NUXT_WEB_ORIGIN. Admin reads require same-origin fetch metadata and CSRF before proxy Origin injection. Do not weaken these checks to fix configuration.

Catalog SSR never forwards cookies. Private account/Admin data loads after mount and is no-store, absent from SSR payloads. CSP uses per-render script nonces; local assets/fonts only. Credentials are never localStorage or query parameters. Error text is mapped to Persian safe messages. Abort/timeouts never imply license revocation.

Connect accepts a short-lived ID/code by form. Browser approval returns status only. Windows alone owns CNG proof and calls backend pickup. Additional profiles require the existing owner. The development build has no approved commercial roots; production startup and commercial Windows release remain closed. See ADR-0006 and the Phase 3 report.

Admin bootstrap is the existing development-only backend tool, not a privileged UI shortcut. Use independent synthetic MFA credentials as described in backend/README.md. Sensitive operations require recent MFA, scoped permission, revision, reason and ownership evidence. One-time activation/reset secrets clear when their dialog closes; late responses cannot fill a different dialog.

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

Prices and publication/sale/trial/activation flags come from the live catalog. Integer IRR is displayed as Toman. Checkout offers support assistance, never fabricated settlement. The existing release link is used only where supported; Coming Soon never suggests a downloadable/activated grade. Future payment/SMS/finance/support evidence systems need separate contracts and authorization. No runtime code reads PostgreSQL from Nuxt; direct SQL exists only in isolated test tools.
