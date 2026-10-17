# YariZan V2 — Release and Rollback

How application images are built, validated, published and handed to the infrastructure session, and how a release is rolled back. Application CI never deploys. Deployment and every live rollback belong to the infrastructure session and need owner approval.

## 1. Pipeline

| Stage | Workflow | Trigger | Credentials | Output |
| --- | --- | --- | --- | --- |
| 1. PR CI | `CI` (Windows), `V2 Backend CI`, `V2 Web and Provisioning CI` | Pull request to `main`, push to `main` | `contents: read` | Test results, browser evidence |
| 2. Image build and security validation | `images.yml` | Pull request, push to `main`, manual | `contents: read`; no registry login | Built (not pushed) images; container checks; Trivy findings; rollback rehearsal |
| 3a. Candidate build and policy scan | `release-images.yml` → `candidate` job | After `verify` | `contents: read` only; pushes to a job-local registry, never GHCR | Scanned OCI archive, Trivy JSON, policy summary |
| 3. Controlled publication (Stage A only) | `release-images.yml` → `publish` job | **Manual only** (`workflow_dispatch`, input: full commit SHA) | `packages: write`, `id-token: write`, `attestations: write` only inside the `publish` job, behind environment `yarizan-release-stage-a` | The brochure web image only, on GHCR, with SBOM, provenance and GitHub attestation |
| 4. Manual approval | Environment `yarizan-release-stage-a` required reviewers | Reviewer approves the waiting `publish` job | — | — |
| 5. Deployment handoff | `release-images.yml` → `manifest` job | After publication | `contents: read` | `release-manifest.json` artifact and job summary |

Design rules:

- Pull requests, including forks, never receive registry write credentials: stages 1–2 have read-only tokens and stage 3 does not run on pull requests.
- Stage 3 verifies, before any credential is used, that the commit is a full SHA on `main` or on a same-repository PR branch, and that `CI`, `V2 Backend CI`, `V2 Web and Provisioning CI` and `Image build and security validation` all succeeded for that exact SHA. Untested commits cannot be published.
- It also refuses to continue if environment `yarizan-release-stage-a` has no required reviewer (GitHub would otherwise create an unprotected environment silently).
- **Scan before publish (fail closed).** The `candidate` job builds the brochure image with SBOM and `mode=max` provenance, pushes it only to a disposable registry inside the job, scans that exact digest with Trivy 0.76.0, and applies `tools/release/check-scan.mjs`: zero HIGH and zero CRITICAL findings, fixed or unfixed, and the report must name the candidate digest. Any failure ends the run before the approval-gated `publish` job, so nothing reaches GHCR and no manifest is written. There is no exception list; an exception needs a separately reviewed policy change. The full Trivy JSON is uploaded either way, so MEDIUM/LOW findings stay visible; the build-only `npm audit` advisories stay visible in web CI.
- **Same artifact.** The candidate is exported as an OCI archive with `skopeo copy --all --preserve-digests`. After reviewer approval, `publish` re-checks the archive SHA-256 and the scan summary, pushes the same archive to GHCR with preserved digests, reads the published manifest back and fails unless its digest equals the scanned digest. Only then does it create the GitHub attestation and the manifest entry, which records the policy, the scanned digest and the counts. The manifest validator rejects a `stage-a-brochure` image whose scan evidence is missing, names another digest or has any HIGH/CRITICAL finding.
- **Publication scope.** The workflow publishes only the brochure web image (`release_scope: stage-a-brochure`). It has no job, matrix entry or manifest scope for the full web image or the API image, and a guard step refuses any other image before registry login. The manifest validator rejects a `stage-a-brochure` manifest that contains anything else, and it has no scope that accepts a published Stage B image. Approving a Stage A release therefore cannot authorize Stage B.
- **Stage B publication is not implemented.** It needs a separate reviewed change: its own workflow (or job) behind a separate protected environment (for example `yarizan-release-stage-b`) with its own reviewers, and a new manifest scope in `tools/release/manifest.mjs`. Both need owner approval after the Stage B production gates are closed.
- All third-party actions are pinned to full commit SHAs; base images and the scanner are pinned by digest.
- No SSH key, VPS credential, payment key, SMS credential or signing key exists in any workflow or image.
- Build arguments contain only the profile and the source commit.

## 2. Owner actions before the first publication

1. Repository → Settings → Environments → New environment `yarizan-release-stage-a`. Add required reviewers (at least the owner). Optionally restrict deployment branches to `main` and `feat/yarizan-v2-production-readiness`. Do not reuse this environment for any future Stage B publication.
2. Accept the GHCR package name `ghcr.io/osameh15/yarizan-web` (Stage A creates no `yarizan-api` package). After the first push, decide package visibility. If private, create a read-only pull token for the VPS in the infrastructure session.
3. Run `Release images` with the commit to release; approve the single brochure `publish` job.
4. Hand `release-manifest.json` (artifact of that run) to the infrastructure session.

## 3. Image validation (stage 2)

`images.yml` runs on every PR and `main` push:

- **Web, brochure and full** (`tools/release/check-web-image.mjs`): image metadata (uid 1000, command, build-profile label, no default site mode), contents (no package manager, sources, tests, `.env`, keys, source maps or synthetic secret patterns; `/app` not writable), startup refusals (`YARIZAN_SITE_MODE_REQUIRED`, `_INVALID`, `_MISMATCH`), runtime with `--read-only --cap-drop ALL --network none --memory 384m --cpus 0.75` and tmpfs `/tmp`, health and route contracts, memory after load, graceful stop under 20 s.
- **API** (`backend/tools/check-runtime-env.mjs`, PostgreSQL 17.11 service): image metadata (`node dist/src/main.js`, uid 1000, no `NODE_ENV`), contents, one-off migration refusals in production without a separate login, development seed refusal in production, read-only migration and `--verify`, startup refusals (`NODE_ENV_REQUIRED`, `NODE_ENV_INVALID`, `PRODUCTION_GATE_CLOSED: …`, `ZARINPAL_LIVE_GATE_CLOSED`), read-only readiness in development/test, memory, graceful stop.
- **Vulnerability scan**: Trivy 0.76.0 (digest-pinned). Full JSON findings are kept as artifacts. The job fails on HIGH/CRITICAL vulnerabilities that have a fix. The two inherited build-dependency advisories reported by `npm run audit:dependencies` stay visible in web CI; they are build-time only and are not silenced.
- **Rollback rehearsal** (`tools/release/rollback-rehearsal.mjs`): see §5.

## 4. Release manifest

Schema `yarizan-release-manifest/v1`, validated by `node tools/release/validate-manifest.mjs <file>` (unit tests: `node --test tools/release/manifest.test.mjs`). The validator rejects mutable tags, malformed or mismatched digests, short commits, a migration count different from `backend/src/database/schema-version.ts`, missing scan evidence, a Stage A image without passing `stage-a-zero-high-critical` evidence for its exact digest, and any full-application image classified as deployable. Every manifest names a `release_scope`: `stage-a-brochure` must contain exactly the brochure web image; `local-rehearsal` is accepted only with `--local` (disposable registry, never published).

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
