# YariZan 2.0.0: owner release acceptance and residual risk (2026-10-23)

The owner directed a commercial release of Grade 1 (issue #67). This record lists what that decision opens, what evidence each gate rests on, and which planned verifications the owner explicitly waived. It holds no secret.

**Grades 2–6 stay Coming Soon.** Search indexing stays off until the owner approves it separately.

## Gates opened in source

| Gate | Evidence | Waived by the owner |
|---|---|---|
| `G8_SECRET_CUSTODY` | `g8-secret-custody-2026-10-23.json` (opened earlier, PR #66) | see that record |
| `G1_FIRST_CLAIM_ASSURANCE` | `docs/YARIZAN-FIRST-CLAIM-DISPUTE-POLICY.md`, approved by the owner as written | — |
| `G5_TRUSTED_RATE_LIMITS` | Option B implemented and tested (`docs/YARIZAN-G5-ANTI-ABUSE.md`, PR #65: 258 backend tests, including a sustained targeted flood) | the staging real-topology tests, the capacity test and the mobile proof-of-work benchmark |
| `G6_ADMIN_SMS_MFA` | password plus live SMS MFA, unchanged; production refuses customer or Admin sign-in unless `SMS_PROVIDER=melipayamak` | — |
| Live ZarinPal (`ZARINPAL_LIVE_GATE_OPEN`) | owner go for real payments. Live mode needs production, `LIVE_COMMERCE`, the merchant ID, the exact callback `https://yarizan.oarnova.games/payment/return`, and the restricted payment egress (infrastructure PR #55) | — |
| `G1_SIGNING_CUSTODY` | `license-key-ceremony-yarizan-license-2026-01.json`: two encrypted backups, both restore-tested, no plaintext left; root approved in `release/v2-approved-public-roots.json` (PR #68, fingerprint `C182381E…BA4F`); the owner confirmed on 2026-10-23 that backup B is held in independent storage | the independent restore of backup B on a second computer |
| `G4_DESKTOP_CREDENTIALS` | the commercial Windows build embeds only the approved production root and the production API (`CommercialReleasePolicy`, Windows V2 checks 424/424) | the physical W1–W14 matrix on two machines |

Production refuses `TRIALS_AND_LICENSES` and `DESKTOP_PROVISIONING` unless the production key file, its production kid and its approved fingerprint are configured (`LICENSE_SIGNING_REQUIRED`). The API then signs only with a key whose SPKI SHA-256 equals that fingerprint.

All five capabilities are approved in source. Each one still serves only when it is listed in `ENABLED_CAPABILITIES` on the server and its runtime prerequisites validate:
- the license-signing key file and its fingerprint;
- the live SMS provider;
- the merchant ID and callback.

## Windows distribution

The installer is distributed **without Authenticode**, as an explicit owner exception (owner message, 2026-10-23):
- no certificate or paid signing service is available to the owner;
- Microsoft Store distribution is not possible from Iran.

Conditions:
- served only over HTTPS from `yarizan.oarnova.games`;
- the exact SHA-256 is published on the download page and in the GitHub Release;
- the download page discloses in Persian that the installer is unsigned and that Windows SmartScreen may warn;
- it is never described as signed or as trusted by Microsoft;
- license integrity is unaffected: every license and enrollment is ES256-signed and verified offline against the embedded approved root.

## Residual risks accepted by the owner

- **Unknown-browser lockout under a sustained targeted flood** (G5 Option B, documented): bounded per window; known browsers are unaffected.
- **Proof-of-work timing on low-end phones has not been measured.** If it turns out to be too slow, the difficulty is lowered in a follow-up.
- **The installer does not prove publisher identity to Windows.** The SmartScreen warning is disclosed, and the integrity check is the published SHA-256.
- **Windows behaviour is covered by the existing automated V2 checks and the end-to-end commercial journey only,** not by the physical two-machine matrix.

## Release verification (minimum, after deployment)

The owner will run one real end-to-end journey:
1. download;
2. install;
3. connect the device;
4. two trial sessions;
5. a cancelled payment, which must grant nothing;
6. a successful Grade 1 payment, fulfilled exactly once;
7. automatic activation;
8. offline play.

The result is recorded with the release.
