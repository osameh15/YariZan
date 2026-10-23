# Production gate matrix (evidence as of 2026-10-22)

Every gate is **closed**. `NODE_ENV=production` refuses to start with `PRODUCTION_GATE_CLOSED`, and `COMMERCE_MODE=zarinpal` refuses with `ZARINPAL_LIVE_GATE_CLOSED` (`backend/src/config.ts`). No setting opens a gate; each needs a reviewed code change with its own tests and a recorded owner decision. The public storefront depends on none of them. Details per gate: `YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md`; order of work: `YARIZAN-BACKEND-GATE-READINESS-PLAN.md`.

Legend for each gate: **I** implemented · **V** verified (with evidence) · **M** missing · **D** owner decision · **R** release prerequisite.

## G8_SECRET_CUSTODY (five HMAC and encryption keys)

**Open since 2026-10-23** (`docs/evidence/g8-secret-custody-2026-10-23.json`). With it, `PRODUCTION_CORE` can start in production; every other capability stays refused. The items below record the state before the ceremony.

- **I:** the API requires five independent 32-byte keys (distinctness enforced). The infrastructure helper `scripts/yarizan-secrets.sh` writes `api.env` root 0600 without echo. Backups include `api.env` encrypted.
- **V:** startup refuses missing or shared keys (backend tests). The secrets helper has CI tests (infra `ci-yarizan-secrets.sh`).
- **M:**
  - the production key generation run;
  - an offline encrypted copy held by the owner;
  - **a real restore drill** onto a clean host with the keys, in which an existing customer signs in. The drill script exists (`apps/yarizan/host/yarizan-restore-drill.sh`) and is tested only against stubs.
