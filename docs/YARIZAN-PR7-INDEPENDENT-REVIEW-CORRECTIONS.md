# PR #7 independent review corrections

Review baseline: `fdad2a4b331f6ecc0b12106778f8e10851cc0b01`. The subsequent desktop contact modal commit `9a52c1e` is retained. This correction is an additive commit on the existing PR branch; renewed independent review is required before merge.

## Release authorization

The storefront workflow requires `workflow_dispatch` from `refs/heads/main`. It compares `main...<full target SHA>` and accepts only `identical` or `behind`: the target must already be reachable from main. `ahead`, `diverged`, unexpected/empty responses and API failures stop verification. Same-repository PR association no longer grants eligibility; the PR API fallback and its read permission are removed.

Approved order: independent review ? merge into main ? successful CI on the merged SHA ? dispatch from main ? credential-free build and scan ? separate environment reviewer approval ? publication of the same scanned artifact. The four exact-SHA successful workflow checks and required environment reviewers remain mandatory.

Deterministic tests execute the actual inline verification shell with a local GitHub API stub. They cover main HEAD and ancestors; unmerged/diverged/unknown sources and API failure; PR branch, tag, PR merge ref and empty dispatch refs; wrong event, malformed SHA, missing CI and missing reviewers. Existing scan policy, manifest, scope isolation and digest preservation assertions remain in place. These tests run in the existing image CI job; no release workflow is dispatched during validation.

The Stage A brochure workflow `.github/workflows/release-images.yml` is byte-for-byte unchanged from the review baseline. Storefront-only step labels no longer call their scope Stage A. Scanning, OCI archive checksum, digest-preserving copy, registry digest read-back, SBOM/provenance attestation and manifest validation are unchanged.

## Migration metadata

`backend/src/database/schema-version.ts` declares `SCHEMA_MIGRATION_COUNT = 10`. The storefront manifest job reads this value from the selected source commit. A focused test accepts a current storefront manifest with migration 10 and rejects stale migration 9. No manifest was published.

## Recorded Medium vulnerability

Original final-head evidence: [image run 39112193347](https://github.com/osameh15/YariZan/actions/runs/39112193347), artifact `image-evidence-web-storefront` (artifact id `12130723625`), file `web-storefront-trivy.json`.

- Finding: `CVE-2026-85091`, severity **MEDIUM**, package `zlib`, installed `1.3.2-r0`; scanner lists fixed version `1.3.2-r1`.
- Scanner title reports a heap buffer overflow in zlib versions 1.3.1.2 through 1.3.2.
- This describes the recorded image, not a claim that a future rebuild has the same findings. No reachability or exploitability assessment was independently performed.
- Remediation is a reviewed base-image/package refresh followed by a fresh scan of the exact publication candidate. No suppression, exemption or severity override is added here.
- Publication still refuses **every High or Critical finding, including unfixed findings**. Medium findings remain visible and counted in the scan evidence; fresh publication scans remain mandatory.

## Visual evidence and scope

Existing `docs/Images/full-web/` screenshots are preserved unchanged. This correction does not alter UI code. The earlier desktop contact-modal screenshots and 39 local book checks were produced by this session; the web screenshots, responsive appearance and screenshot-to-build correspondence were not independently re-captured or visually approved during this release-policy correction.

Backend production gates and live ZarinPal gates remain closed. No merge, GHCR publication, deployment, infrastructure modification, indexing change, real provider call or commercial gate opening is authorized or performed. Stop for renewed independent review after final-head CI verification. Exact final SHA and CI links are reported in the delivery response to avoid a self-referential report commit.
