# YariZan V2 — Initial Production Readiness Audit and Delivery Plan

Date: 2026-10-16
Status: INITIAL READ-ONLY CODE/CONTRACT AUDIT; NOT A DEPLOYMENT APPROVAL
Scope: `osameh15/YariZan` application repository; infrastructure contract inspected read-only.
Application baseline: `main@30ffa0580f6f743ee4d5241585b584d1dad6ef1a`
Infrastructure baseline: `OAR-NOVA-Games/oarnova-infrastructure@3e9d6b0ceb9e2fae4c24623e4f9eb601aa27a031`

## Evidence boundaries

This is an initial source-level assessment using GitHub repository files and GitHub Actions metadata. It is **not** an on-host verification, an image build, a restore drill, physical desktop test, CDN end-to-end acceptance, or authorization to switch the live route. Application main CI run 38905111545 completed successfully; infrastructure main CI run 38865693709 completed successfully. The infrastructure handoff report states that the temporary site is live and application containers have not been deployed; the live site was not independently inspected from this audit environment.

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
