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
