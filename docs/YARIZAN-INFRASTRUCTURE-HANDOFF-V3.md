# YariZan V2 — Infrastructure Handoff V3 (public storefront)

From: application session (Draft PR #7, `feat/yarizan-v2-full-web-release`). To: infrastructure session for `OAR-NOVA-Games/oarnova-infrastructure`.

Reviewed infrastructure state: `origin/main@dbc38d8` (newer than the `7a7a899` named in the assignment). This application session did not modify the infrastructure repository. Everything below is a change request for a separately reviewed infrastructure PR. V2 (`docs/YARIZAN-INFRASTRUCTURE-HANDOFF-V2.md`) stays valid for Stage A brochure and Stage B; V3 adds the public storefront and updates counts.

Nothing has been published or deployed. GHCR publication of a storefront image needs the owner's separate approval (§14).

## 1. New runtime profile: `storefront`

| Item | Value |
| --- | --- |
| Image | `ghcr.io/osameh15/yarizan-web`, tag `storefront-<commit12>`, deployed **by digest only** |
| Build | `docker build -f apps/web/Dockerfile --build-arg YARIZAN_BUILD_PROFILE=storefront .`; label `games.oarnova.yarizan.build-profile=storefront` |
| What it is | Full premium public site: home, six-grade catalog with approved prices, six product pages, trial/licensing explanation, support/FAQ, custom 404/503. Account, connect, checkout, payment, Admin and every `/api/*` path fail closed exactly as in the brochure profile |
| Required env | `YARIZAN_SITE_MODE=storefront` (must equal the build profile, else exit 1), `NUXT_WEB_ORIGIN=https://yarizan.oarnova.games`, `HOST=0.0.0.0`, `PORT=3200`. `NODE_ENV=production` is the image default |
| Optional env | `YARIZAN_SEO_INDEXING=index` only after the owner accepts indexing (§11). Unset means `noindex, nofollow` |
| Not needed | No API, database, SMS, payment or signing configuration; no secret; no volume; no egress (tested with `--network none`) |
| Hardening | Same as brochure: `user 1000:1000`, `read_only`, `cap_drop: ALL`, `no-new-privileges`, tmpfs `/tmp` 16 MiB, `mem_limit 384m`, `cpus 0.75`, `pids_limit 128`, `stop_grace_period 20s` |

## 2. Web only, or also a catalog service?

**Web only.** Prices come from the reviewed static snapshot inside the image (revision `pricing-2026-10-18-r1`). No read-only catalog service is needed, so no API container, database or Backend production gate is involved in a storefront deployment. A price change means a new reviewed image.

## 3. Compose changes (requested)

The current `apps/yarizan/compose.yaml` web service has two problems for any public profile:

1. It sets **no `YARIZAN_SITE_MODE`**. Every V2 web image refuses to start without it (`YARIZAN_SITE_MODE_REQUIRED`). Add it explicitly per project.
2. `web` depends on a healthy `api`, which cannot start in production (closed gates). Do not work around this with a development API.

Request: a separate project (or profile) `oarnova-yarizan-storefront`, mirroring the V2 brochure request:

- one service `web` with `${YARIZAN_WEB_IMAGE}` (storefront digest), the `x-hardening` anchor, `user`, tmpfs, `/healthz` health check and resources above;
- `environment`: `HOST`, `PORT`, `YARIZAN_SITE_MODE: storefront`, `NUXT_WEB_ORIGIN`;
- network `ingress` with alias `yarizan-web` only; no `app`/`db` network; no `depends_on`; no `env_file`, volume or secret.

The brochure project from V2 stays available unchanged as the maintenance/rollback option.

## 4. Traefik changes (requested)

A storefront route file, mutually exclusive with `dynamic/yarizan-maintenance.yml`, `staged/yarizan-app.yml` and the V2 brochure file:

| Router | Rule | Service | Middlewares |
| --- | --- | --- | --- |
| static | `Host(yarizan.oarnova.games) && (GET or HEAD) && (PathPrefix /_nuxt/, /brand/, /fonts/)` | `yarizan-web` | `yarizan-static-assets` |
| crawler files | `Host(...) && (GET or HEAD) && (Path /robots.txt or /sitemap.xml)` | `yarizan-web` | `yarizan-limit-body-64k` (the app sets a 5-minute public cache) |
| pages and API | `Host(yarizan.oarnova.games)` catch-all | `yarizan-web` | `yarizan-no-store`, `yarizan-limit-body-64k`, `yarizan-noindex` (keep until §11) |

**No desktop routers and no `yarizan-api` service.** Desktop calls reach the web and get `503 {"error":{"code":"SERVICE_UNAVAILABLE"}}` with `Retry-After: 3600` and `no-store`, so installed Windows clients treat the service as temporarily unavailable and keep any stored license working offline. Service health check: `/healthz`.

## 5. Static price data and revision

| SKU | IRR | Display | Availability on the storefront |
| --- | ---: | --- | --- |
| YARIZAN-G1 | 12,990,000 | ۱٬۲۹۹٬۰۰۰ تومان | «فروش اینترنتی به‌زودی» (launch candidate, not purchasable) |
| YARIZAN-G2…G6 | 12,990,000 each | ۱٬۲۹۹٬۰۰۰ تومان | «به‌زودی» |

Revision `pricing-2026-10-18-r1`. Contract: `docs/YARIZAN-PRICING-AND-CATALOG-CONTRACT.md`. When Stage B goes live, run `node tools/release/check-catalog-drift.mjs https://yarizan.oarnova.games/api/v2/products` before keeping a storefront image in service.

## 6. Health checks

`GET /healthz` → `200`, body `ok`, `text/plain`, `Cache-Control: no-store`, no dependencies; works in every profile. The existing Compose health check command works unchanged.

## 7. Full application network dependencies (Stage B, still blocked)

Unchanged topology from `apps/yarizan/compose.yaml`: Traefik → `ingress` → web :3200 and API :3100 (desktop routes only); web → `app` → api; api → `db` → PostgreSQL 17.11. All internal; no published host port. The full-stack rehearsal in this PR runs exactly this topology locally (plus a loopback-only probe network standing in for Traefik). Stage B web additionally needs `YARIZAN_SITE_MODE=full` and `NUXT_API_BASE=http://api:3100/api/v2/`.

## 8. Stage B API/DB startup order

1. `db` healthy.
2. One-off: `node dist/src/database/migrate.js` with `MIGRATION_DATABASE_URL` (migration owner). Expected count is now **10** (`010_price_provenance`); update S1 and the restore drill from 9 to 10.
3. One-off: `node dist/src/database/production-bootstrap.js --initialize-prices=pricing-2026-10-18-r1` (migration owner). Creates six hidden products with every capability off and the approved prices with audit rows; never overwrites an existing price; re-runs are no-ops.
4. `api` (`node dist/src/main.js`), healthy on `/ready` (DB plus exactly 10 migrations).
5. `web` (`full`).
6. Admin publishes G1 and marks G2–G6 Coming Soon in `/zanyari` (audited, recent SMS MFA). Until then the live catalog is empty.

Steps 4–6 remain impossible in production while the gates are closed.

## 9. Egress (Stage B only)

| Purpose | Host | Status |
| --- | --- | --- |
| SMS OTP (MeliPayamak pattern) | `rest.payamak-panel.com` (HTTPS) | Needed for G6; allowlist from the API network only |
| Payments | `payment.zarinpal.com` (HTTPS) | Not requested now; `ZARINPAL_LIVE_GATE_CLOSED` |

The storefront needs **no egress**.

## 10. Database bootstrap and price initialization

See §8. Run as one-off jobs, never at API start. The development seed refuses `NODE_ENV=production`. Price provenance and append-only history are enforced by migration 010.

## 11. CDN, caching, errors and SEO

- Cacheable: only `/_nuxt/`, `/brand/`, `/fonts/` (hashed or versioned); `/robots.txt` and `/sitemap.xml` for 5 minutes. Everything else `no-store`, including refused requests.
- Errors: disabled pages `503` Persian HTML; disabled API `503` JSON with `Retry-After: 3600`; unknown paths `404` Persian HTML; wrong method `405` JSON with `Allow: GET, HEAD`. The CDN must pass origin errors through (B13).
- First deployment stays **noindex**: `X-Robots-Tag: noindex, nofollow` on every response, `robots.txt` = `Disallow: /`, `<meta name="robots" content="noindex, nofollow">`. Keep the infrastructure `yarizan-noindex` middleware too.
- To allow indexing later the owner must accept TLS, real content, mobile rendering, CDN behaviour, error pages, canonical URLs and prices; then set `YARIZAN_SEO_INDEXING=index` and remove `yarizan-noindex`. Protected routes stay noindex regardless, and the sitemap lists only `/`, `/products`, `/products/grade-1…6`, `/support` with canonical `https://yarizan.oarnova.games` URLs.

## 12. Exact route contracts

| Profile | Method + path | Answer |
| --- | --- | --- |
| storefront | `GET/HEAD /`, `/products`, `/products/grade-[1-6]`, `/support` | 200 HTML |
| storefront | `GET/HEAD /healthz`, `/robots.txt`, `/sitemap.xml`, `/_nuxt/*`, `/brand/*`, `/fonts/*` | 200 |
| storefront | `/account*`, `/login`, `/connect`, `/zanyari*`, `/checkout*`, `/payment*`, `/reset-password`, `/support-reset` | 503 HTML, `Retry-After: 3600` |
| storefront | any `/api/*`, including every desktop route | 503 JSON |
| storefront | encoded, dotted, double-slash, trailing-slash or case variants | 404 |
| full (Stage B) | desktop routes exactly as in `staged/yarizan-app.yml` (unchanged; `GET desktop/entitlements` is now used by the client for automatic activation) | API |

## 13. Digest-only deployment

Deploy only `ghcr.io/osameh15/yarizan-web@sha256:<64 hex>` from a validated manifest with `release_scope: public-storefront` and image eligibility `public-storefront-candidate`. The manifest records the source commit, profile, digest, Trivy policy result for that exact digest (zero HIGH/CRITICAL), CI run URL and migration count. `node tools/release/validate-manifest.mjs release-manifest.json` must pass. `scripts/yarizan-preflight.sh` already refuses non-digest references.

## 14. Release approval

- Workflow: `.github/workflows/release-storefront.yml` (manual dispatch with a full commit SHA that has four green CI workflows).
- Protected environment: **`yarizan-release-public-storefront`**, separate from `yarizan-release-stage-a`. Approving one never authorizes the other; neither can publish full web or API images.
- Sequence: verify → credential-free build and scan of the candidate (policy gate) → reviewer approval → push of the same OCI archive with preserved digests → read-back digest check → attestation → manifest.
- Owner prerequisites: create the environment with required reviewers; approve the `storefront-*` tags on the `yarizan-web` package.

## 15. Rollback

1. Re-deploy the previous storefront digest from its manifest (same project, recreate `web` only), or
2. switch the route file back to the V2 brochure project (previous brochure digest), or
3. switch back to `dynamic/yarizan-maintenance.yml`.

No database is involved, so rollback has no data step. Never touch the legacy PHP/MySQL service.
