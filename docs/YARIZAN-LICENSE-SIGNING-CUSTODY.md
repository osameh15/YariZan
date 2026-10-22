# License-signing key custody (G1_SIGNING_CUSTODY)

The Backend signs every enrollment, trial grant, license and license decision with one ES256 (P-256) key. Windows verifies them offline against public roots embedded at build time. A lost key means no new licenses verify on existing installs. A leaked key means anyone can mint licenses. This document is the custody arrangement. The gate stays closed until its evidence exists.

## Components

| Part | Where | Secret? |
|---|---|---|
| Private key, plaintext | only on the VPS: `/etc/oarnova/yarizan/license-signing.pem`, root-owned, mode 0400, mounted read-only into the API at `/run/secrets/yarizan-license-signing.pem` | yes |
| Encrypted backups A and B | two separate offline storage devices kept in different places (gpg AES-256, owner passphrase) | encrypted |
| Passphrase | owner, stored separately from both backups | yes |
| Public root | `secrets/v2-license-public-keys.json` (git-ignored; embedded in the Windows build) | no |
| Approval | `release/v2-approved-public-roots.json`, `kid` to SPKI SHA-256, changed only by a reviewed PR | no |
| Ceremony record | `docs/evidence/license-key-ceremony-<kid>.json` (fingerprint, backup digests, restore results) | no |
| Backend settings | `LICENSE_SIGNING_KEY_FILE`, `LICENSE_SIGNING_KID`, `LICENSE_SIGNING_KEY_SHA256` in `api.env` | no |

## Enforcement in code

- `FileKeyManager` (`backend/src/signing/signing.ts`):
  - loads only a P-256 PKCS#8 file;
  - requires a production kid (`yarizan-license-…`, never test, fixture, disposable, development or demo);
  - refuses startup unless the key's SPKI SHA-256 equals the approved fingerprint, so a swapped or wrong file can never sign.
- `signingKeyManager()` requires the file key whenever `NODE_ENV=production`. The disposable development key exists only in development and test.
- Configuration requires all three settings or none, and refuses non-production kids.
- **Windows:** the commercial release check refuses any root that is not approved, or whose kid contains a test word. The local acceptance build cannot be combined with a commercial build.
- **Tests:**
  - backend `core.test.ts` "Production signing key …": the approved key signs and verifies; a swapped key, development kids, an unreadable file, a non-P-256 key and incomplete or non-production configuration are all refused;
  - cross-language verification in `tests/BackendInterop`.

## Ceremony (owner, once per key)

1. Prepare two storage devices (A and B) and choose a strong passphrase that is stored separately.
2. In Git Bash at the repository root:
   `bash tools/release/license-key-ceremony.sh --kid yarizan-license-2026-01 --backup-a <A>/yarizan-license-2026-01.gpg --backup-b <B>/yarizan-license-2026-01.gpg`
   - It generates the key in a private temporary directory and writes both encrypted backups.
   - **It restore-tests each backup independently**: decrypt, compare the fingerprint, then sign and verify a test message.
   - It writes the public root and the ceremony record, then destroys the plaintext key.
   - Dry run (2026-10-22, throwaway directory, test kid): both restore tests passed, the public root had no private material, and no plaintext key remained.
3. Commit the ceremony record. Open a reviewed PR that adds the printed approval entry to `release/v2-approved-public-roots.json`.
4. Server installation, as root on the VPS:
   - copy backup A to `/root/` with scp;
   - `gpg --decrypt --output /etc/oarnova/yarizan/license-signing.pem /root/yarizan-license-2026-01.gpg`;
   - `chmod 0400` the key file, `chown` it to the API container user, then delete `/root/*.gpg`;
   - set the three settings in `api.env` with `scripts/yarizan-secrets.sh`.
5. Independent restore test on another host (required evidence): decrypt **backup B** on a machine other than the one used in step 2, compare the fingerprint, sign and verify, then destroy the plaintext. Record the result in the ceremony record.

## Rotation (planned, no compromise)

1. Run a new ceremony with a new kid (for example `yarizan-license-2027-01`).
2. Ship a Windows release whose embedded roots contain **both** kids, and approve both.
3. After that release is the minimum supported version, switch the Backend to the new kid. Licenses signed with the old kid stay valid offline.
4. Retire the old private key: destroy the server copy, and keep its backups until no supported build trusts the old root.

## Compromise (key leaked or suspected)

1. Stop the API (no new signatures) and rotate immediately with a new ceremony.
2. Ship an emergency Windows release that trusts only the new kid. Re-issue licenses for existing entitlements through the existing reissue operation, which records the new license and revokes the old one.
3. Record the incident and the affected time window in the audit trail.

## Disaster recovery

If the server key is lost, restore it from backup A or B (step 4) and verify the fingerprint before starting the API. If both backups and the passphrase are lost, no new license can be verified by existing installs, so rotation (above) is the only path.

## Gate status

`G1_SIGNING_CUSTODY` stays closed until all of the following exist:

- the ceremony record;
- the approved root in a merged PR;
- the server installation;
- the independent restore test of backup B.

Opening the gate is a separate reviewed code change.
