# YariZan V2 — Initial Production Readiness Audit and Delivery Plan

Date: 2026-10-16
Status: AUDIT FINALIZED (milestone A) AND IMPLEMENTED FOR STAGE A REVIEW (milestones B–F); NOT A DEPLOYMENT APPROVAL
Scope: `osameh15/YariZan` application repository; infrastructure contract inspected read-only.
Application baseline: `main@30ffa0580f6f743ee4d5241585b584d1dad6ef1a`
Infrastructure baseline: `OAR-NOVA-Games/oarnova-infrastructure@3e9d6b0ceb9e2fae4c24623e4f9eb601aa27a031`

## Evidence boundaries

This is an initial source-level assessment using GitHub repository files and GitHub Actions metadata. It is **not** an on-host verification, an image build, a restore drill, physical desktop test, CDN end-to-end acceptance, or authorization to switch the live route. Application main CI run 38905111545 completed successfully; infrastructure main CI run 38865693709 completed successfully. The infrastructure handoff report states that the temporary site is live and application containers have not been deployed; the live site was not independently inspected from this audit environment.

## Implementation progress since initial source audit

- `W1` has been implemented on the feature branch: `apps/web/server/routes/healthz.get.ts` returns the exact plain-text `ok` response with `Cache-Control: no-store`, without any dependency on Backend or PostgreSQL.
- `apps/web/tests/e2e/healthz.spec.ts` asserts the HTTP status, response body, content type, and cache policy against a built Nuxt server.
- These changes have **not yet been independently validated by completed final-HEAD CI** at the time of this update. All other readiness gaps and owner gates remain.

## Status after milestones B–F

The readiness matrix below is the **initial** state. The current state, evidence and remaining owner gates are in [the production readiness report](YARIZAN-PRODUCTION-READINESS-REPORT.md) §3. Summary: Nuxt SSR, images, migration separation and release CI are done on the application side; Stage A brochure mode is implemented and tested; the API production gate stays closed; nothing was published or deployed. Handoff: [YARIZAN-INFRASTRUCTURE-HANDOFF-V2.md](YARIZAN-INFRASTRUCTURE-HANDOFF-V2.md).

## Milestone A — finalized source audit (2026-10-16)

The owner approved a staged launch: **Stage A** is a strictly non-commercial brochure-only Nuxt website; **Stage B** (API, PostgreSQL, accounts, Admin MFA, SMS, ZarinPal, desktop enrollment, signed licenses) stays blocked by G1–G9 and B13. Stage A approval does not open any Stage B gate. Findings below come from source at branch HEAD `a642053`, not from documentation.

### Documentation drift corrected

