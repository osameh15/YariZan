# Windows V2 release procedure (Grade 1, 2.0.0)

The installer contains the private Grade 1 games. It is built, signed, uploaded and attached **only from the owner's release workstation**. No CI job, runner, GHCR image or third-party host other than the owner's GitHub Release and the OAR NOVA VPS ever receives it.

Order (mandatory): **local build → sign → scan → physical acceptance → GitHub Draft Release and asset review → verified transfer to the VPS → approved public publication.** The GitHub asset, the locally approved file and the file served by the VPS are byte-identical; nothing is rebuilt, re-signed, repackaged or recompressed after the checksum is approved.

## Release blockers (current)

| Blocker | Why | Unblocked by |
|---|---|---|
| `V2_ACTIVATION_INTEGRATION_BLOCKED` | `CommercialReleasePolicy.EnsureCommercialRelease` refuses every commercial build by design | a reviewed change that records the physical acceptance (step 4) of a signed acceptance candidate |
| No production license root | `release/v2-approved-public-roots.json` is empty | the key ceremony (`docs/YARIZAN-LICENSE-SIGNING-CUSTODY.md`) plus the approval PR |
| No Authenticode certificate | none is installed on the workstation (checked 2026-10-22), and no signtool | the signing identity decision in step 2 and the Windows SDK signing tools |
| No production API | the app talks to `https://yarizan.oarnova.games/api/v2/`, which is not deployed | the production Backend with `DESKTOP_PROVISIONING` and `TRIALS_AND_LICENSES` enabled (`docs/YARIZAN-PRODUCTION-CAPABILITIES.md`) |
| Download mirror not deployed | `/srv/oarnova/releases/yarizan/windows` does not exist on the VPS (2026-10-22) | the infrastructure activation checklist in `docs/yarizan/windows-downloads.md` (owner) |

**Do not rename or republish the legacy 1.1.0 binary.**

## 1. Acceptance candidate (workstation)

The commercial build stays refused until physical acceptance is recorded, so acceptance runs on a candidate built with the **same production root and production API**:

```bat
build-installer.bat --noninteractive --grade 1 --acceptance-candidate
```

- `ReleaseCheck --acceptance-candidate` applies the commercial validation (reviewed P-256 root, no test/fixture/disposable/development root, production activation config) but does not authorize a release.
- The app is published with `AcceptanceCandidate=true`: version `2.0.0-acceptance-candidate`, window title "ACCEPTANCE CANDIDATE (not for distribution)".
- The installer is `publish/YariZan-G1-Setup-v2.0.0-acceptance-candidate.exe`.
- `Test-WindowsBinary.ps1` without `-Candidate` refuses it (version, name and marker), and the publication script accepts only `YariZan-G1-Setup-v2.0.0.exe` with version `2.0.0`, so a candidate can never be distributed.
- `AcceptanceCandidate` cannot be combined with `CommercialRelease`, `LocalAcceptanceBuild` or `FixtureOnlyBuild`.

## 2. Sign and scan

**Signing identity.** OAR NOVA Games Studio is a trade name, not a registered company. Do not assume it qualifies for an organization-validated (OV/EV) certificate. Ask an accredited CA which identity is legally available to the owner, for example an individual-publisher code-signing certificate in the owner's legal name, and record in the approval record:

- the exact certificate subject;
- the issuing CA;
- the validation type;
- the owner's approval.

Self-signed certificates are never acceptable for the public release.

Steps:
- Install the Windows SDK signing tools (`signtool.exe`).
- Sign the published `YariZan-G1.exe` **before** the installer is compiled, then sign the installer:
  `signtool sign /fd SHA256 /tr <RFC 3161 timestamp URL> /td SHA256 /sha1 <cert thumbprint> <file>`.
- Verify both: `signtool verify /pa /all` and `Get-AuthenticodeSignature` must be `Valid`, with a trusted chain.
- Scan: Microsoft Defender `MpCmdRun.exe -Scan -ScanType 3 -File <installer>`. Optionally submit only the **hash** to a reputation service; never upload the file.
- Signing changes the bytes, so recompute the SHA-256 after signing. That digest is the release digest.

## 3. Physical acceptance

Run W1–W14 (`docs/YARIZAN-LOCAL-WINDOWS-ACCEPTANCE.md`) with the **signed acceptance candidate** against the production API, on two physical machines. Also check:

- all 76 Grade 1 games open from the library, and their manifests verify;
- multi-game navigation;
- install; upgrade over an existing install (same AppId, activation in `%LOCALAPPDATA%\OARNOVA\YariZan\V2` kept);
- uninstall (application removed, per-user activation kept) and reinstall (no new pairing needed);
- offline restart with a valid license;
- two-trial enforcement;
- license pickup after purchase.

