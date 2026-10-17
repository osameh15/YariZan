# YariZan V2 — Production Readiness Report (Stage A brochure launch)

Date: 2026-10-16. Branch: `feat/yarizan-v2-production-readiness`. Draft PR: https://github.com/osameh15/YariZan/pull/5 (not merged).
Application baseline: `main@30ffa0580f6f743ee4d5241585b584d1dad6ef1a`. Infrastructure baseline (read only): `OAR-NOVA-Games/oarnova-infrastructure@3e9d6b0ceb9e2fae4c24623e4f9eb601aa27a031`.

**Verdict.** The application side of Stage A is implemented, tested and ready for independent review. A production-mode brochure web image serves the public site with no Backend, PostgreSQL, SMS, payment or signing service, and every sensitive route fails closed. Stage B (full application) remains blocked: the API still refuses `NODE_ENV=production`. **No image was published and nothing was deployed.** Publication waits for an owner gate (§11).

## 1. Branch, HEAD and commits

The final HEAD is the PR head after the last push of this report; a report cannot contain its own commit hash. Commits on the branch since `main`:

| Commit | Milestone | Subject |
| --- | --- | --- |
| `4a5f677` | (earlier) | docs: record YariZan production readiness gaps and rollout plan |
| `745834c` | (earlier) | feat(web): add independent production liveness endpoint |
| `a51fac6` | (earlier) | test(web): verify production liveness response contract |
| `026d772` | (earlier) | docs: record health probe implementation and pending CI acceptance |
| `a642053` | housekeeping | chore: prune committed screenshots and keep curated desktop and web set |
| `52f7ae8` | A | docs: finalize production audit with desktop route, gate and rate-limit findings |
| `0ae5b79` | B | feat(web): add fail-closed brochure-only site mode with server-side route allowlist |
| `66e22bb` | C | feat: harden images and separate migrations from API startup |
| `0318a33` | D | ci: add image validation, rollback rehearsal and approval-gated GHCR release workflows |
| `e8d1c57` | E | docs: add infrastructure handoff, release and rollback runbook for staged launch |
| (this commit) | F | ci/docs: image evidence upload fix, readiness report, audit update, brochure screenshots |

No history was rewritten; no other branch was modified.

## 2. Changed files (milestones A–F)

- Web: `apps/web/shared/site-mode.ts`, `shared/catalog-snapshot.ts`, `shared/domain.ts`, `server/middleware/site-mode.ts`, `server/plugins/00.site-mode.ts`, `server/utils/site-mode.ts`, `app/plugins/site-mode.ts`, `app/composables/useSiteMode.ts`, `app/composables/useCatalog.ts`, `app/components/ProductCard.vue`, `app/layouts/default.vue`, `app/pages/{index,support}.vue`, `app/pages/products/{index,[slug]}.vue`, `app/error.vue`, `app/assets/css/main.css`, `nuxt.config.ts`, `Dockerfile`, `package.json`, `eslint.config.mjs`, `playwright.config.ts`, `playwright.brochure.config.ts`, `tools/build-profile.mjs`, `tests/brochure/{brochure.spec.ts,tripwire.mjs}`, `tests/unit/site-mode.test.ts`, `README.md`.
- Backend: `backend/Dockerfile`, `compose.yaml`, `src/config.ts`, `src/api/controllers.ts`, `src/database/{migrate,seed,production-bootstrap,runtime-grants,schema-version}.ts`, `migrations/roles/create-runtime-role.sql` (replaces `tools/runtime-role.sql`), `test/{core,integration}.test.ts`, `tools/check-runtime-env.mjs`, `README.md`.
- Release tooling: `tools/release/{manifest.mjs,manifest.test.mjs,validate-manifest.mjs,check-web-image.mjs,rollback-rehearsal.mjs}`.
- CI: `.github/workflows/{images.yml,release-images.yml}` (new), `web-ci.yml`, `backend-ci.yml` (actions pinned, `main` push trigger, brochure suite, image steps moved).
- Docs: `docs/YARIZAN-PRODUCTION-READINESS-AUDIT.md`, this report, `docs/YARIZAN-INFRASTRUCTURE-HANDOFF-V2.md`, `docs/YARIZAN-RELEASE-AND-ROLLBACK.md`, `docs/Images/brochure/*` (10 screenshots), root `README.md`, `.gitignore`.

Exact list: `git diff --name-status 30ffa05 <final HEAD>`.

## 3. Readiness matrix

