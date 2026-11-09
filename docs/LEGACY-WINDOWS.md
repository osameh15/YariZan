# Legacy Windows experimental downloads

Status (2026-11-09): **experimental; Windows 7/8.1 acceptance remains pending**. The owner
requested separate legacy downloads for every released product and updated system
requirements on the download page. These downloads are explicitly labeled beta;
they must not be represented as verified stable old-Windows support. The modern
.NET 9 build remains the default. `LegacyWindows=true` selects .NET Framework 4.8
for the same launcher and core, retaining product SKUs, server API contracts,
device identity/key names, per-user license storage and trial policy.

Initial targets: updated **Windows 7 SP1** and **Windows 8.1**, x86 and x64.
The compatibility target applies to **all four currently released products**: G1,
Number Builder, Bundle Builder and Combination Land. G2-G6 do not yet have released
game bundles; they must use the same target when their packages are introduced.
Original Windows 8.0 is excluded. No Windows 7/8.1 test machines are currently
available, so a successful build or current-Windows CI run is not old-OS acceptance.

## Implementation

- The legacy build alone references BouncyCastle.Cryptography 2.7.0 for AES-GCM
  and P-256/P1363 compatibility. Existing ciphertext, canonical SPKI fingerprints,
  signed enrollments, perpetual licenses, decisions and trial grants retain their
  formats. The modern build continues using the platform cryptography APIs.
- Nonexportable per-user Windows CNG device keys and DPAPI remain in use. The
  existing software provider fallback handles machines without an available TPM.
- HTTP remains bounded, cancellable, authenticated and redirect/cookie-free.
  The legacy application explicitly requests TLS 1.2 with normal certificate
  validation. No certificate-validation callback or older TLS fallback is added.
- Framework adapters cover stream reads, process-exit waiting and process-tree
  termination. The latter uses Windows' `taskkill.exe /T /F` for the game's PID.
- The installer has a separate AppId and installation directory, detects .NET
  Framework 4.8, refuses Windows 8.0 and carries a candidate or beta label.
- `CommercialRelease=true` is refused for a legacy build. `LegacyExperimental=true`
  permits only clearly marked beta builds with reviewed production roots/configuration,
  and refuses fixture/local/acceptance switches. The window and executable version
  identify the beta channel. No TLS or license verification is relaxed.
- Staging output is under `.local/legacy-candidates`. The reviewed beta installers,
  SHA-256 files and x64 packages may be copied to `publish`; temporary x86 packages,
  logs and other release evidence stay outside that folder.

## Build and automated checks

On the development workstation with the .NET 9 SDK and Inno Setup installed:

```powershell
.\tests\Run-LegacyChecks.ps1
```

This runs the net48 executable as both x64 and x86. Node generates independent
P-256 signatures, SPKI fingerprints, AES-GCM ciphertext, SKU-bound HMAC keys and
PBKDF2 vectors. Checks cover invalid keys/signatures, binding, DPAPI, offline paid
startup, revocation, two trial starts, CNG persistence/nonexportability, bounded
HTTP/cancellation, process termination and WPF resource/layout loading. Node then
independently verifies the legacy CNG challenge signature. The CI job is explicitly
labeled as running on a current Windows runner.

To build the Combination Land pilot with the existing reviewed runtime inputs in
`secrets/` and an already packed product-specific bundle:

```powershell
.\tools\Build-LegacyWindows.ps1 -Product combination-land `
  -GameBundleRoot 'C:\path\to\YariZan-CombinationLand-win-x64\games_encrypted'
```

The script also supports `number-builder`, `bundle-builder` and `grade-1`; each
requires its own matching bundle and subsequent game acceptance. It validates
the reviewed production public roots/configuration, builds both architectures,
and creates a combined installer with a SHA-256 sidecar. It never generates or
copies a signing private key. Candidates are not uploaded or added to the site.

Build the complete current product set in one command:

```powershell
.\tools\Build-AllLegacyWindows.ps1 -ModernPublishRoot 'C:\path\to\YariZan\publish'
```

For the explicitly labeled experimental public downloads, add `-Experimental`.
The download records in `apps/web/shared/legacy-windows-releases.json` contain the
exact beta installer sizes and hashes. They never claim completed OS acceptance.
Infrastructure verifies the complete staged/published set before changing the app
and publishes files into `/downloads/windows/legacy/` using the existing deploy
lifecycle. Modern paths and `latest` pointers remain unchanged. Production rollout
remains the owner's usual manual `scripts/deploy.sh yarizan-app` command.

The all-products test matrix checks Node-signed licenses, cross-product rejection,
separate storage, offline paid startup, encrypted payloads and the two-trial policy
for each released SKU in both architectures. Every product still needs actual game
and activation acceptance on all four OS/architecture combinations below.

The customer must install Microsoft's .NET Framework 4.8 first when absent. This
prototype installer detects it and provides the official download location; it
does not silently download/install a runtime or modify machine trust settings.

## Required acceptance before claiming stable old-Windows support

All four OS/architecture combinations remain **pending**:

| Check | Windows 7 SP1 x86 | Windows 7 SP1 x64 | Windows 8.1 x86 | Windows 8.1 x64 |
| --- | --- | --- | --- | --- |
| Framework prerequisites, install/uninstall, modern install preserved | Pending | Pending | Pending | Pending |
| TLS 1.2 to the real CDN/API with certificate/hostname validation | Pending | Pending | Pending | Pending |
| Device registration, persisted CNG key and account connection | Pending | Pending | Pending | Pending |
| Two successful trial starts; third refused; retry/cancellation | Pending | Pending | Pending | Pending |
| Purchase/code redemption and restart with network disconnected | Pending | Pending | Pending | Pending |
| License revocation, recovery and game-process termination | Pending | Pending | Pending | Pending |
| Actual game launch, Persian text, input, audio, return and cleanup | Pending | Pending | Pending | Pending |

Use clean, licensed OS images with the required Windows updates and trusted root
certificates. Test a standard Windows account as well as an administrator. Check
the original game executable independently to distinguish payload requirements
from launcher requirements. Experimental downloads must keep their beta markers
and pending-acceptance notice. Do not weaken TLS policy or lift the stable
commercial guard until this matrix has recorded evidence and the product has
been reviewed for a stable legacy release.

References:

- [Microsoft .NET Framework 4.8 operating systems](https://devblogs.microsoft.com/dotnet/announcing-the-net-framework-4-8/)
- [Microsoft TLS guidance for .NET Framework](https://learn.microsoft.com/en-us/dotnet/framework/network-programming/tls)
- [Windows 7 cipher suites](https://learn.microsoft.com/en-us/windows/win32/secauthn/tls-cipher-suites-in-windows-7)
- [Windows 8.1 cipher suites](https://learn.microsoft.com/en-us/windows/win32/secauthn/tls-cipher-suites-in-windows-8-1)
- [Bouncy Castle package targets and license](https://www.nuget.org/packages/BouncyCastle.Cryptography/2.7.0)
- [Inno Setup minimum OS version](https://jrsoftware.org/ishelp/topic_setup_minversion.htm)
