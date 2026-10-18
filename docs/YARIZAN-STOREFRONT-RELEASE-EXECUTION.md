# Public storefront release execution — 2026-10-18

PR #7 merged as `e0f11da5929deb6b59e9650b2d9d2fa6386c46fb`, preserving pricing, storefront isolation, release authorization fixes, commercial gates and the Windows contact modal. All four CI workflows passed on that actual merged SHA:

- Windows: https://github.com/osameh15/YariZan/actions/runs/39120774758
- Backend: https://github.com/osameh15/YariZan/actions/runs/39120774766
- Web: https://github.com/osameh15/YariZan/actions/runs/39120774782
- Images/rehearsals: https://github.com/osameh15/YariZan/actions/runs/39120774769

Protected storefront release run: https://github.com/osameh15/YariZan/actions/runs/39121124075

Source verification, candidate build and exact-digest scan passed. Publication is waiting for the owner to approve the protected job in GitHub. The environment requires reviewer `osameh15`, disables administrator bypass and permits main only. It initially prevented self-review; the owner explicitly waived the second-person requirement for solo operation, so self-review is now allowed while required manual approval remains. The agent did not approve its own run. No GHCR publication, final release manifest or production cutover is claimed. The upstream base-image tag still resolves to the reviewed digest; no dependency upgrade or scan exception was introduced.

Infrastructure PR: https://github.com/OAR-NOVA-Games/oarnova-infrastructure/pull/30

The infrastructure execution record is `docs/reports/2026-10-18-yarizan-storefront-launch.md` in that repository. It records merges, safe branch cleanup, public/VPS baseline, rollout/rollback implementation, the owner-run script and remaining approval/production acceptance requirements. The pending infrastructure manifest is deliberately not deployable.

No Backend production gate or live ZarinPal gate was opened. No real SMS/payment/signing, production database, commercial activation, indexing, DNS/CDN change or public development mode was enabled. Existing screenshots are retained; production storefront screenshots and acceptance await actual publication and owner-run deployment.

## First publication attempt (run 39121124075) — incomplete, do not deploy

After owner approval the publish job pushed the scanned candidate to GHCR and verified it: `ghcr.io/osameh15/yarizan-web:storefront-e0f11da5929d` = `sha256:abd843946c0a93d84cc73e803f2529a80e711cfb993cbdb7bd0910bd92aad3e8` (equal to the scanned digest). The next step, `actions/attest-build-provenance` with `push-to-registry`, failed with `No credentials found for registry ghcr.io`: the job had logged in with skopeo's own credential file and logged out before attestation, while the attestation action reads Docker-format credentials. No GitHub attestation and no release manifest were produced, so this digest has no manifest and must not be deployed.

Correction (both release workflows): the push logs in to one job-scoped Docker-format credential file (`$HOME/.docker/config.json`), keeps it through the attestation step, then removes it in an `if: always()` step. `tools/release/release-workflows.test.mjs` asserts the login → attest → cleanup order and that no logout happens before attestation. Publication must be re-dispatched from main after this correction merges; the new run produces its own scanned candidate, attestation and manifest.

## Second publication (run 39127424927) — published and verified

- Source: `main@209887c368e2a7f3dce571fbfbc0f4bc3ec4c18d` (PR #9 merged; all four workflows green on that SHA), dispatched from `main`, approved by the owner in `yarizan-release-public-storefront`. All four jobs succeeded: https://github.com/osameh15/YariZan/actions/runs/39127424927
- Image: `ghcr.io/osameh15/yarizan-web@sha256:9febe61a9689640c76c241b701c91cfc4fc994e9c71adaa4dd5c58745f2c2be4`, tag `storefront-209887c368e2`.
- Scan bound to that digest: 0 Critical, 0 High, 1 Medium (`stage-a-zero-high-critical` policy).
- Provenance: GitHub attestation https://github.com/osameh15/YariZan/attestations/57124648 (SLSA v1; subject is the digest; workflow `release-storefront.yml` at `refs/heads/main`; uploaded to repository and registry).
- Release manifest validated by `tools/release/validate-manifest.mjs` and by the infrastructure validator `scripts/storefront-release.py`. GHCR serves the digest anonymously (HTTP 200).
- Infrastructure PR https://github.com/OAR-NOVA-Games/oarnova-infrastructure/pull/32 records this manifest. Deployment remains an owner-run step with `scripts/launch-yarizan-storefront.sh`; the live site serves the maintenance page until then.

## Production launch — 2026-10-18 (live)

`https://yarizan.oarnova.games` now serves the public storefront image `ghcr.io/osameh15/yarizan-web@sha256:9febe61a9689640c76c241b701c91cfc4fc994e9c71adaa4dd5c58745f2c2be4` (source `main@209887c`), deployed by the owner with infrastructure bundle `7de0d7d8023a8c5fcd49c8f6c882fdd8d34b031c`.

- Two earlier launch attempts rolled back automatically with all checks passing: (1) the VPS Docker daemon timed out reaching GHCR blob storage, solved by loading the exact digest from a verified OCI archive into the containerd image store; (2) the infrastructure acceptance script had an encoding-corrupted price check, fixed in infrastructure PR #33 (byte-escaped price, named failures, CI acceptance against the published image).
- Final launch: server and public acceptance ALL PASS (origin and CDN); release recorded `ok`.
- Independent public check from the workstation: 35/35 storefront acceptance checks; `noindex, nofollow`; `robots.txt` disallows all; `no-store`; HSTS; CSP.
- Production screenshots (`docs/Images/production/`): `home-1440`, `catalog-1440`, `grade-1-390`, `disabled-checkout-390`. Also checked at 768 px; no horizontal overflow at any width.

Still closed: every Backend production gate and live ZarinPal. No account, payment, licensing or Admin service is reachable; indexing stays off until the owner decides otherwise. Rollback: previous maintenance page via the recorded archive or `scripts/deploy.sh yarizan-maintenance`.

## Post-launch closure — 2026-10-18

- Records merged: app PR #11 as `0edae71121724a1c07dc34addf8cb743b4e6e395`; infrastructure PR #34 as `951bd2dc28f70bfbb08cae6224ba052f97d3d73f`. Merged docs branches deleted after confirming their content is on `main`.
- Health after the merges: `/healthz` 200 and storefront acceptance 35/35 PASS through the public CDN; still `noindex, nofollow`, `robots.txt` disallows all, disabled routes 503.
- Security maintenance: the live image's only finding (1 Medium, CVE-2026-85091 in Alpine `zlib 1.3.2-r0`) is fixed in PR #12 by installing `zlib 1.3.2-r1` on the same pinned base digest; the PR's storefront image scan reports zero findings. The live image is unchanged; replacing it needs a new owner-approved storefront release and an infrastructure manifest update.
- Follow-up documents: `YARIZAN-SEO-LAUNCH-READINESS-AUDIT.md`, `YARIZAN-PAYMENT-READINESS-DASHBOARD-DESIGN.md`, `YARIZAN-BACKEND-GATE-READINESS-PLAN.md`.