| Scope | Before (initial audit) | After | Remaining |
| --- | --- | --- | --- |
| 1. Nuxt SSR | NEEDS WORK | **READY for Stage A review**: `/healthz`; brochure build; verified with API absent, read-only, no network | CDN acceptance after the route switch |
| 2. NestJS startup | BLOCKED | BLOCKED (by design): gate refactored into six named closed gates with tests | Owner decisions G1, G4, G5, G6, G8 |
| 3. Migrations | NEEDS WORK | **DONE (application side)**: one-off migrate/verify/bootstrap, count 9, roles, grants, rehearsal | Infrastructure updates S1 to 9 |
| 4. Secrets/signing | BLOCKED | BLOCKED: no key path in images; custody undecided | G1/G8 custody design |
| 5. Auth/session/CSRF/MFA | NEEDS WORK | Stage A: not present in the brochure build. Stage B unchanged | G6 |
| 6. Desktop licensing | BLOCKED | Route contract confirmed from source (open questions 1–2 answered) | Physical Windows acceptance, signing |
| 7. Commerce/payment | BLOCKED | BLOCKED (`ZARINPAL_LIVE_GATE_CLOSED`); absent from brochure build | Merchant acceptance |
| 8. Rate limiting | NEEDS WORK | Reviewed; IP-bucket collapse documented; Stage A has no API | Trusted client IP or per-device limits |
| 9. Images/runtime | NEEDS WORK | **DONE**: digest-pinned base, uid 1000, read-only, no package managers, content/secret checks, 20 s shutdown | — |
| 10. CI/release/rollback | NEEDS WORK | **DONE (application side)**: validation, approval-gated GHCR publication, manifest, rehearsal | Owner creates `yarizan-release-stage-a`; first publication (brochure image only) |
| 11. Monitoring/backup | BLOCKED | BLOCKED (infrastructure) | Keys, bucket, restore drill (expected count 9) |
| 12. CDN/errors/cache | NEEDS WORK | Application contract implemented and tested locally | Live CDN tests (B13) |

## 4. Brochure-only behavior (Stage A)

- Build-time profile (`YARIZAN_BUILD_PROFILE=brochure`) removes every page except `/`, `/products`, `/products/:slug`, `/support`, and removes the `/api/v2` proxy and payment return handler from the server bundle. Verified: the built server contains only the `healthz` route and the renderer.
- Runtime `YARIZAN_SITE_MODE` must equal the profile; otherwise the server exits before listening (`REQUIRED`, `INVALID`, `MISMATCH`).
- Server middleware runs before any page or handler and evaluates the raw request target against an exact allowlist:
  - public pages (GET/HEAD) → `200`;
  - disabled pages (`/account`, `/login`, `/connect`, `/zanyari`, `/checkout`, `/payment`, `/reset-password`, `/support-reset`, any case) → Persian `503`, `no-store`, `Retry-After: 3600`;
  - any `/api` path, method or case → `503 {"error":{"code":"SERVICE_UNAVAILABLE"}}`, `application/json`, `no-store`, `Retry-After: 3600`, no `Set-Cookie`;
  - trailing slashes, aliases (`/products/yarizan-g1`), encodings (`%`), dot segments, `//`, `;`, backslashes, non-ASCII, `_payload.json` → Persian `404`, `no-store`;
  - other methods on pages, assets or `/healthz` → `405` with `Allow: GET, HEAD`.
- The client route guard uses the same list; client-side navigation to a disabled route renders the `503` page.
- The catalog is a reviewed static snapshot (`brochure-2026-10-16`): six grades, Grade 1 "معرفی محصول", Grades 2–6 "به‌زودی", sale/trial/activation all false. **No price is shown** ("قیمت هنگام آغاز فروش اعلام می‌شود") because no retail price has been approved; an owner-approved price can be added to the snapshot.
- A persistent Persian notice explains that registration, login, purchase, activation and trial start are not available. Header, footer, home, product and support pages show no link to disabled flows; support phone numbers remain.

## 5. Production Backend gate status

`NODE_ENV=production` → `PRODUCTION_GATE_CLOSED: G1_FIRST_CLAIM_ASSURANCE,G1_SIGNING_CUSTODY,G4_DESKTOP_CREDENTIALS,G6_ADMIN_SMS_MFA,G5_TRUSTED_RATE_LIMITS,G8_SECRET_CUSTODY`. Every gate is `open: false` in source; tests prove that environment flags (`PRODUCTION_READY`, `PRODUCTION_GATES`, gate names) cannot open them. `COMMERCE_MODE=zarinpal` still fails with `ZARINPAL_LIVE_GATE_CLOSED`. No development or test mode is proposed for the VPS.

