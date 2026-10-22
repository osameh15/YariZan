# YariZan 2.0.0: owner actions and release boundaries (as of 2026-10-22)

These are the steps that cannot be done by an agent: decisions, purchases, secrets typed at a terminal, sudo on the VPS and physical Windows tests. Everything else for 2.0.0 is merged or open as reviewed PRs. The order matters: each block depends on the ones before it.

## A. Decisions and purchases

1. **Authenticode code-signing certificate** (OV or EV) for "OAR NOVA GAMES STUDIO". Install it on the release workstation with the Windows SDK signing tools (`signtool`). No certificate or signtool exists on the workstation today. **Hard release boundary:** without it nothing is published.
2. **Approve or amend** the 2.0.0 EULA (`LICENSE.txt`, English and Persian) and the website legal pages that still carry «نیاز به تأیید مالک» markers.
3. **Approve or amend** the first-claim dispute policy (`docs/YARIZAN-FIRST-CLAIM-DISPUTE-POLICY.md`). It is the G1_FIRST_CLAIM_ASSURANCE evidence.
4. **Official support email:** none is published, so none was invented. Decide whether one exists.
5. **Pars Pack CDN:** the answer about the client-IP header and IP ranges (infrastructure `docs/provider-requests.md`). G5 cannot be implemented safely without it.
6. **ZarinPal:** merchant activation; a written answer on whether API StartPay links must use `pay.yarizan.oarnova.games`; the refund channel and owner.

## B. License-signing key ceremony (G1 signing custody)

Prepare two storage devices and a strong passphrase that is stored separately. In Git Bash at the repository root:

```bash
bash tools/release/license-key-ceremony.sh --kid yarizan-license-2026-01 \
  --backup-a /<deviceA>/yarizan-license-2026-01.gpg --backup-b /<deviceB>/yarizan-license-2026-01.gpg
```

Then:

- commit `docs/evidence/license-key-ceremony-yarizan-license-2026-01.json`;
- open a PR with the printed approval entry for `release/v2-approved-public-roots.json`;
- run the independent restore test of backup B on a second computer (`docs/YARIZAN-LICENSE-SIGNING-CUSTODY.md`).

The server installation of the key comes later, with the Backend deployment (block E).

## C. Infrastructure on the VPS (sudo, from the infrastructure checkout)

After infrastructure PR #44 is merged:

```bash
cd ../oarnova-infrastructure && git pull
OARNOVA_SSH_KEY=~/.ssh/oarnova_laptop_ed25519 bash scripts/deploy.sh host               # installs the egress firewall tooling (inactive)
OARNOVA_SSH_KEY=~/.ssh/oarnova_laptop_ed25519 bash scripts/deploy.sh yarizan-downloads  # download mirror + its route; latest = 404 until a release
```

Each deploy asks for your sudo password on the server. It verifies the bundle digest, rolls back automatically on a failed health check or acceptance, and leaves the storefront untouched. After the mirror deploy, check `https://yarizan.oarnova.games/downloads/windows/grade-1/latest`: it should answer 404 from nginx, and the storefront should still answer 200.

## D. Windows release (workstation)

Only after A1, B and the reviewed change that lifts `V2_ACTIVATION_INTEGRATION_BLOCKED`. That change needs the evidence of B, the approved first-claim policy and the physical acceptance below.

1. `build-installer.bat --noninteractive --grade 1`, which produces `publish\YariZan-G1-Setup-v2.0.0.exe` plus its `.sha256`.
2. Sign, verify and scan (`docs/YARIZAN-WINDOWS-RELEASE.md` §2).
3. Physical acceptance W1–W14 on two machines with the signed installer against the production API (`docs/YARIZAN-LOCAL-WINDOWS-ACCEPTANCE.md`), plus the upgrade, uninstall and reinstall checks.
4. Write the approval record, then run `tools\local\Publish-YariZanWindowsRelease.ps1`, then the printed sudo publish command, then `-Stage verify`.
5. Website registry PR (Grade 1 2.0.0 only), then the GitHub Release `2.0.0` from the workstation with the identical file.

## E. Production Backend (each a reviewed PR, then sudo on the VPS)

Not ready to start. The API refuses `NODE_ENV=production` until every gate is opened by a reviewed change. Remaining work, in order:

1. **G8:** generate the five production keys on the server (`sudo bash scripts/yarizan-secrets.sh generate …`), keep an encrypted offline copy, and run a real restore drill. A full-application deploy component (database, migration and runtime roles, API, web, workers) still has to be built in the infrastructure repository.
2. **G1 signing:** install the key from backup A on the server (custody doc, step 4).
3. **G5:** trusted client IP behind CDN and Traefik, after A5.
4. **G6:** activate the SMS relay and its egress firewall (`yarizan-egress-lockdown arm 30`, `on`, test, `confirm`), then the two owner Admin enrollments with the operator tool on the server.
5. **G4:** block D's physical acceptance with the commercial build.
6. **ZarinPal:** stays last; real money needs merchant activation, the separate payment relay and your recorded go/no-go.

The public storefront stays as it is until the full application passes its acceptance.
