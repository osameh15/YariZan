# Combination Land 1.0.1

Updated private payload SHA-256: `16d41e9c7909b661e270a91c7f271937865b825183f6c8fa67cf6f5923a6b57e`.

Both modern self-contained Windows x64/x86 launchers and the separate .NET Framework 4.8 legacy x64/x86 launchers package the same updated game. Existing product SKU and license trust roots remain unchanged.

Modern installer: `YariZan-CombinationLand-Setup-v1.0.1.exe`, SHA-256 `5895c3859e58348f9ec137a011adf07e793d0aa3ca3d5452f818f6e5da6bc000`.
Legacy installer: `YariZan-CombinationLand-Legacy-Setup-v1.0.1-beta.exe`, SHA-256 `df716875611e200ffbdd46c6ab2c23a990cb7cc34879152f0150d98e40206ce7`.

Both installers select x64 or x86 automatically. On 2026-11-13 the owner confirmed that the legacy products were tested successfully and requested removal of beta labeling. The exact tested installers, immutable filenames and checksums are retained; their catalog channel is now stable and OS acceptance verified. No additional test-machine details were supplied.

Files are staged in `/home/oarnova` with server SHA-256 verification. The normal infrastructure deploy verifies the reviewed hashes before publishing immutable 1.0.1 paths. Existing versioned downloads remain available for rollback.

Migration 023 adds reversible coupon archiving and two original illustrated Persian blog posts. Archived coupons are disabled; restoring a coupon keeps it disabled until explicitly enabled. Reservation and redemption history is never deleted.