- **D:** who holds the offline key backup, and where.
- **R:** keys generated on the server; offline backup recorded; restore drill passed with the current migration count (13 after PR #40).

## Restore drill (cross-cutting)

- **I:** encrypted backup sets and the drill script check the migration count and reject tampering (infra `docs/yarizan/database.md`).
- **V:** stub-bucket CI only.
- **M:** one real drill before go-live (blocker), then monthly.
- **R:** drill record showing database, keys and signing key restored, `schema_migrations` = release manifest, and a customer sign-in.

## G1_SIGNING_CUSTODY (license, enrollment and decision signing key)

- **I:**
  - ES256 artifacts with `kid` and domain separation;
  - the commercial release check refuses missing roots and any root whose kid contains test, fixture, development or demo (`CommercialReleasePolicy`);
  - the local acceptance profile embeds only the disposable development root and cannot be combined with `CommercialRelease` (PR #45).
- **V:** C# interop with real Backend artifacts (`tests/BackendInterop`, Backend CI); release check negative cases; V2 desktop checks 414/414.
- **M:**
  - a production key ceremony;
  - loading an allowlisted production `kid` from a mounted secret, with the API refusing development keys in production;
  - a dual-root rotation runbook;
  - approved fingerprints in `release/v2-approved-public-roots.json` (currently empty).
- **D:** offline signer or mounted key; key holder and backup holder; rotation period.
- **R:** ceremony record; key-backup restore test; the Windows release check passes with the production root.

## G5_TRUSTED_RATE_LIMITS (client IP behind CDN and Traefik)

- **I:** PostgreSQL rate buckets per IP, account, device and customer. The origin accepts 80/443 only from the official Pars Pack CDN list (origin lockdown active since 2026-10-15).
- **V:** origin lockdown CI and activation record (infra). Forwarded headers stay untrusted by design.
- **M:**
  - trusting a single client-IP header only from Traefik's ingress address;
  - Traefik `forwardedHeaders.trustedIPs` for the CDN ranges;
  - spoofing tests and a load test showing per-client buckets.
- **D:** accept the trusted-proxy design. The CDN's client-IP header semantics are still awaited from Pars Pack (infra `docs/provider-requests.md`).
- **R:** the provider answer, then an implementation PR (app plus infra) tested on a non-production hostname.

## G6_ADMIN_SMS_MFA (production SMS egress)

- **I:**
  - password plus SMS OTP only, no fallback;
  - the seven-pattern registry;
  - live sending requires `SMS_ALLOW_LIVE` and confirmed texts;
  - the isolated relay (TCP passthrough, one host) is prepared;
  - **host egress allow-list implemented** (infra PR #43): `br-yz-egress` may open only TCP 443 to the resolved MeliPayamak addresses.
- **V:**
  - live Admin MFA through the real provider: 2 SMS, wrong code, replay, throttle and expiry all passed (`docs/evidence/sms-admin-mfa-live-2026-10-21.json`); pattern `562281` is panel-verified;
  - egress firewall self-test 23/23 with real forwarded TCP (Ubuntu 24.04 and Alpine);
  - Admin enrollment tests 12/12, including the customer and forged credential escalation test (PR #42).
- **M:**
  - the firewall loaded on the VPS;
  - vendor reachability and TLS checked from the VPS;
  - the subnet collision check;
  - panel comparison of the other six patterns (checklist and offline tool in PR #41);
  - the two production owner enrollments (local procedure in PR #42).
- **D:** approve loading the egress firewall and the relay; recipient numbers for production Admins.
- **R:** egress loaded and verified; the six patterns panel-verified, or kept disabled for their purposes; owners enrolled through the operator procedure after G8.

## G4_DESKTOP_CREDENTIALS (Windows acceptance)

- **I:** CNG device keys (TPM preferred), DPAPI storage, key-proof pairing, automatic activation, a commercial build refusing missing roots, and the **guarded local acceptance build** (PR #45).
- **V:**
  - V2 desktop checks 414/414 (2026-10-22);
  - all 75 Grade 1 source games start;
  - the packaged local acceptance exe starts against the local stack, shows Cover and Lock with the device username, and carries only the loopback API (binary check).
- **M:**
  - the owner's physical checklist W1-W14 (`YARIZAN-LOCAL-WINDOWS-ACCEPTANCE.md`): pairing, persistence, two trials and a refused third, offline continuation, license sync, offline restart, multi-game page;
  - a second machine;
  - TPM versus software key evidence;
  - a signed installer.
  - Finding F1: this workstation's hardware is already claimed in the local database (reset it in local Admin first).
- **D:** device matrix; TPM required or software fallback accepted; code-signing certificate.
- **R:** W1-W14 passed on two machines with a production-rooted build; signed installer verified.

## G1_FIRST_CLAIM_ASSURANCE

- **I:** browser claim with key-proof pairing, a five-minute code and mobile OTP; additional profiles need the existing owner (observed live on the connect page, 2026-10-22).
- **V:** backend first-claim, concurrency and spoofed-fingerprint tests; Playwright first-claim flows.
- **M:** a written dispute and support policy; a support runbook; a test that a disputed device is reset only with recorded evidence.
- **D:** accept the residual risk (no hardware attestation) with a dispute process, or require out-of-band proof.
- **R:** policy and runbook signed off.

## ZARINPAL_LIVE_GATE_CLOSED (real payments)

- **I:**
  - reviewed v4 adapter with server-side amounts, stored-authority binding and the 101 policy;
  - **reconciliation by official inquiry**: append-only observations; only a repeated, spaced `FAILED` ends an attempt; `NOK`, `-51` and elapsed time never do (PR #40);
  - **read-only Payment Readiness dashboard** (PR #44).
- **V:**
  - real sandbox: one payment settled once at 100,000 IRR; duplicate callbacks; 101 and `-50`/`-54` semantics; cancel gives `-51` (HTTP 401) and inquiry `IN_BANK`;
  - DNS and TLS for `pay.yarizan.oarnova.games`;
  - VPS egress address `82.115.18.101`;
  - Backend 238/238 at PR #40.
- **M:**
  - merchant activation;
  - written answer on custom-domain StartPay links;
  - the Backend payment egress path (separate relay `br-yz-pay`), then re-checking the allowlisted address from it;
  - a refund and reverse process;
  - final legal and merchant texts;
  - a staging live transaction reconciled against the settlement report.
- **D:** merchant contract; refund ownership and channel; recorded go/no-go.
- **R:** all gates above closed out first; merchant evidence recorded; owner approval in a reviewed PR that changes the gate.

## Exact remaining steps

### First commercial Windows V2 release (Grade 1)

1. G1 signing custody: key ceremony, production root approved in `release/v2-approved-public-roots.json`, and the API loading the production `kid`.
2. G4: W1-W14 on two machines with a production-rooted, code-signed installer built by `build-installer.bat` (`CommercialRelease=true`).
3. A secure Backend deployment (below) live, because activation, trials and pairing need the production API.
4. Fill `windowsReleases` in `apps/web/shared/windows-release.ts` and the infra release mirror in a reviewed PR with the signed artifact hash.
5. Owner go/no-go.

### Secure Backend deployment

1. G8 keys, plus a real restore drill.
2. G1 signing custody.
3. G5 trusted client IP, after the CDN answer.
4. G6 egress firewall loaded, vendor verified from the VPS, owners enrolled.
5. G1 first-claim policy.
6. Full-application release manifest at 13 migrations, deployed by the owner. Real payments stay off until the ZarinPal gate is opened separately.
