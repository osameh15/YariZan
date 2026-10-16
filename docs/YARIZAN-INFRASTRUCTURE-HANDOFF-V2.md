# YariZan V2 — Application → Infrastructure Handoff

Date: 2026-10-16. From: the YariZan application session (`osameh15/YariZan`, branch `feat/yarizan-v2-production-readiness`, Draft PR #5).
To: the OAR NOVA infrastructure session (`OAR-NOVA-Games/oarnova-infrastructure`, baseline `3e9d6b0`).

This document answers the infrastructure handoff contract (`docs/yarizan/handoff-contract.md`) item by item. It changes nothing on the VPS, in DNS, the CDN, Traefik, Origin Lockdown or the infrastructure repository. **Nothing here authorizes a deployment.** The infrastructure session owns every runtime change and needs separate owner approval for each one.

Two release stages exist:

| Stage | Content | Status |
| --- | --- | --- |
| **A — brochure-only web** | Nuxt web image built with profile `brochure`. Informational pages only; no API, database or secrets | Owner-approved **strategy**. The application is ready for review; deployment still needs image publication, the infrastructure PR and a window |
| **B — full application** | Web (`full`), NestJS API, PostgreSQL, accounts, Admin MFA, SMS, ZarinPal, desktop enrollment, signed licenses | **Blocked** by G1–G9 and B13. The API refuses `NODE_ENV=production` |

## 1. Images (R1–R5)

| Image | Build | Registry reference (proposed) | Digest |
| --- | --- | --- | --- |
| Web, brochure | `docker build -f apps/web/Dockerfile --build-arg YARIZAN_BUILD_PROFILE=brochure .` | `ghcr.io/osameh15/yarizan-web:brochure-<commit12>` | **Not published.** Owner gate, see §1.1 |
| Web, full | same, `YARIZAN_BUILD_PROFILE=full` | `ghcr.io/osameh15/yarizan-web:full-<commit12>` | Not published; Stage B only |
| API | `docker build backend` (default target `production`) | `ghcr.io/osameh15/yarizan-api:<commit12>` | Not published; Stage B only |

- Base image for both: `node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` (multi-arch index digest, resolved 2026-10-16). Multi-stage builds; `npm ci` from committed lockfiles; development dependencies stay in the build stage.
- Runtime stages remove npm, npx, corepack and yarn. Application files are root-owned and read-only; the process runs as `1000:1000`.
- Image contents are checked automatically (`tools/release/check-web-image.mjs`, `backend/tools/check-runtime-env.mjs`): no `.env`, `.local`, keys, source maps, tests, tools or synthetic secret patterns.
- Deploy only by digest: `<registry>/<name>@sha256:<64 hex>`. Tags exist for humans only. The release manifest (§1.2) is the single source of digests.

### 1.1 Registry and permissions (open question 3)

- Proposed registry: **GHCR**, packages `ghcr.io/osameh15/yarizan-web` and `ghcr.io/osameh15/yarizan-api`. The VPS already reaches `ghcr.io` (contract R1).
- Push rights: only the `Release images` workflow (`.github/workflows/release-images.yml`) through the job-scoped `GITHUB_TOKEN` with `packages: write`. No personal access token, SSH key or VPS credential is stored in GitHub.
- Owner gate before the first publication:
  1. Create the repository environment `yarizan-release` with at least one required reviewer. The workflow refuses to run without it; GitHub would otherwise create an unprotected environment automatically.
  2. Accept the GHCR package names. Packages of a public repository are public by default after the first push. If the owner wants private packages, the infrastructure session needs a read-only pull token on the VPS (`read:packages`), created and stored by the owner, never in Git.
- **No image was published by this session**, because gate 1 does not exist yet. No digest in this document is invented.

### 1.2 Release manifest (R1, R5)

The `Release images` workflow writes `release-manifest.json` (schema `yarizan-release-manifest/v1`, validated by `tools/release/validate-manifest.mjs`):

| Field | Meaning |
| --- | --- |
| `source_commit` | Full 40-hex commit that passed every required workflow |
| `ci_run_url` | The release workflow run |
| `built_at` | UTC timestamp |
| `migrations` | Exact `schema_migrations` count for this release (**9**) |
| `environment_changes`, `route_changes` | Release notes for R5 |
| `images[]` | `name`, `profile` (web), `tag`, `digest`, `reference` (`registry/name@digest` only), `eligibility`, `scan` (Trivy critical/high counts) |

`eligibility` is `stage-a-brochure-candidate` only for the brochure web image. Every full-application image is `blocked-stage-b`; the validator rejects any other value.

### 1.3 Changelog for this release (R5)

- Migrations included: **yes, 9 total** (`001`–`009`; unchanged since PR #4). Run as a one-off command, never at API startup.
- New environment keys:
  - Web: `YARIZAN_SITE_MODE` (`brochure` or `full`, required, must equal the image build profile).
  - API one-off jobs: `MIGRATION_DATABASE_URL` (production migration/bootstrap login, must differ from `DATABASE_URL`).
- Route changes: none in the API. In Stage A the web answers every `/api/*` path itself with `503` JSON.

## 2. Runtime

### 2.1 Stage A — brochure-only web

| Item | Value |
| --- | --- |
| Command | Image default: `node .output/server/index.mjs` |
| Environment | `NODE_ENV=production` (image default), `HOST=0.0.0.0`, `PORT=3200`, `YARIZAN_SITE_MODE=brochure`, `NUXT_WEB_ORIGIN=https://yarizan.oarnova.games`. **No** API URL, database, SMS, payment or signing key is needed. `NUXT_API_BASE` is ignored by the brochure build |
| Fail-closed startup | Missing `YARIZAN_SITE_MODE` → exit 1 `YARIZAN_SITE_MODE_REQUIRED`; unknown value → `YARIZAN_SITE_MODE_INVALID`; `full` on a brochure image → `YARIZAN_SITE_MODE_MISMATCH` |
| Health check | `GET /healthz` → `200`, body `ok`, `Content-Type: text/plain`, `Cache-Control: no-store`; no dependency (W1). The existing Compose health check works unchanged |
| User and filesystem | `user: "1000:1000"`, `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges`, tmpfs `/tmp` 16 MiB `uid=1000,gid=1000,mode=0700`. Nothing else is written |
| Network | Ingress network only. No egress needed; tested with `--network none` |
| Resources | Budget 384 MiB / 0.75 CPU is sufficient. Measured: **41.6 MiB** after a 60-request load (brochure), 26.7 MiB (full, idle). Image size about 251 MB uncompressed |
| Shutdown | SIGTERM; `NITRO_SHUTDOWN_TIMEOUT=15000` keeps graceful shutdown inside `stop_grace_period: 20s`. Measured stop: 114 ms |

**Required brochure topology (infrastructure change request, do not reuse the full Compose file as is).** `apps/yarizan/compose.yaml` makes `web` depend on a healthy `api`, and the API cannot start in production. Do not start a development-mode API to satisfy that dependency. Instead, the infrastructure session should add a separate project or profile, for example `oarnova-yarizan-brochure`, with:

- exactly one service `web` using the brochure digest, with the same `x-hardening` anchor, `user`, tmpfs, health check, `mem_limit: 384m`, `memswap_limit: 384m`, `cpus: 0.75`, `pids_limit: 128`;
- `environment`: `HOST`, `PORT`, `YARIZAN_SITE_MODE: brochure`, `NUXT_WEB_ORIGIN` (no `NUXT_API_BASE`);
- network `ingress` with alias `yarizan-web` only; no `app` or `db` network; no `depends_on`;
- no volume, no `env_file`, no secret.

**Required brochure route file** (a third mutually exclusive file next to `dynamic/yarizan-maintenance.yml` and `staged/yarizan-app.yml`):

- Router for static assets: `GET|HEAD` on `/_nuxt/`, `/brand/`, `/fonts/` → `yarizan-web`, middleware `yarizan-static-assets` (as in the app file).
- Catch-all router `Host(yarizan.oarnova.games)` → `yarizan-web` with `yarizan-no-store`, `yarizan-limit-body-64k` (and `yarizan-noindex` until the owner decides the site may be indexed).
- **No desktop routers and no `yarizan-api` service.** Desktop and browser API calls reach the web, which answers `503 {"error":{"code":"SERVICE_UNAVAILABLE"}}` with `Retry-After: 3600` and `no-store`, exactly as the maintenance phase does (D3).
- Health check of the service: `/healthz`.

### 2.2 Stage B — full application (blocked)

| Item | Web (`full`) | API |
| --- | --- | --- |
| Command | `node .output/server/index.mjs` | `node dist/src/main.js` (image default) |
| Environment | `YARIZAN_SITE_MODE=full`, `NUXT_API_BASE=http://api:3100/api/v2/`, `NUXT_WEB_ORIGIN`, `HOST`, `PORT` | From `api.env`: `NODE_ENV=production`, `DATABASE_URL` (runtime login), `CODE_HMAC_KEY`, `TOKEN_HMAC_KEY`, `MFA_ENCRYPTION_KEY`, `MOBILE_ENCRYPTION_KEY`, `OTP_HMAC_KEY` (all independent 32-byte hex), `COMMERCE_MODE=disabled`; Compose adds `PORT`, `BROWSER_ORIGIN`, `SMS_PROVIDER=disabled`, `SMS_ALLOW_LIVE=false` |
| Health | `/healthz` | `/health` (liveness, no DB); `/ready` (DB + exactly 9 migrations; internal only, A4) |
| Measured memory | 26.7 MiB idle | 38.7 MiB idle under `--read-only`, 512 MiB limit |
| Pool | — | `max: 12` connections (A9 limit 15) |
| Shutdown | 15 s Nitro timeout | Nest shutdown hooks; measured 227–299 ms |

The API image refuses `NODE_ENV=production` with `PRODUCTION_GATE_CLOSED: G1_FIRST_CLAIM_ASSURANCE,G1_SIGNING_CUSTODY,G4_DESKTOP_CREDENTIALS,G6_ADMIN_SMS_MFA,G5_TRUSTED_RATE_LIMITS,G8_SECRET_CUSTODY`. No environment variable opens a gate.

## 3. PostgreSQL (S1–S3, A2, A3)

| Item | Value |
| --- | --- |
| Engine | PostgreSQL 17.11 (CI uses the infrastructure's pinned `postgres:17.11-alpine@sha256:b0f9…2b24`) |
| **Migration count (S1)** | **9** (`001_core` … `009_commerce_authority`). The infrastructure baseline of 8 is outdated; set the restore drill's expected count to 9 |
| Migration command | `docker compose run --rm --no-deps api node dist/src/database/migrate.js` with `NODE_ENV=production` and `MIGRATION_DATABASE_URL` (migration owner login). It refuses a missing or shared login (`MIGRATION_DATABASE_URL_REQUIRED`, `INDEPENDENT_DATABASE_CREDENTIALS_REQUIRED`). One transaction, advisory lock, SHA-256 hash and order verification, then runtime grants |
| Read-only verification | `node dist/src/database/migrate.js --verify` (works with the runtime login; changes nothing) |
| Runtime role | Run once as operator: `backend/migrations/roles/create-runtime-role.sql` creates NOLOGIN `yarizan_runtime`. Bind a login: `CREATE ROLE yarizan_api LOGIN PASSWORD '<server-generated>' IN ROLE yarizan_runtime`. Grants (re-applied by every migration run): `SELECT, INSERT, UPDATE` on tables, `DELETE` only on `discount_products`, `SELECT` only on `schema_migrations`, no `UPDATE` on immutable history tables, no `CREATE`, no `TRUNCATE`, not owner |
| Migration role | Owns the schema (`CREATE` on schema `public`, owner of all tables). Separate password; used only by one-off jobs |
| Production bootstrap | `node dist/src/database/production-bootstrap.js` (migration login). Idempotent; creates RBAC roles/permissions and six **hidden** products with sale, trial and activation disabled; no prices, no Admin, no customer data. The development seed refuses `NODE_ENV=production` |
| Rollback | Forward-only. No down migrations. Never delete the volume (§6) |

**Tables with personal data (S2):** `customers` (device username, password hash, encrypted mobile, mobile lookup HMAC, last 4 digits), `devices` (hardware fingerprint digest, username), `device_keys`, `device_credentials`, `device_enrollment_history` (evidence references), `customer_sessions`, `admin_sessions`, `admins` (username, password hash, encrypted MFA/mobile), `otp_challenges` (encrypted mobile, lookup), `pairings`, `password_resets`, `customer_reset_events`, `orders`, `order_items`, `payment_attempts`, `payment_events`, `refund_requests` (free-text reason), `discount_redemptions`, `entity_notes` (free-text Admin notes), `audit_logs` (actor ids, redacted metadata), `trial_starts`, `entitlements`, `licenses`, `license_decisions`, `activation_codes`, `activation_redemptions`, `purchase_notifications`, `outbox_events`.

**Keys needed to use restored data (S3):** `MOBILE_ENCRYPTION_KEY` and `MFA_ENCRYPTION_KEY` (encrypted columns), `OTP_HMAC_KEY` (mobile lookup), `CODE_HMAC_KEY` (activation-code verifiers), `TOKEN_HMAC_KEY` (sessions, credentials, rate buckets). Commercial signing keys are not in `api.env`: their custody is G1/G8 and still undecided (open question 4). Losing any key makes the matching data unusable; back up `api.env` encrypted with the database, as `database.md` already plans.

## 4. Security contract

| Topic | Application statement |
| --- | --- |
| Production gate (G1) | Closed in source; named gates listed in §2.2; positive/negative tests in `backend/test/core.test.ts` and the container checker |
| Signing custody (open question 4) | No replacement for `/app/.local` exists. Production signing needs an owner-approved external custody design (HSM/KMS or offline signer). The runtime image has no writable key path and must not get one |
| SMS and Admin MFA (G6) | Admin login requires SMS OTP; with `SMS_PROVIDER=disabled` no Admin login exists and there is no fallback. Live SMS needs HTTPS egress to `rest.payamak-panel.com` only (open question 5; the endpoint is fixed in `backend/src/accounts/sms.ts`); infrastructure designs the allowlisting proxy |
| Payment egress | ZarinPal stays refused (`ZARINPAL_LIVE_GATE_CLOSED`). No payment egress is requested now |
| Desktop routes (D1, D2, open questions 1–2) | Confirmed from source: see `docs/YARIZAN-PRODUCTION-READINESS-AUDIT.md` § Milestone A. The D1 list is exact and complete. `POST device-pairings` is desktop-only. Calls without a bearer: `devices/challenges`, `devices/authenticate`, `device-pairings`, `device-pairings/{uuid}/pickup` (all device-key proof based). `GET desktop/entitlements` is implemented but not called by the current client. Retired: `POST devices/register`, `POST device-pairings/{uuid}/desktop-confirm` (`410`) |
| Browser proxy (W2) | Allowlist, Origin and CSRF checks unchanged; no desktop route added. In Stage A the proxy is not even compiled into the brochure image |
| Cache (W3, W4) | Only `/_nuxt/`, `/brand/`, `/fonts/` are cacheable. Every page and every refused request returns `Cache-Control: no-store` (the brochure middleware also overrides Nuxt's `no-cache` on 404) |
| Error responses | Disabled API: `503` JSON `{"error":{"code":"SERVICE_UNAVAILABLE"}}`, `application/json; charset=utf-8`, `no-store`, `Retry-After: 3600`. Disabled pages: `503` Persian HTML, `no-store`, `Retry-After: 3600`. Unknown or non-canonical paths: `404` Persian HTML, `no-store`. Wrong method on a public page: `405` JSON with `Allow: GET, HEAD` |
| Rate limiting (G5, A5) | No security decision depends on per-IP limits. IP-keyed buckets collapse behind the proxy chain into shared buckets (availability risk, not a bypass). Identity-scoped limits exist for login, OTP, SMS, pairing, bearer credentials and commerce. Stage B still needs a verified client-IP header or per-device limits on `devices/challenges` |
| Logs (A7) | JSON request logs without bodies, tokens or OTPs; container checks assert no key or password text in startup logs |

## 5. Deployment plans

### Plan A — brochure-only web (Stage A)

Prerequisites: owner creates `yarizan-release` (§1.1); a `Release images` run produces a validated manifest; the infrastructure PR adds the brochure Compose project and route file (§2.1); the owner approves a window.

1. Infrastructure PR: brochure Compose project + `yarizan-brochure.yml` route, CI-tested against the published digest. Keep the maintenance page active.
2. Pull the brochure digest on the VPS; run `yarizan-preflight.sh` (digest-only check).
3. Start the brochure project; wait for the container health check (`/healthz`).
4. Origin-side checks over the private network: `/healthz`, `/`, `/products`, `/products/grade-1`, `/support` → `200`; `/account`, `/login`, `/zanyari`, `/checkout` → `503` HTML `no-store`; `POST /api/v2/devices/challenges` and `GET /api/v2/products` → `503` JSON with `Retry-After`; `POST /` → `405`; `/products/` → `404`.
5. Switch the route file from maintenance to brochure (`deploy.sh edge`), as a separate approved step.
6. CDN acceptance through `https://yarizan.oarnova.games` (VPN off): the same checks as step 4, plus a second request to confirm `NFC`/not cached for pages and errors, and static assets cacheable. Record `400`/`401`/`403`/`404`/`409`/`429` results separately; Stage A can only produce `404`, `405` and `503` itself.
7. CDN purge for the host; StatusCake `/healthz` monitor stays.

### Plan B — full application (Stage B, blocked until G1–G9 and B13 are accepted)

1. Secrets and backup keys (`api.env`, age recipients, B2 buckets) generated on the server.
2. PostgreSQL volume and superuser secret; migration login and runtime login with separate passwords.
3. Start `db` only.
4. One-off migrations (`migrate.js`, migration login); confirm 9 rows; then `production-bootstrap.js`.
5. Validate the runtime role: `migrate.js --verify` with the runtime login; confirm no DDL/TRUNCATE.
6. Start `api` (only after the production gate has been opened by a reviewed release).
7. Start `web` (`full` digest, `YARIZAN_SITE_MODE=full`).
8. First encrypted backup and isolated restore drill (expected migrations 9).
9. Health checks: `/healthz`, internal `/ready`.
10. Controlled Traefik switch to `staged/yarizan-app.yml`.
11. CDN acceptance including `400`/`401`/`403`/`404`/`409`/`429` JSON passthrough (B13).
12. Monitoring verification (StatusCake, `oarnova-health`, backup alerts).

## 6. Rollback

See `docs/YARIZAN-RELEASE-AND-ROLLBACK.md` for the full procedure. Summary:

- Return to the previous digest by editing the image reference in the server `.env` and recreating only the affected service. The manifest of each release keeps its digests.
- Stage A: switch the route back to `dynamic/yarizan-maintenance.yml` and stop the brochure project; the maintenance page returns. Verify with the W2/W4 acceptance scripts.
- Stage B: migrations are forward-only. Roll back the API only to a digest that expects the same migration count (the manifest records it). Never restore an older database over newer customer, license or financial records without reconciliation.
- **Never delete a database volume during rollback.** It holds customer, license and payment records that cannot be recreated.
- Rehearsed in CI with a disposable registry and volume (`tools/release/rollback-rehearsal.mjs`): deploy → upgrade → rollback by digest for web and API; the volume, 9 migrations and a marker row survive.

## 7. What this session did not do

No SSH to the VPS, DNS or CDN change, Origin Lockdown or Traefik change, live Compose change, host installation, public port, real signing key, production secret, image publication, live payment, SMS or deployment. The infrastructure repository was read only.
