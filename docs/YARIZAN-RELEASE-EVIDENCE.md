# YariZan 2.0.0 release evidence ledger

One place that separates **verified engineering evidence** (test environments, already done) from **release acceptance** still required in the final production configuration. A row moves to "passed" only with its evidence reference. Nothing here is marked passed because a workflow could not run.

Status values: `verified` (done, in a test environment), `passed` (release acceptance done in production configuration), `open`, `owner` (needs the owner's credentials, ceremony, approval or physical action).

## A. Verified engineering evidence (reused, not repeated)

| Area | What was shown | Environment | Evidence |
|---|---|---|---|
| ZarinPal | Successful payment, exactly-once settlement and fulfillment, duplicate callbacks, cancellation, inquiry | Official ZarinPal **sandbox**, no money | `docs/YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md` §9, §9.1, §10.2 (2026-10-21/22) |
| Windows client | V2 automated checks: 419 passed, 0 failed (414 earlier, plus the acceptance-candidate checks) | Windows 10.0.26300, .NET 9.0.20, fixtures | `tests/Run-V2Checks.ps1` run 2026-10-22 on `feat/windows-github-first-release` |
| Licensing crypto | C#/Backend canonical message bytes, ES256 signature verification, offline license behaviour | Disposable keys | `backend/test/vectors/license-message.json`, `backend/test/core.test.ts`, V2Checks |
| MeliPayamak | Exactly two real SMS deliveries, Admin MFA success, wrong-code rejection, replay protection, throttle, 180 s expiry | Real provider, workstation | `docs/evidence/sms-admin-mfa-live-2026-10-21.json` |
| Grade 1 content | 76 game bundles repacked from the updated private assets; the local acceptance launcher carries all 76 | Workstation (never CI) | `games_encrypted/manifest.json` 2026-10-22 21:01; `publish/YariZan-G1-local-acceptance` (76 `g1_*.dat`) |
| Backend | 243 tests; capability model with every route declaring its capability; core-only app refuses disabled capabilities | PostgreSQL 17, test mode | PR #59 |
| Legal | Six policies approved; ZarinPal merchant name and eNamad (8237399) confirmed by the owner | Owner decision | PR #55 (2026-10-22) |

## B. Release acceptance (final production configuration)

| # | Item | Status | Needs | Evidence when done |
|---|---|---|---|---|
| B1 | Production secrets generated on the server with recorded offline custody (G8) | owner | sudo on the VPS; `yarizan-secrets.sh generate`; escrow record | custody record (no values) |
| B2 | Production PostgreSQL: migration/runtime roles, 13 migrations verified | open | B1, API image by digest | `migrate.js --verify` output |
| B3 | Encrypted production backup and isolated restore drill | owner | first backup, workstation drill (`yarizan-restore-drill.sh`) | drill log with RTO and row counts |
| B4 | `G8_SECRET_CUSTODY` opened by reviewed PR | open | B1–B3 | PR link |
| B5 | Trusted client identity for rate limits (G5) | open | Pars Pack CDN/Traefik contract, or a demonstrated safe alternative with spoofing and DoS tests | test report |
| B6 | Full web + API images released by digest | open | PR #60, owner approval in `yarizan-release-full-stack` | release manifest |
| B7 | Full-stack deployment with storefront kept as rollback | owner | infrastructure component, sudo | deploy log, acceptance |
| B8 | Two owner Admins enrolled privately; password + SMS MFA in production | owner | ADMIN_AUTH gates (G5, G6), owners enter secrets and OTPs | audit log entries |
| B9 | Customer authentication with production SMS through the reviewed egress | open | CUSTOMER_AUTH gates, egress firewall | live OTP evidence |
| B10 | Production license-signing ceremony; root registered; key installed on VPS | owner | `docs/YARIZAN-LICENSE-SIGNING-CUSTODY.md`, two backup devices, restore on another machine | approved-roots PR, fingerprint |
| B11 | Authenticode identity decided with an accredited CA and certificate installed | owner | identity eligibility (trade name is not a company), signtool | subject, issuer, validation type, owner approval |
| B12 | Signed acceptance candidate: W1–W14 on two physical machines, all 76 games, install/upgrade/uninstall/reinstall, offline restart, two-trial enforcement, license pickup | owner | B6–B11 | signed checklist |
| B13 | Commercial gate opened by reviewed PR | open | B12 | PR link |
| B14 | Signed `YariZan-G1-Setup-v2.0.0.exe`, SHA-256, size, Defender scan | owner | B13 | approval record |
| B15 | Tag `2.0.0` on the release commit; GitHub Draft Release; asset downloaded back byte-identical | owner | B14, authenticated `gh` | release URL, digests |
| B16 | VPS transfer, publication, versioned URL, `latest`, Range, CDN, rollback | owner | B15, sudo | `-Stage verify` output |
| B17 | Live merchant transaction, settlement, exactly-once license fulfillment, finance view, reconciliation | owner | LIVE_COMMERCE gate, payment egress, refund procedure, explicit real-money authorization | transaction record (no card data) |
| B18 | Live site acceptance: 1440/768/390, RTL, legal, contacts, G1 at 12,990,000 IRR, no test price, no CDN session caching, monitoring, rollback | open | B7 | acceptance report |

## C. CI availability record

| Date | Repository | What could not run | Why | Equivalent performed |
|---|---|---|---|---|
| 2026-10-22 | `OAR-NOVA-Games/oarnova-infrastructure` main `ea4a59d` | `ci` jobs (no runner) | "recent account payments have failed or your spending limit needs to be increased" | 102/102 local deploy/rollback checks on the reviewed head before merge (PR #44) |
