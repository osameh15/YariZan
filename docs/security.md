# Security and access policy

> Feature branch desktop behavior and evidence: [Phase 1 report](YARIZAN-PHASE-1-REPORT.md). The remaining sections below describe the legacy release.

> **V2 planning notice (2026-10-14):** This document records the **historical legacy 1.1.0 release** behavior, not the approved future licensing policy. The previous release has not been commercially launched and the V2 design does **not** require protocol/data backwards compatibility. **V2 backend remains unimplemented; desktop Phase 1 is under review.** Follow the [V2 specification](YARIZAN-TECHNICAL-SPEC-V2.md), [data model](YARIZAN-DATA-MODEL-V2.md), [API contracts](YARIZAN-API-CONTRACTS-V2.md), and [roadmap](YARIZAN-IMPLEMENTATION-ROADMAP-V2.md) for the planned Nuxt/NestJS/PostgreSQL offline-first platform. The historical release requires online authorization for both paid and trial; V2 paid use will be offline and V2 trial will require internet **only for session start**.

## Current behavior

Paid/trial access requires online validation. A valid local signature or saved activation alone cannot authorize the official app. MySQL controls current serials, trial counters/grants and blocked HWIDs.

Checks occur when opening the book, before each game launch, and every 60 seconds in an authorized session. Failure revokes in-memory access, stops games started by the launcher, and shows Lock. Revocation is detected at the next check plus network delay; it is not instantaneous push notification.

Ordinary outages preserve the saved serial. Retry validates it automatically when connectivity returns. A rejected serial cannot grant access or fall back automatically to trial registration. Enter a replacement serial once.

## Device identity

HWID is uppercase SHA-256 of `YariZan-HWID-v1|` plus available WMI motherboard serial, processor ID, BIOS serial and disk index 0 serial, separated by `|`. If none is available, machine/user names are the fallback. It often survives reinstall on unchanged hardware, but hardware/WMI/fallback changes can alter it. HWID is an identifier, not a secret or proof of physical device possession.

## Signatures and trial state

Serials are Base32-formatted ECDSA-P256/SHA-256 signatures of `YariZan-Serial-v1|HWID`. The private key never ships with the desktop. Metadata edits preserve serials; regeneration creates a replacement and server checks reject the old one even though its signature remains valid.

Trial signatures bind `YariZan-Trial-v1|HWID|NONCE|REMAINING`. Authorization signs `YariZan-Access-v1|HWID|CHECK_NONCE|MODE|CREDENTIAL_HASH`. Mode is paid/trial; hash is uppercase SHA-256 of normalized credential. The app checks all fields and the fresh nonce using a 64-byte raw P-256 signature. Unsigned trial status only registers/displays remaining entries.

InnoDB transactions and retained consumption nonces prevent concurrent overspending and retry double charges. New processes use fresh trial nonces. Panel reset removes prior grants and restores two entries; active trials fail their next validation.

## Local protection

`%LocalAppData%/YariZan/activation.dat` uses AES-256-GCM and an HWID-derived PBKDF2-SHA256 key with 100,000 iterations. Loading verifies HWID/serial; online validation remains mandatory. Uninstall retains it. This is casual-copy protection, not a secret unavailable to modified clients.

Games use AES-256-GCM with a 32-byte embedded master key. Manifest metadata/thumbnails are not encrypted. Decrypted games run from restricted temporary directories; cleanup is attempted after use and access loss stops owned processes. Legacy local trial file/registry mirrors do not authorize this app or reset MySQL usage.

## Hosting and repository

Keep implementation, SQL, admin credentials, DB config and signing keys outside every document root. Private folder permissions are 700; sensitive files 600; PHP runs as the account owner. Serve HTTPS and bypass CDN caching/challenges for dynamic/admin/API routes. Cache only versioned assets.

Admin actions use password hashes, authenticated sessions, CSRF protection, rate limits and confirmation dialogs. Serials are intentionally visible to the administrator. Keep database/key/admin backups securely. Privacy checks reject tracked sensitive files; ignored local files still need exclusion from manual sharing.

CI uses disposable keys/databases. Public FTPS upload verifies the server certificate before authentication and pins its key during transfer. CI never provisions or overwrites private configuration, signing keys or backend code.

## Limitations

A modified binary can bypass local enforcement, claim another HWID, extract the game key or capture decrypted executables. Freely reported HWID is not verified customer identity. Online checks stop local deletion resetting the same HWID and allow official-client revocation, not unbreakable local DRM.

Older offline binaries cannot be reliably revoked remotely. The app has not yet been published; distribute the current online build. Device-key proof, verified customer registration, admin MFA and different content-key delivery are future improvements, not implemented protections.

See [hosting operations](../web/licensing/README.md) and [checks](ci.md). Automated checks must not change real customer activation/trial state.