| Item | Documented | Source truth |
| --- | --- | --- |
| Migration count | Infrastructure S1 baseline: 8; `backend/README.md`: "`001`–`007`" | **9** files, `001_core.sql` … `009_commerce_authority.sql`; `/ready` requires exactly 9 `schema_migrations` rows |
| Infrastructure contract baseline | `feat/yarizan-v2-nuxt-portals@7c34e93` | Application main `30ffa05` (PR #4 merged) |
| API container command | Contract A2 expects `node dist/src/main.js` | `backend/Dockerfile` runs `migrate → seed → main` (fixed in milestone C) |
| Web image | Contract R2/R3 | Unpinned `node:24-alpine`, numeric UID not enforced, npm/yarn shipped in runtime (fixed in milestone C) |

### Desktop route contract (infrastructure D1, open questions 1–2)

The Windows client (`src/YariZan.Core/V2/DesktopV2Client.cs`, `DeviceProvisioning.cs`) calls exactly nine routes under `https://yarizan.oarnova.games/api/v2/`. The backend implements one further desktop route.

| Method and path | Caller | Authentication | Notes |
| --- | --- | --- | --- |
| `POST devices/challenges` | Desktop | None (pre-authentication challenge) | Returns a nonce bound to a purpose |
| `POST devices/authenticate` | Desktop | Device key proof over a fresh `AUTH` challenge | Renews bearer credential |
| `POST device-pairings` | Desktop only | Device key proof over a `PAIR` challenge | Answer to open question 1: **desktop-only**; it is not in the browser proxy allowlist |
| `POST device-pairings/{uuid}/pickup` | Desktop | Device key proof over a `CONFIRM` challenge | Returns enrollment and credential only to the proof holder |
| `GET desktop/trials/{sku}/status` | Desktop | Bearer | Consumes nothing |
| `POST desktop/trials/{sku}/start` | Desktop | Bearer | Nonce-bound, idempotent |
| `POST desktop/licenses/pickup` | Desktop | Bearer | |
| `POST desktop/licenses/sync` | Desktop | Bearer | |
| `POST desktop/activation-codes/redeem` | Desktop | Bearer | |
| `GET desktop/entitlements` | **No current client caller** | Bearer | Implemented in `DesktopController`; keep routed only if infrastructure accepts an unused bearer-only route, otherwise retire in a later release |

Answer to open question 2: the only desktop calls without a bearer are the four proof-based calls above (`devices/challenges`, `devices/authenticate`, `device-pairings`, `device-pairings/{uuid}/pickup`). None of them uses cookies, `Origin` or CSRF headers. Retired routes: `POST devices/register` and `POST device-pairings/{uuid}/desktop-confirm` return `410`. Browser-only pairing routes are `POST device-pairings/{uuid}/(preview|confirm|cancel)`; they require the exact browser `Origin`. No other method is implemented on desktop paths; Express returns `404` for unlisted methods.

### Production gate inventory (`backend/src/config.ts`)

`NODE_ENV=production` is refused unconditionally with `PRODUCTION_GATE_CLOSED`. The single message protects these unresolved conditions:

1. First-claim/physical ownership assurance (G1, commercial checklist item 1).
2. External commercial signing custody: development keys are generated under `/app/.local`; no production signer exists (G1, G8).
3. Desktop credential integration with production public roots (G1, G4).
4. Admin MFA depends on SMS; `SMS_PROVIDER=disabled` leaves no Admin login path, and live SMS needs egress (G6).
5. Real ZarinPal is separately refused by `ZARINPAL_LIVE_GATE_CLOSED` (commerce gate).
6. Cookies are `Secure` only under production, which cannot start; development cookies are non-Secure by design.

Milestone C makes these conditions explicit, individually named and tested, while keeping the refusal unconditional.

### Rate-limiting review (G5)

Behind Traefik and the CDN, `req.socket.remoteAddress` is a container address. Every key built from it — the global `ip:` middleware bucket (600/min), `pairing-preview`, `pairing-pickup`, `claim-ip`, `sms-request-ip`, `customer-login-ip`, `admin-primary-ip`, `otp-verify-ip`, `payment-return` — collapses into one shared bucket per upstream proxy. This is not a bypass, but one abuser can exhaust these buckets for every user (availability risk). Identity-scoped limits exist and do not depend on IP: `customer-login:<username>` (8/5 min), `admin-primary:<username>` (5/5 min), `otp-phone:<lookup>` (6/h), OTP cooldowns, `sms-account:<customer>` (6/h), `sms-pair:<pairing>` (3/h), `sms-global` (200/h), `machine:`/`customer:` per bearer (120/min), `coupon-probe`, `order-create`, `payment-start` per customer, and `global` (6000/min). Remaining Stage B needs: a verified client-IP header from the CDN chain (infrastructure Pars Pack request #3) or replacement of the IP buckets with per-pairing/per-device keys, and a per-device limit on unauthenticated `devices/challenges`. Stage A runs no API, so none of these endpoints is reachable.

## Infrastructure contract

Authoritative inputs:

- Infrastructure: `docs/yarizan/{README.md,handoff-contract.md,handoff-report.md,database.md,deployment.md}`, `apps/yarizan/compose.yaml`, `infrastructure/traefik/staged/yarizan-app.yml`.
- Application: `backend/{Dockerfile,src/config.ts,src/main.ts,src/database/{database.ts,migrate.ts},tools/runtime-role.sql}`, `apps/web/{Dockerfile,nuxt.config.ts}`, `.github/workflows/{ci.yml,backend-ci.yml,web-ci.yml}`.
- Public hostname: `https://yarizan.oarnova.games`; web `:3200`, API `:3100`, PostgreSQL `db:5432`.
- No public application/database ports, no application internet egress, uid/gid 1000 for API/Web, read-only root filesystems, only approved tmpfs writable.
- Images must be registry-hosted and deployed by immutable `@sha256:` digest. Infrastructure PR and deployment approval are separate from application image publication.
- The existing phase-M temporary page must remain until all owner production gates have been explicitly accepted.

## Preliminary readiness matrix

| Scope | State | Source-backed finding / acceptance evidence still needed |
| --- | --- | --- |
| 1. Nuxt SSR | NEEDS WORK | Existing `apps/web/nuxt.config.ts` uses Nuxt SSR, but no independent `GET /healthz` route was found in the merged repository tree. Contract W1 requires a static `200 ok`, `Cache-Control: no-store`, independent of API and DB. Validate non-cached HTML, CSP and runtime origin in production-mode image. |
| 2. NestJS startup | BLOCKED | `backend/src/config.ts` unconditionally throws `PRODUCTION_GATE_CLOSED` for `NODE_ENV=production`. Running `development` or `test` on VPS is prohibited. Resolve individual gates securely; never remove the check unconditionally. |
| 3. PostgreSQL migrations | NEEDS WORK | Exactly nine source migrations, `001` through `009_commerce_authority.sql`; infrastructure S1 handoff baseline still says eight. `backend/Dockerfile` automatically runs migration and seed before runtime. Separate one-off schema migration and controlled production seed. Verify migration hashes, ownership and 17.11 fresh DB behavior. |
| 4. Secrets and signing | BLOCKED | `backend/src/config.ts` requires independent HMAC/encryption secrets; production signing custody replacing `/app/.local` is not approved. Do not package synthetic keys, merchant secrets, OTP credentials or plaintext `.env` in images. |
| 5. Auth/session/CSRF/Admin MFA | NEEDS WORK | Web routes and backend authentication exist; validate allowed origins, cookie forwarding, CDN `no-store`, trusted session boundaries, admin MFA required when SMS provider is disabled and lack of egress. No privileged fallback. |
| 6. Desktop licensing | BLOCKED | Validate exact desktop method/path list (contract D1) and bearer-only transport against current C# client. Physical first-claim device assurance, signing custody and Windows acceptance are not complete. |
| 7. Commerce/payment | BLOCKED | Real ZarinPal remains disabled by `ZARINPAL_LIVE_GATE_CLOSED`; synthetic payment path is not commercial acceptance. Reconciliation workers must be reviewed for production startup and no egress. |
| 8. Rate limiting | NEEDS WORK | `backend/src/main.ts` uses `req.socket.remoteAddress` for one limiter, but backend sees a proxy/container address. Per-account, mobile, device and global limits must not rely on a trusted client IP until the CDN proxy contract is independently verified. |
| 9. Images/runtime hardening | NEEDS WORK | Both Dockerfiles use unpinned `node:24-alpine` base tags. Backend creates `/app/.local` and runs migrate/seed at startup. Validate read-only root, uid/gid 1000, runtime dependency separation, pinned digest, minimal attack surface and bounded memory. |
| 10. CI/release/rollback | NEEDS WORK | Existing backend and web checks run on PR, main Windows CI passes. No reviewed GHCR by-digest image publication + gated manual release workflow or app-to-infra release manifest verified. Rollback must restore the previous image digest and avoid DB volume deletion. |
| 11. Monitoring/backup | BLOCKED | Infrastructure backup/restore scripts are prepared and CI-tested but not installed on VPS per `docs/yarizan/database.md`. Owner must provision age escrow, B2 bucket and secrets, and perform isolated restore drill before go-live. |
| 12. CDN/errors/cache | NEEDS WORK | Infrastructure documents 503 JSON origin-error passthrough, but still requires live acceptance of 400/401/403/404/409/429 and no-store behavior after authorized route switch. Cached HTML must never contain customer sessions. |

Labels indicate *application-and-infrastructure deployment readiness*, not whether local development features have passed their existing tests.

## Infrastructure acceptance gates

G1 production startup and external signing custody: BLOCKED.
G2 migrations separate from runtime startup and least-privileged runtime login: NEEDS WORK.
G3 verified digest-pinned web/API images: NEEDS WORK.
G4 exact desktop API route contract: NEEDS WORK.
G5 safe anti-abuse without trusted client IP: NEEDS WORK.
G6 live SMS connectivity/Admin MFA with reviewed egress: BLOCKED.
G7 encrypted backup and isolated restore: BLOCKED pending owner-supplied keys/bucket and drill.
G8 durable key/secret custody and recovery: BLOCKED pending owner-approved plan.
G9 full-host recovery/origin TLS limitation: BLOCKED pending owner and provider acceptance.
B13: 503 passthrough documented as verified; remaining required 4xx/429 cases are not yet proven on the production route.

## Implementation sequence (feature branch only)

1. Finish precise WPF/Backend method+route and security-authority audit; write the endpoint allowlist diff against infrastructure D1 (do not widen browser proxy).
2. Implement independent `/healthz` in Nuxt. Harden Web/API Docker multi-stage images with digest-pinned bases, uid/gid 1000, immutable runtime FS and only /tmp writable; remove startup migrate/seed and persistent `/app/.local` assumptions.
3. Separate migrator with an explicit migration operator and reviewed idempotent production seed; test schema 001–009 with PostgreSQL 17.11, immutable hashes, no migrations under runtime credentials, and downgrade/recovery policy.
4. Design typed production config contracts and positive/negative fail-closed tests. Do NOT unlock production until owner accepts first-claim, signing custody, SMS MFA/evidence, restore and gateway gates. Evaluate a separate safe **public brochure-only mode** that cannot activate login, SMS, checkout, enrollment, trial, license or Admin; never achieve this by setting NODE_ENV=development on the public VPS.
5. Implement release CI that validates existing Backend, Nuxt, C# and browser checks; audits runtime/build dependencies; examines image contents for secrets; runs read-only/non-root test containers; builds reproducible images and publishes to GHCR only via explicitly reviewed permissions/approval. Record immutable digests and SBOM/provenance where supported.
6. Produce application-to-infrastructure handoff: exact image references/digests, migrations (9), DB roles, env key NAMES only, route methods, health checks, networking/egress needs, cache/errors acceptance, backup dependencies, resource budget, runbook and rollback. Never include actual secrets.
7. After explicit infrastructure and owner approvals, run an authorized isolated deployment rehearsal and CDN acceptance. Application changes alone cannot authorize a live Traefik switch.

## Owner decisions required before live deployment

- Approve whether the first public application release may be a strictly non-commercial brochure-only Nuxt mode, with all sensitive API-dependent features disabled; or wait for all G1–G9 to pass.
- Choose registry (GHCR proposed) and who may push verified image digests.
- Approve production signing custody and public verification roots; no synthetic signing keys.
- Provision backup encryption identities, off-site retention bucket and independent recovery escrow in the infrastructure session.
- Approve tightly scoped outbound connectivity for MeliPayamak and ZarinPal only if the corresponding operations are later enabled.
- Approve a defined downtime/deployment window and infrastructure PR only when the technical gates have passed.

## Safety guarantees for this audit

- No production server interaction, deployment, DNS/CDN/Traefik change, live payment, live SMS, signing-key generation, database migration, or real-customer data access.
- No changes to `main` or the private infrastructure repository.
- This file is an *initial audit and execution plan*. It must be revised against actual build, runtime, rollback, restore, security and CDN evidence before any deployment approval.
