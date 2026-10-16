# YariZan V2 — Release and Rollback

How application images are built, validated, published and handed to the infrastructure session, and how a release is rolled back. Application CI never deploys. Deployment and every live rollback belong to the infrastructure session and need owner approval.

## 1. Pipeline

| Stage | Workflow | Trigger | Credentials | Output |
| --- | --- | --- | --- | --- |
| 1. PR CI | `CI` (Windows), `V2 Backend CI`, `V2 Web and Provisioning CI` | Pull request to `main`, push to `main` | `contents: read` | Test results, browser evidence |
| 2. Image build and security validation | `images.yml` | Pull request, push to `main`, manual | `contents: read`; no registry login | Built (not pushed) images; container checks; Trivy findings; rollback rehearsal |
| 3. Controlled publication | `release-images.yml` | **Manual only** (`workflow_dispatch`, input: full commit SHA) | `packages: write`, `id-token: write`, `attestations: write` only inside the `publish` job, behind environment `yarizan-release` | GHCR images with SBOM, provenance and GitHub attestation |
| 4. Manual approval | Environment `yarizan-release` required reviewers | Reviewer approves the waiting `publish` job | — | — |
| 5. Deployment handoff | `release-images.yml` → `manifest` job | After publication | `contents: read` | `release-manifest.json` artifact and job summary |

Design rules:

- Pull requests, including forks, never receive registry write credentials: stages 1–2 have read-only tokens and stage 3 does not run on pull requests.
- Stage 3 verifies, before any credential is used, that the commit is a full SHA on `main` or on a same-repository PR branch, and that `CI`, `V2 Backend CI`, `V2 Web and Provisioning CI` and `Image build and security validation` all succeeded for that exact SHA. Untested commits cannot be published.
- It also refuses to continue if environment `yarizan-release` has no required reviewer (GitHub would otherwise create an unprotected environment silently).
- All third-party actions are pinned to full commit SHAs; base images and the scanner are pinned by digest.
- No SSH key, VPS credential, payment key, SMS credential or signing key exists in any workflow or image.
- Build arguments contain only the profile and the source commit.

## 2. Owner actions before the first publication

1. Repository → Settings → Environments → New environment `yarizan-release`. Add required reviewers (at least the owner). Optionally restrict deployment branches to `main` and `feat/yarizan-v2-production-readiness`.
2. Accept the GHCR package names `ghcr.io/osameh15/yarizan-web` and `ghcr.io/osameh15/yarizan-api`. After the first push, decide package visibility. If private, create a read-only pull token for the VPS in the infrastructure session.
3. Run `Release images` with the commit to release; approve the `publish` jobs.
4. Hand `release-manifest.json` (artifact of that run) to the infrastructure session.

## 3. Image validation (stage 2)

`images.yml` runs on every PR and `main` push:

- **Web, brochure and full** (`tools/release/check-web-image.mjs`): image metadata (uid 1000, command, build-profile label, no default site mode), contents (no package manager, sources, tests, `.env`, keys, source maps or synthetic secret patterns; `/app` not writable), startup refusals (`YARIZAN_SITE_MODE_REQUIRED`, `_INVALID`, `_MISMATCH`), runtime with `--read-only --cap-drop ALL --network none --memory 384m --cpus 0.75` and tmpfs `/tmp`, health and route contracts, memory after load, graceful stop under 20 s.
- **API** (`backend/tools/check-runtime-env.mjs`, PostgreSQL 17.11 service): image metadata (`node dist/src/main.js`, uid 1000, no `NODE_ENV`), contents, one-off migration refusals in production without a separate login, development seed refusal in production, read-only migration and `--verify`, startup refusals (`NODE_ENV_REQUIRED`, `NODE_ENV_INVALID`, `PRODUCTION_GATE_CLOSED: …`, `ZARINPAL_LIVE_GATE_CLOSED`), read-only readiness in development/test, memory, graceful stop.
- **Vulnerability scan**: Trivy 0.76.0 (digest-pinned). Full JSON findings are kept as artifacts. The job fails on HIGH/CRITICAL vulnerabilities that have a fix. The two inherited build-dependency advisories reported by `npm run audit:dependencies` stay visible in web CI; they are build-time only and are not silenced.
- **Rollback rehearsal** (`tools/release/rollback-rehearsal.mjs`): see §5.

## 4. Release manifest

Schema `yarizan-release-manifest/v1`, validated by `node tools/release/validate-manifest.mjs <file>` (unit tests: `node --test tools/release/manifest.test.mjs`). The validator rejects mutable tags, malformed or mismatched digests, short commits, a migration count different from `backend/src/database/schema-version.ts`, missing scan evidence and any full-application image classified as deployable.

## 5. Rollback

### 5.1 Rehearsal (automated, disposable)

`tools/release/rollback-rehearsal.mjs <web-brochure-image> <api-image> <manifest-out>` runs in CI and locally:

1. Starts a throwaway local registry and pushes a "previous" and a "next" release of each image; every deployment uses `registry/name@sha256:…`.
2. Web: deploy previous → upgrade to next → roll back to previous, each with hardened flags and a `/healthz` check, asserting that the running container uses the expected digest.
3. API + PostgreSQL: creates a disposable volume, runs the one-off migration and test seed, writes a marker row (standing in for customer and financial records), deploys previous → migrates and runs next → rolls back to previous, then verifies `migrate.js --verify`, 9 `schema_migrations` rows, the marker row and the volume.
4. Writes and validates a local manifest.
5. Removes only the containers, network and volume it created.

### 5.2 Live rollback (infrastructure session, owner-approved)

**Stage A, brochure web:**

1. Set `YARIZAN_WEB_IMAGE` in the server `.env` to the previous brochure digest from the previous manifest; recreate only `web`. Or, to leave Stage A entirely:
2. Restore the maintenance page: deploy `edge` with `dynamic/yarizan-maintenance.yml` active instead of the brochure route, then stop the brochure project.
3. Verify: `scripts/acceptance-external.sh` (maintenance or brochure mode), `/healthz` through the CDN, CDN purge, StatusCake green.

**Stage B, full application:**

1. Read the migration count in the target (previous) manifest. Migrations are forward-only: roll back the API only to a digest whose manifest has the **same** migration count as the live database. If a newer migration has already run, roll forward with a fix instead.
2. Change `YARIZAN_API_IMAGE`/`YARIZAN_WEB_IMAGE` to the previous digests; recreate `api`, then `web`. Do not touch `db`.
3. Verify: internal `/ready` (exactly the expected migrations), `migrate.js --verify` with the runtime login, `/healthz`, desktop and browser acceptance, backup timer still green.
4. If the whole application must go offline, put the maintenance route back and stop `web` and `api` only.

**Never delete a database volume as part of a rollback.** Customer accounts, devices, signed license decisions, trials, orders, payments and audit records cannot be recreated, and offline desktop licenses keep referring to them. Restoring an older backup over newer data requires an explicit, reviewed reconciliation of later entitlements, revocations, codes and payments; it is a recovery operation, not a rollback.
