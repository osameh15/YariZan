# YariZan V2 — Full Web Release Report

| Item | Value |
| --- | --- |
| Draft PR | https://github.com/osameh15/YariZan/pull/7 |
| Branch | `feat/yarizan-v2-full-web-release` |
| Base | `main@2fb76b3c43463fd553f75c9bc921b6a3b59155e9` (PR #5 and PR #6 merged; four main workflows green) |
| Last code commit with full CI evidence | `7b72446` (all 11 checks green, §8) |
| Final HEAD | the commit that adds this report; see the PR |
| Infrastructure reviewed | `OAR-NOVA-Games/oarnova-infrastructure@dbc38d8` (read-only; newer than the `7a7a899` in the assignment) |

**Summary.** The public website can now be the complete premium YariZan site with the owner-approved prices: a new `storefront` build profile shows all six grades at ۱٬۲۹۹٬۰۰۰ تومان, G1 as the launch candidate and G2–G6 as Coming Soon, while every account, payment, licensing and Admin action fails closed without a Backend. The full application is unchanged in behaviour, priced from the Backend, and proven end to end in a disposable integration of the production images. Prices have a reviewed, audited and append-only database path. A separately approved release scope (`public-storefront`) can publish the storefront image after the same scan-before-publish gate as Stage A. All six production gates and the ZarinPal gate stay closed. Nothing was merged, published or deployed; no real money or SMS was used.

## 1. Milestones

| Milestone | Result | Commits |
| --- | --- | --- |
| A Pricing and catalog | Approved revision `pricing-2026-10-18-r1`; migration 010 (price provenance, append-only history); audited, revision-confirmed price bootstrap; tests | `95bfef5` |
| B Complete web experience | Phase 4 design preserved; storefront copy for every public page; full-mode customer and Admin pages re-verified (53 browser tests); new full-mode pricing/failure/Admin pricing checks | `93242b6`, `877f6f1` |
| C Secure public profile | `storefront` build/runtime profile with the brochure route boundary plus prices; default `noindex`; robots, public sitemap, canonical and Open Graph | `93242b6`, `877f6f1` |
| D Backend and gateway readiness | Client-supplied prices and disabled-commerce orders refused; gateway contract test; catalog drift checker; gate and merchant documentation | `3c21bf2`, `d605856` |
| E CI/CD | `release-storefront.yml` behind `yarizan-release-public-storefront`; manifest scope `public-storefront`; workflow static tests; both scopes rehearsed; storefront image validation | `e350b52`, `cb7dec8` |
| F Infrastructure handoff | `YARIZAN-INFRASTRUCTURE-HANDOFF-V3.md` | `d605856` |
| G Validation | Full-stack rehearsal (8 stages) green in CI; all suites green | `0d6246e` … `7b72446` |

## 2. Changed files

Backend: `migrations/010_price_provenance.sql`, `src/catalog/approved-pricing.ts`, `src/database/{production-bootstrap,seed,schema-version}.ts`, `src/admin/admin.ts`, `test/{pricing,commerce,core,integration}.test.ts`, `tools/check-schema.mjs`.
Web: `shared/{approved-pricing,catalog-snapshot,domain,site-mode,seo}.ts`, `app/{app.vue,components/ProductCard.vue,composables/useCatalog.ts,composables/useSiteMode.ts,layouts/default.vue,plugins/site-mode.ts}`, `app/pages/{index,support,products/index,products/[slug]}.vue`, `server/middleware/{security,site-mode}.ts`, `server/routes/{robots.txt,sitemap.xml}.get.ts`, `nuxt.config.ts`, `Dockerfile`, `package.json`, `playwright.storefront.config.ts`, `tools/{build-profile,test-fixtures}.mjs`, `tests/unit/{pricing,seo}.test.ts`, `tests/e2e/{pricing,commerce,portals}.spec.ts`, `tests/brochure/brochure.spec.ts`, `README.md`.
Release and integration: `.github/workflows/{release-storefront,images,web-ci}.yml`, `tools/release/{manifest,manifest.test,release-workflows.test,catalog-drift,catalog-drift.test,check-catalog-drift,check-web-image,rollback-rehearsal}.mjs`, `tools/release/stage-a-publication-rehearsal.sh`, `tools/integration/full-stack-rehearsal.mjs`, `.gitignore`.
Docs: this report, `YARIZAN-PRICING-AND-CATALOG-CONTRACT.md`, `YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md`, `YARIZAN-INFRASTRUCTURE-HANDOFF-V3.md`, `YARIZAN-RELEASE-AND-ROLLBACK.md` §6, `ci.md`, screenshots in `docs/Images/full-web/`.

## 3. Current production readiness

| Capability | Ready for production? | Why |
| --- | --- | --- |
| Public storefront (prices, all pages, fail-closed actions) | **Application side ready**, pending owner approval of publication and the infrastructure PR | No Backend, secrets or gates involved; image validated and scanned |
| Brochure site | Ready (unchanged), kept as maintenance/rollback | — |
| Full application (accounts, checkout, licensing, Admin) | **No** | Six named production gates closed; `NODE_ENV=production` refused |
| Real payments | **No** | `ZARINPAL_LIVE_GATE_CLOSED`; merchant evidence missing |

## 4. Approved pricing

Six SKUs at 12,990,000 IRR (۱٬۲۹۹٬۰۰۰ تومان). Integer IRR authoritative, Toman display only, exact BigInt formatting. Price is independent of availability; the storefront sets sale, trial and activation to `false` for every grade. Details, history rules and the bootstrap command: `YARIZAN-PRICING-AND-CATALOG-CONTRACT.md`.

## 5. Public storefront vs full application

| | `storefront` (public) | `full` (isolated integration only) |
| --- | --- | --- |
| Pages | `/`, `/products`, `/products/grade-1…6`, `/support`, 404/503 | All public, customer, checkout, payment and `/zanyari` pages |
| Catalog | Reviewed static snapshot with approved prices | Live Backend `/api/v2/products` |
| Account, connect, checkout, payment, Admin | Persian `503` page; nothing compiled in | Implemented (fake providers in tests) |
| `/api/*` incl. desktop routes | `503` JSON, `Retry-After: 3600` | Allowlisted proxy (browser routes only) |
| Fake payment | Not present | Only with `COMMERCE_MODE=fake`, never on a public host |
| Indexing | `noindex, nofollow` by default | Same |

## 6. Catalog consistency

One approved object in two identical copies (unit test compares them); the storefront renders it; `check-catalog-drift.mjs` compares any live catalog with it and fails on price, availability, missing, unapproved or non-integer drift; the rehearsal proves zero drift after Admin publication.

## 7. Real vs synthetic

| Evidence | Environment |
| --- | --- |
| Backend 170 tests, C# interop | Disposable PostgreSQL 17 in CI; fake SMS and fake ZarinPal; synthetic keys |
| Browser suites | Production-built Nuxt; full mode against an in-process API with fake providers; public profiles with no Backend at all |
| Windows 409 checks | GitHub Windows runner; synthetic identity and keys; real DPAPI/CNG software provider |
| Full-stack rehearsal | Production-built API and full web images, PostgreSQL 17.11, internal networks, `127.0.0.1`-only probe ports; API in `NODE_ENV=development` inside that disposable network (needed for a persisted synthetic signing root); fake SMS/payments |
| Nothing | Was run against the public hostname, a live merchant, a live SMS provider or physical customer hardware |

## 8. CI evidence (code commit `7b72446`)

| Check | Result | Link |
| --- | --- | --- |
| Build (Windows / .NET 9) | `RESULT 409 passed; 0 failed` | [run 39111764144](https://github.com/osameh15/YariZan/actions/runs/39111764144) |
| backend | 170/170 tests plus a separate 10-test suite, `DOTNET_INTEROP 24`, `DOTNET_API 10`, `DOTNET_PROVISIONING 29`, schema 001–009 → 010 match | [run 39111764134](https://github.com/osameh15/YariZan/actions/runs/39111764134) |
| web | unit 51; full e2e 53; brochure 15; storefront 15 | [run 39111764163](https://github.com/osameh15/YariZan/actions/runs/39111764163) |
| web-image brochure / storefront / full, api-image | container contents, read-only non-root runtime, fail-closed mode, memory, Trivy | [run 39111764140](https://github.com/osameh15/YariZan/actions/runs/39111764140) |
| stage-a-publication-rehearsal | release tests 20/20; both scopes: scan pass (0 critical, 0 high, 1 medium), synthetic HIGH and CRITICAL rejected with the publication registry still empty, published digest = scanned digest (brochure `sha256:ea687927…`, storefront `sha256:d47e49df…`) | same run |
| rollback-rehearsal | digest-based previous → next → rollback with 10 migrations preserved | same run |
| full-stack-rehearsal | 8/8 stages (below) | same run |
| GitGuardian | pass | — |

Full-stack rehearsal stages:

1. PostgreSQL 17.11 (infrastructure digest) on an internal network, no published port.
2. Migrations (10) and production bootstrap with `--initialize-prices`: six hidden products, six audited approved prices.
3. API and full web from production images with read-only, cap-drop, no-new-privileges, tmpfs and memory limits.
4. Admin sign-in through the web with password and SMS second factor.
5. Admin publishes G1 and Coming Soon G2–G6; live catalog equals the approved revision (no drift).
6. Desktop routes absent from the web proxy; anonymous orders, Admin and forged payment callbacks refused.
7. Production C# desktop client: pairing, OTP account, G1 purchase, simulated verification, automatic activation, offline restart, revocation and reset.
8. Browser checkout: bad coupon refused, 10% coupon (۱٬۱۶۹٬۱۰۰ تومان), client price and Coming Soon purchase refused, idempotent order, simulated verification, exactly one fulfillment and one signed license, order history, Admin finance and reconciliation trail.

Container security: every web profile and the API image run as uid 1000 with a read-only root filesystem and no package manager; Trivy reports **0 critical, 0 high, 1 medium** for the storefront image. Build-time dependency advisories stay visible in web CI (`audit:dependencies`) and are not silenced. Secret scans (`check:secrets` backend and web) and `npm audit --audit-level=high` (backend) pass in CI.

## 9. Screenshots

Public storefront (`docs/Images/full-web/storefront/`, captured from the storefront build with no Backend): `home-1440`, `catalog-1440`, `grade-1-1440`, `grade-2-1440`, `grade-2-390`, `disabled-checkout-1440`, `disabled-account-390`.

Isolated full-application mode (`docs/Images/full-web/full-application/`, production-built Nuxt with an in-process API and fake providers): `02-checkout-summary`, `03-coupon-accepted`, `04-coupon-rejected`, `05-simulated-gateway`, `06-payment-verification-pending`, `07-verified-purchase`, `03-payment-failed`, `08-customer-orders`, `26-customer-dashboard`, `04-admin-product-pricing`, `14-admin-financial-overview`, `02-grade-2-coming-soon-with-price`, `24-mobile-navigation`, `24-friendly-not-found`, `25-friendly-error`.

## 10. Production blockers

`G1_FIRST_CLAIM_ASSURANCE`, `G1_SIGNING_CUSTODY`, `G4_DESKTOP_CREDENTIALS`, `G6_ADMIN_SMS_MFA`, `G5_TRUSTED_RATE_LIMITS`, `G8_SECRET_CUSTODY`, `ZARINPAL_LIVE_GATE_CLOSED`. For each: implementation, missing evidence, tests, owner decision, infrastructure help and acceptance criteria in `YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md`, plus the 16-item ZarinPal merchant checklist and the 14 payment scenarios mapped to tests.

## 11. Infrastructure change requests (V3)

Storefront Compose project (web only, `YARIZAN_SITE_MODE=storefront`, no `depends_on: api`); storefront route file (no desktop routers, no API service, `yarizan-noindex` kept); the current `apps/yarizan/compose.yaml` web service lacks `YARIZAN_SITE_MODE`; S1 and restore drill expect **10** migrations; Stage B bootstrap order with `--initialize-prices`; SMS egress only for Stage B. Full list: `YARIZAN-INFRASTRUCTURE-HANDOFF-V3.md`.

## 12. GHCR approval requirements

Owner creates environment `yarizan-release-public-storefront` with required reviewers and approves `storefront-*` tags on `ghcr.io/osameh15/yarizan-web`. Then run `Release public storefront image` with a green commit SHA and approve the single publish job. No image was pushed to GHCR in this work.

## 13. Safe deployment and rollback

Deploy the storefront digest from a validated `public-storefront` manifest in its own web-only project with `noindex`. Roll back by re-deploying the previous storefront digest, the brochure project, or the maintenance page; no database step exists for the storefront. Never touch the legacy PHP/MySQL service.

## 14. Owner decisions still needed

1. Approve storefront publication (environment, package tags) and the infrastructure PR.
2. Decide when to allow indexing (`YARIZAN_SEO_INDEXING=index`) after TLS, content, mobile, CDN and price review.
3. Decide each production gate (§10), including signing custody and the ZarinPal merchant account.
4. Whether to add a read-only Admin "payment readiness" page (proposed during this work; not implemented; enabling payments stays a reviewed configuration change, not an Admin button).

## 15. Explicitly not done

No merge; no VPS deployment; no DNS, CDN or Traefik change; no GHCR publication; no real payment or SMS; no commercial signing keys; no gate opened; no development mode on the VPS; no change to the PHP/MySQL service or the infrastructure repository; no unrelated files or processes touched.