## 4. Commercial build

After step 3 passes, a reviewed PR records the acceptance evidence and opens `EnsureCommercialRelease`. Then build the release and repeat step 2 on it:

```bat
build-installer.bat --noninteractive --grade 1
```

The script runs the commercial check, packs and verifies the grade, publishes with `CommercialRelease=true`, checks the app (version 2.0.0, production API, no local or candidate marker), compiles `publish/YariZan-G1-Setup-v2.0.0.exe`, checks the installer and writes `.sha256`. Re-run the smoke part of step 3 (install, activation, one game) on the signed release installer.

## 5. Approval record

`docs/evidence/windows-release-G1-2.0.0.json`:

```json
{
  "grade": 1, "version": "2.0.0", "file": "YariZan-G1-Setup-v2.0.0.exe",
  "sha256": "<lowercase hex of the signed installer>", "size": 0,
  "app_sha256": "<lowercase hex of the signed YariZan-G1.exe that was packaged>",
  "signature": "valid", "malware_scan": "clean",
  "physical_acceptance": "W1-W14 passed", "owner_approved": true,
  "source_commit": "<40-hex release commit>",
  "signer": { "subject": "<certificate subject>", "issuer": "<CA>", "validation": "<individual|OV|EV>" }
}
```

## 6. GitHub tag and Draft Release (workstation)

Tag convention: plain version, like the legacy `1.1.0` tag. The reviewed `2.0.0` tag points to the exact release source commit.

```powershell
git tag -s 2.0.0 <release commit> -m "YariZan 2.0.0"   # or an annotated tag if no signing key
git push origin 2.0.0
gh release create 2.0.0 publish\YariZan-G1-Setup-v2.0.0.exe publish\YariZan-G1-Setup-v2.0.0.exe.sha256 `
  --draft --verify-tag --title "YariZan 2.0.0 — Grade 1 for Windows" --notes-file <notes>
```

Review the draft:
- repository, tag and target commit;
- asset names, sizes and SHA-256;
- Authenticode;
- scan result;
- approval and acceptance records.

GitHub hosting does not prove a binary is safe. The signature, checksum, tests and owner approval are the release authority. The release stays a **draft** until the coordinated public launch.

## 7. Verified transfer to the VPS and publication

```powershell
.\tools\local\Publish-YariZanWindowsRelease.ps1 -Installer publish\YariZan-G1-Setup-v2.0.0.exe -Grade 1 -ReleaseVersion 2.0.0 `
  -Approval docs\evidence\windows-release-G1-2.0.0.json -AppExe publish\YariZan-G1-win-x64\YariZan-G1.exe
```

The tool refuses anything except Grade 1 / 2.0.0, a wrong file name, wrong metadata, an invalid signature, a non-matching approval record, or a packaged launcher that is unsigned, lacks the production API or carries a local-test marker or development trust root. **Before any upload**, it also refuses unless:
- tag `2.0.0` exists and points to the approved `source_commit`;
- a GitHub Release (draft or published) exists for it;
- its installer and `.sha256` assets are downloaded back and proven byte-identical to the local file.

It then:

1. uploads with scp to private staging, verifying the server host key;
2. re-hashes on the server and keeps the file only on an exact match;
3. prints the owner's privileged command `sudo bash /opt/oarnova/apps/yarizan/host/yarizan-release-publish.sh publish …`. That command copies into the immutable versions tree, re-verifies, switches `latest` atomically and reverts automatically if the live check fails.

Afterwards, `-Stage verify` checks HEAD, GET, Range (206), Content-Length, Content-Disposition, the `latest` redirect and the full-download SHA-256 through the CDN.

Rollback: `sudo bash …/yarizan-release-publish.sh rollback --grade 1`.

## 8. Website registry and public launch

A reviewed PR adds the Grade 1 2.0.0 record (version, size, SHA-256, date, requirements) to `apps/web/shared/windows-release.ts`, only after step 7 is verified. Only then does the download link appear in the full application. Grades 2–6 stay Coming Soon. At the coordinated launch, publish the GitHub draft (`gh release edit 2.0.0 --draft=false`) without changing its assets.

## Workstation fallback when GitHub Actions cannot run

The OAR-NOVA-Games account allowance can run out. That never skips a check. A release step whose workflow cannot run is replaced by the documented workstation equivalent, with:

- the same pinned tools;
- the source commit;
- the exact commands and tool versions;
- the outputs.

Record all of that in the evidence ledger (`docs/YARIZAN-RELEASE-EVIDENCE.md`). A report never says CI succeeded when it did not run. Environment protection, branch protection and required reviews are never relaxed to work around billing.
