# Windows V2 release procedure (Grade 1, 2.0.0)

The installer contains the private Grade 1 games. It is built, signed, uploaded and attached **only from the owner's release workstation**. No CI job, runner, GHCR image or third-party host ever receives it.

## Release blockers (current)

| Blocker | Why | Unblocked by |
|---|---|---|
| `V2_ACTIVATION_INTEGRATION_BLOCKED` | `CommercialReleasePolicy.EnsureCommercialRelease` refuses every commercial build by design | a reviewed change after signing custody, first-claim policy and Windows acceptance are evidenced |
| No production license root | `release/v2-approved-public-roots.json` is empty | the key ceremony (`docs/YARIZAN-LICENSE-SIGNING-CUSTODY.md`) plus the approval PR |
| No Authenticode certificate | none is installed on the workstation (checked 2026-10-22), and no signtool | owner purchases a code-signing certificate (OV or EV) and installs the Windows SDK signing tools |
| No production API | the commercial app talks to `https://yarizan.oarnova.games/api/v2/`, which is not deployed | the production Backend cutover |
| Download mirror not deployed | `/srv/oarnova/releases/yarizan/windows` does not exist on the VPS (2026-10-22) | the infrastructure activation checklist in `docs/yarizan/windows-downloads.md` (owner) |

Nothing below is run until every blocker is closed. **Do not rename or republish the legacy 1.1.0 binary.**

## 1. Build (workstation)

`build-installer.bat --noninteractive --grade 1` with the real Grade 1 assets. The script:

- runs the commercial release check;
- packs and verifies the grade;
- publishes self-contained win-x64 with `CommercialRelease=true`;
- checks the app (version 2.0.0, production API, no local acceptance API or marker);
- compiles `publish/YariZan-G1-Setup-v2.0.0.exe`;
- checks the installer version and name;
- writes `.sha256` and prints the size.

## 2. Sign and scan

- Sign: `signtool sign /fd SHA256 /tr <RFC 3161 timestamp URL> /td SHA256 /sha1 <cert thumbprint> publish\YariZan-G1-Setup-v2.0.0.exe`. Sign the app exe the same way before the installer is compiled.
- Verify: `signtool verify /pa /all` and `Get-AuthenticodeSignature` must both be `Valid`.
- Scan: Microsoft Defender `MpCmdRun.exe -Scan -ScanType 3 -File <installer>`. Optionally upload only the **hash** to a reputation service; never upload the file.
- Signing changes the bytes, so recompute the SHA-256 after signing. That digest is the release digest.

## 3. Physical acceptance

Run W1–W14 (`docs/YARIZAN-LOCAL-WINDOWS-ACCEPTANCE.md`) with the **signed commercial installer** against the production API, on two machines. Also check:

- upgrade over an existing install: same AppId, activation in `%LOCALAPPDATA%\OARNOVA\YariZan\V2` kept;
- uninstall: application removed, per-user activation kept;
- reinstall: no new pairing needed.

## 4. Approval record

`docs/evidence/windows-release-G1-2.0.0.json`:

```json
{
  "grade": 1, "version": "2.0.0", "file": "YariZan-G1-Setup-v2.0.0.exe",
  "sha256": "<lowercase hex of the signed installer>", "size": 0,
  "signature": "valid", "malware_scan": "clean",
  "physical_acceptance": "W1-W14 passed", "owner_approved": true,
  "source_commit": "<release commit>"
}
```

## 5. Upload and publish

```powershell
.\tools\local\Publish-YariZanWindowsRelease.ps1 -Installer publish\YariZan-G1-Setup-v2.0.0.exe -Grade 1 -ReleaseVersion 2.0.0 -Approval docs\evidence\windows-release-G1-2.0.0.json
```

The tool refuses anything except Grade 1 / 2.0.0, a wrong file name, wrong metadata, an invalid signature or a non-matching approval record. It then:

1. uploads with scp, verifying the server host key;
2. re-hashes on the server and keeps the file only on an exact match;
3. prints the owner's privileged command `sudo bash /opt/oarnova/infrastructure/apps/yarizan/host/yarizan-release-publish.sh publish …`. That command copies into the immutable versions tree, re-verifies, switches `latest` atomically and reverts automatically if the live check fails.

Afterwards, `-Stage verify` checks HEAD, GET, Range (206), Content-Length, Content-Disposition, the `latest` redirect and the full-download SHA-256 through the CDN.

Rollback: `sudo bash …/yarizan-release-publish.sh rollback --grade 1`.

## 6. Website registry

A reviewed PR adds the Grade 1 2.0.0 record (version, size, SHA-256, date, requirements) to `apps/web/shared/windows-release.ts`, only after step 5 is verified. Grades 2–6 stay Coming Soon.

## 7. GitHub Release (workstation)

Tag convention: plain version, like the legacy `1.1.0` tag, so this release is `2.0.0` on the reviewed release commit.

```powershell
gh release create 2.0.0 publish\YariZan-G1-Setup-v2.0.0.exe publish\YariZan-G1-Setup-v2.0.0.exe.sha256 --target <release commit> --title "YariZan 2.0.0 — Grade 1 for Windows" --notes-file <notes>
```

Then download the asset back and confirm its SHA-256 equals the VPS digest.