## 6. Docker hardening evidence

| Check | Web brochure | Web full | API |
| --- | --- | --- | --- |
| Base | `node:24.22.0-alpine@sha256:44fce696…937f` | same | same |
| User / command | `1000:1000`, `node .output/server/index.mjs` | same | `1000:1000`, `node dist/src/main.js` |
| Package managers in runtime | none | none | none |
| `/app` writable | no | no | no |
| Keys, `.env`, maps, tests, sources, secret patterns | none (243 files scanned) | none (296 files) | none |
| Fail-closed startup | `YARIZAN_SITE_MODE_REQUIRED/INVALID/MISMATCH` | same | `NODE_ENV_REQUIRED/INVALID`, `PRODUCTION_GATE_CLOSED`, `ZARINPAL_LIVE_GATE_CLOSED` |
| Hardened run | `--read-only --cap-drop ALL --network none --memory 384m --cpus 0.75`, tmpfs `/tmp` | same | `--read-only --cap-drop ALL --memory 512m`, tmpfs `/tmp` |
| Graceful stop (CI) | 59 ms | 55 ms | 67–73 ms |
| Trivy 0.76.0, fixable HIGH/CRITICAL | 0 | 0 | 0 |

Full Trivy findings by severity are written to the `image-evidence-*` artifacts from the final run (the first run's upload missed a hidden directory; fixed in this commit).

## 7. Migration and database-role evidence

- 9 migrations; `SCHEMA_MIGRATION_COUNT = 9` checked against the directory by a unit test and by `/ready`.
- `migrate.js`: one transaction, advisory lock, hash and order drift detection, runtime grants after migrating; production requires a separate `MIGRATION_DATABASE_URL`.
- Container checks: production migration without a migration login → `MIGRATION_DATABASE_URL_REQUIRED`; same login twice → `INDEPENDENT_DATABASE_CREDENTIALS_REQUIRED`; development seed in production → `DEVELOPMENT_SEED_REFUSED`; read-only migration (9) and `--verify` pass.
- Runtime role tests (PostgreSQL 17): no `UPDATE` on audit or migration metadata, no `ALTER`, `CREATE TABLE`, `TRUNCATE` or `DELETE FROM audit_logs`; `DELETE` on `discount_products` still allowed (found during this audit: the previous grants would have broken coupon-product edits under the runtime role); `--verify` works with runtime privileges.
- Production bootstrap: idempotent, never edits existing catalog rows or prices (integration test).
- Fresh migration and schema drift: `node tools/check-schema.mjs` in Backend CI; migration replay and hash drift test in the integration suite.

## 8. CI/CD architecture

Five separated stages (`docs/YARIZAN-RELEASE-AND-ROLLBACK.md`): PR CI; image build and security validation (no registry credentials); manual, approval-gated publication of the brochure web image only (`release-images.yml`, environment `yarizan-release-stage-a`, manifest scope `stage-a-brochure`); manual reviewer approval; release manifest handoff. Publication verifies the commit is on `main` or a same-repository PR and that all four required workflows succeeded for that exact SHA. Least-privilege permissions per job; third-party actions pinned to full SHAs; SBOM, `mode=max` provenance and GitHub build attestation on publication. No deployment job exists.

## 9. Published image digests

**None.** No image was published. Locally and in CI, images were built and pushed only to a disposable local registry for the rollback rehearsal; those digests are rehearsal artifacts and must not be deployed.

## 10. Route and security contract validation

- Desktop route list D1 confirmed from source; no wildcard route; no desktop route in the browser proxy.
- Brochure acceptance (`tests/brochure/brochure.spec.ts`): 16 disabled pages, 28 API method/path combinations including all ten desktop routes with forged `Origin`, cookies, CSRF and bearer headers, 13 bypass variants, 405 checks, JavaScript disabled, client navigation, CSP/security headers, healthz, a11y (WCAG 2 A/AA), mobile overflow, screenshots; a tripwire on the API port recorded **0** requests.
- Local versus live: all status/error/cache results are **local** (CI or workstation). **No CDN test was run.** `400/401/403/409/429` passthrough remains B13; Stage A itself emits only `200`, `404`, `405`, `503`.

## 11. Registry permission blockers

1. Environment `yarizan-release-stage-a` with required reviewers does not exist (the repository has only `licensing-production`, without protection rules). `release-images.yml` refuses to publish until it exists.
2. Owner acceptance of GHCR package names and visibility.

## 12. Resource usage

| Container | Limit | Measured (CI) |
| --- | --- | --- |
| Web brochure | 384 MiB / 0.75 CPU | 41.2 MiB after 60 requests, ~0 % CPU idle |
| Web full | 384 MiB / 0.75 CPU | 26.1 MiB (no API) |
| API (test/development mode) | 512 MiB / 1 CPU | 37.6–38.3 MiB idle after readiness |

No infrastructure budget change is requested.

## 13. Screenshots (brochure build, synthetic content)

| Screen | Image |
| --- | --- |
| Home, desktop / mobile | [1440](Images/brochure/home-1440.png), [390](Images/brochure/home-390.png) |
| Product catalog | [1440](Images/brochure/catalog-1440.png) |
| Grade 1 product, desktop / mobile | [1440](Images/brochure/grade-1-1440.png), [390](Images/brochure/grade-1-390.png) |
| Support | [1440](Images/brochure/support-1440.png) |
| Disabled checkout (503) | [390](Images/brochure/disabled-checkout-390.png) |
| Disabled login/account (503) | [1440](Images/brochure/disabled-account-1440.png) |
| Disabled Admin (503) | [1440](Images/brochure/disabled-admin-1440.png) |
| `/healthz` | [1440](Images/brochure/healthz-1440.png) |

The full set (16 images, both widths) is produced by `npm run test:brochure` and uploaded by web CI.

## 14. CI evidence and test counts

Milestone D head `0318a33` — all four workflows succeeded:

| Workflow | Run | Result |
| --- | --- | --- |
| CI (Windows) | [38943490615](https://github.com/osameh15/YariZan/actions/runs/38943490615) | V2 checks 300 passed / 0 failed; 8 launcher; 36 book |
| V2 Backend CI | [38943490612](https://github.com/osameh15/YariZan/actions/runs/38943490612) | 162 passed / 0 failed / 0 skipped; schema comparison; 78-route contract snapshot; OpenAPI lint; secret scan; `npm audit` 0; manifest validator 5 passed |
| V2 Web and Provisioning CI | [38943490922](https://github.com/osameh15/YariZan/actions/runs/38943490922) | unit 41 passed (4 files); full browser 50 passed; brochure 14 passed; C# provisioning 24 passed; typecheck, lint, format, contracts, copy, secret scan |
| Image build and security validation | [38943490917](https://github.com/osameh15/YariZan/actions/runs/38943490917) | web brochure, web full, API container checks; Trivy fixable HIGH/CRITICAL 0; rollback rehearsal passed |

Local workstation (Windows, Docker Desktop): backend 162/162, web unit 41/41, full browser 50/50, brochure 14/14, both container checkers and the rollback rehearsal passed.

Final-HEAD CI for this commit is reported in the PR conversation after it completes.

Not covered by CI: physical Windows devices, real SMS/ZarinPal providers, live infrastructure, CDN.

## 15. Dependency vulnerabilities and remaining risks

- Web build-time advisories remain visible and unchanged: `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv); full `npm audit` reports 11 high in development dependencies. Runtime audit: zero high/critical; the deployed `.output` excludes them.
- Backend `npm audit`: 0.
- Risks: IP-keyed rate-limit collapse (Stage B); no signing custody; Admin MFA impossible without SMS egress; `GET desktop/entitlements` unused but routed; brochure is indexable only if the owner removes `noindex`.

## 16. G1–G9 and B13

| Gate | Status | Application contribution in this PR |
| --- | --- | --- |
| G1 production startup and signing custody | BLOCKED | Gate refactored and named; no key path in images |
| G2 migrations separated from runtime | **Application side done** | One-off migrate/verify/bootstrap, roles, tests |
| G3 digest-pinned images | **Application side done**; publication pending owner gate | Hardened images, release workflow, manifest |
| G4 desktop routes | **Application answer delivered** | D1 confirmed; open questions 1–2 answered |
| G5 rate limiting | BLOCKED | Review and risk statement |
| G6 SMS and Admin MFA | BLOCKED | Exact egress host stated |
| G7 backup and restore | BLOCKED (infrastructure) | S1 = 9, S2 table list, S3 key list |
| G8 secret/key custody | BLOCKED | Key list for restore |
| G9 origin security and full-host recovery | BLOCKED (owner/provider) | — |
| B13 CDN error passthrough | 503 verified by infrastructure; others pending | Error contract implemented and tested locally |

## 17. Infrastructure changes requested

1. Separate brochure Compose project (web only, no `depends_on: api`) and a brochure route file without desktop routers (`docs/YARIZAN-INFRASTRUCTURE-HANDOFF-V2.md` §2.1).
2. Update S1 expected migrations from 8 to 9; update the handoff baseline to `main@30ffa05` + this PR.
3. Pull-token handling only if GHCR packages become private.

## 18. Rollback plan

`docs/YARIZAN-RELEASE-AND-ROLLBACK.md` §5: digest-based rollback; Stage A falls back to the maintenance page; Stage B forward-only migrations; never delete database volumes; rehearsed in CI.

## 19. Owner actions required

1. Create environment `yarizan-release-stage-a` with required reviewers; accept the GHCR package name `yarizan-web` and its visibility.
2. Run `Release images` for the reviewed commit and approve publication.
3. Approve the infrastructure PR for the brochure topology and a deployment window.
4. Decide whether the brochure site may be indexed and whether to publish an approved Grade 1 price.
5. For Stage B: signing custody, first-claim assurance, SMS provider/egress, trusted client IP, backup keys and restore drill, merchant acceptance.

## 20. Actions intentionally not performed

No merge; no deployment; no image publication; no VPS/SSH access; no DNS, CDN, Origin Lockdown, Traefik or live Compose change; no infrastructure repository change; no production secret or signing key; no live payment, refund or SMS; no repository settings change (environments were only read).

## 21. Release follow-up (after `f2a5c17`)

### 21.1 Stage A publication scope

The owner approved only the Stage A brochure launch. At `f2a5c17`, one approval of `release-images.yml` published three images (brochure web, full web, API), so approving Stage A would also have pushed Stage B images. Changes:

- `release-images.yml` now publishes only `yarizan-web` with profile `brochure`. The full web and API matrix entries were removed, and a guard step refuses any other image before registry login.
- The protected environment is renamed to `yarizan-release-stage-a`. It did not exist yet, so no approval is lost. A future Stage B publication must use a separate environment and a separate reviewed workflow change.
- The release manifest carries `release_scope`. The validator accepts `stage-a-brochure` only when the manifest contains exactly the brochure web image, and it has no published scope for Stage B images. The local rollback rehearsal uses `local-rehearsal`, which is valid only with `--local`.
- Retained: commit and CI-evidence verification, required-reviewer check, digest-only references, SBOM, `mode=max` provenance, GitHub attestation, Trivy scan of the published digest, manifest validation, and no deployment job.
- Tests: `node --test tools/release/manifest.test.mjs` (7 tests, including Stage A scope and Stage B rejection).

### 21.2 Brand Kit files added in `f2a5c17`

The final commit of the first pass also included seven untracked Brand Kit files from the owner's working tree. They were not requested for this PR. History is not rewritten, and the asset set is unchanged pending an owner decision.

| File (under `docs/YariZan_Brand_Kit_v1/`) | Size | Referenced? |
| --- | ---: | --- |
| `02_Primary_Logo/02_PNG_Transparent/YariZan_Symbol_Only_64x64.png` | 4,650 B | No |
| `02_Primary_Logo/02_PNG_Transparent/YariZan_Symbol_Only_128x128.png` | 13,022 B | No |
| `02_Primary_Logo/02_PNG_Transparent/YariZan_Symbol_Only_256x256.png` | 37,652 B | Indirectly: byte-identical source of `src/YariZan.App/Resources/YariZan_Symbol_Only_256x256.png` (used by `GamesBookPage.xaml` and `LockPage.xaml`); named in `docs/YARIZAN-PHASE-1-REPORT.md` |
| `02_Primary_Logo/02_PNG_Transparent/YariZan_Symbol_Only_512x512.png` | 117,481 B | No |
| `02_Primary_Logo/02_PNG_Transparent/YariZan_Symbol_Only_1024x1024.png` | 394,474 B | No |
| `02_Primary_Logo/02_PNG_Transparent/YariZan_Symbol_Only_2048x2048.png` | 1,159,668 B | No |
| `04_App_Icon/Windows/YariZan_Symbol_Only.ico` | 62,054 B | No (the app icon `Resources/icon.ico` is identical to `YariZan.ico`, not this file) |

Total: about 1.79 MB. None is shipped in a web or API image, and none affects a build.

Recommendation: keep the `02_PNG_Transparent` folder, because it is the documented provenance of an embedded application resource and the set is complete. The `.ico` is unused; keep it only if the owner wants a symbol-only Windows icon variant in the kit. If the owner prefers this PR to stay free of Brand Kit changes, a follow-up commit can remove any of these files from the tree (history still keeps them). No file was changed or removed without that approval.
