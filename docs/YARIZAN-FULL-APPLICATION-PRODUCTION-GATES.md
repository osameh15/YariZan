# YariZan V2 — Full Application Production Gates

Status as of Draft PR #7: **every gate is closed**. The API refuses `NODE_ENV=production` with `PRODUCTION_GATE_CLOSED: G1_FIRST_CLAIM_ASSURANCE,G1_SIGNING_CUSTODY,G4_DESKTOP_CREDENTIALS,G6_ADMIN_SMS_MFA,G5_TRUSTED_RATE_LIMITS,G8_SECRET_CUSTODY`, and `COMMERCE_MODE=zarinpal` with `ZARINPAL_LIVE_GATE_CLOSED` (`backend/src/config.ts`). No environment variable opens a gate; each needs a reviewed code change with its own tests. This PR opens none of them.

The public storefront (`YARIZAN_SITE_MODE=storefront`) does not depend on any gate: it has no Backend, accounts, commerce, licensing or Admin. Only the full application does.

## Gate summary

| Gate | Blocks | Owner decision | Infrastructure help | Readiness |
| --- | --- | --- | --- | --- |
| G1_FIRST_CLAIM_ASSURANCE | First account claim of a machine | Dispute and support policy; accepted residual risk | Support channel only | Implementation done; policy missing |
| G1_SIGNING_CUSTODY | Signed licenses, enrollments, decisions | Key holder, backup holder, rotation | Secret delivery, HSM or KMS if chosen | Not started (development keys only) |
| G4_DESKTOP_CREDENTIALS | Commercial Windows build | Approve production public roots | None | Code done; physical acceptance missing |
| G6_ADMIN_SMS_MFA | Admin sign-in | Approve MeliPayamak account and pattern | Egress allowlist for the SMS host | Code done; live provider acceptance missing |
| G5_TRUSTED_RATE_LIMITS | Every rate limit | Accept the trusted-proxy design | Trusted client IP header from Traefik/CDN | Design ready; not implemented |
| G8_SECRET_CUSTODY | HMAC and encryption keys | Custody and recovery owner | Durable secret store and backup | Not started |
| ZARINPAL_LIVE_GATE_CLOSED | Real payments | Merchant contract and acceptance | Egress to `payment.zarinpal.com`, callback route | Adapter reviewed offline; merchant evidence missing |

## G1_FIRST_CLAIM_ASSURANCE

- **Existing implementation:** browser claim needs a key-proof pairing, a five-minute browser code and mobile OTP; additional Windows profiles need the existing owner; the final transaction rechecks generation, owner and expiry.
- **Missing evidence:** no hardware attestation, so an attacker-generated key with a spoofed unclaimed fingerprint can pre-empt a device account (documented in ADR-0006). No dispute or recovery policy.
- **Existing tests:** backend `First claim requires both browser and desktop confirmation`, `Concurrent competing first claims create one active owner`, `Spoofed known fingerprint cannot enroll without owner approval`; Playwright first-claim flows; C# provisioning transport.
- **Owner decision:** accept the residual risk with a support dispute process, or require out-of-band proof (purchase receipt, school code) for first claim.
- **Proposed secure implementation:** a support-mediated ownership dispute flow using the existing `OWNERSHIP_EVIDENCE_REQUIRED` Admin operations; an optional TPM attestation track for a later desktop release.
- **Acceptance criteria:** written policy; support runbook; a test that a disputed device can be reset only with recorded evidence; owner sign-off.

## G1_SIGNING_CUSTODY

- **Existing:** ES256 P-256 artifacts with domain separation and `kid`; development and test keys live in `/app/.local` or memory.
- **Missing:** production key generation ceremony, custody, backup, rotation and revocation of a compromised key; the Windows build must embed the matching reviewed public roots.
- **Tests:** C# interoperability (`DOTNET_INTEROP`), signature negative vectors, release-check `V2_PUBLIC_ROOTS_MISSING`.
- **Owner decision:** who generates and holds the key; offline signer or online signing service; rotation period.
- **Infrastructure:** secret delivery to the API container (read-only file mount or KMS), never an image layer; backup of the private key separate from database backups.
- **Proposed implementation:** an offline-generated key loaded from a mounted secret file with an allowlisted `kid`; a reviewed root list for the Windows build; a key-rotation runbook with overlapping roots.
- **Acceptance:** key ceremony record; restore test of the key backup; Windows release check passes with production roots; the API refuses development keys in production.

## G4_DESKTOP_CREDENTIALS

- **Existing:** CNG device keys (TPM preferred, software fallback), DPAPI per-user storage, key-proof pairing and AUTH, automatic activation (PR #6), commercial build refuses missing roots.
- **Missing:** physical acceptance on real hardware: TPM-backed keys, two real Windows profiles, high DPI, network loss during a real purchase, signed installer.
- **Tests:** Windows V2 suite (409 checks at PR #6 merge), real-backend provisioning checks (`DOTNET_PROVISIONING`), the full-stack rehearsal in this PR.
- **Owner decision:** device matrix; accept software-key fallback or require TPM.
- **Acceptance:** the physical checklist in `docs/YARIZAN-AUTOMATIC-LICENSE-ACTIVATION-REPORT.md` §13 executed on at least two machines; signed installer verified.

## G6_ADMIN_SMS_MFA

- **Existing:** Admin login is password plus SMS OTP only (no fallback); MeliPayamak pattern adapter with fixed HTTPS endpoint, one variable, no redirects; live sending needs `SMS_ALLOW_LIVE=true` plus credentials; independent HMAC/encryption keys enforced.
- **Missing:** an approved MeliPayamak account, pattern (body id) and sender; delivery evidence to real Admin numbers; egress allowlist.
- **Tests:** `MeliPayamak uses fixed HTTPS pattern service…`, `…failure, malformed result, timeout and negative receipt fail closed`, `Live SMS missing config refuses startup…`.
- **Infrastructure:** egress only to the MeliPayamak REST host from the API network; secrets in the API env file (0600).
- **Acceptance:** a delivered OTP to each Admin's verified number in a staging run; a failed provider leaves Admin login closed; rate limits verified.

## G5_TRUSTED_RATE_LIMITS

- **Existing:** PostgreSQL-backed buckets per IP, account, device and customer.
- **Missing:** behind the CDN and Traefik, `req.socket.remoteAddress` is the proxy, so per-IP limits collapse into one bucket.
- **Proposed implementation:** accept a client-IP header only from Traefik's internal address (the ingress network), with Traefik configured to set it from the CDN's verified header; reject or ignore it from any other peer; tests for spoofed headers.
- **Infrastructure:** Traefik `forwardedHeaders.trustedIPs` for the CDN ranges and a single canonical client-IP header to the API.
- **Acceptance:** a test that a spoofed header from a non-proxy peer is ignored; load test showing separate buckets per real client.

## G8_SECRET_CUSTODY

**Open since 2026-10-23** on the evidence in `docs/evidence/g8-secret-custody-2026-10-23.json`: keys generated on the server, the first production backup encrypted to two owner-held age identities, and two passing isolated restore drills (13 migrations). The customer sign-in check below waits for `CUSTOMER_AUTH`, which stays closed; the recorded runbook deviations are listed in the evidence file.

- **Existing:** five independent 32-byte keys (`CODE_HMAC_KEY`, `TOKEN_HMAC_KEY`, `MFA_ENCRYPTION_KEY`, `MOBILE_ENCRYPTION_KEY`, `OTP_HMAC_KEY`) required at start; distinctness enforced.
- **Missing:** generation, storage, backup and recovery procedure. Losing `MOBILE_ENCRYPTION_KEY` makes stored mobiles unreadable; losing HMAC keys invalidates sessions and codes.
- **Proposed implementation:** generate on the server, store in the root-only env file, back up encrypted to the owner's offline vault, include in the restore drill (S3 key list).
- **Acceptance:** restore drill restores database plus keys onto a clean host and an existing customer can sign in.

## ZARINPAL_LIVE_GATE_CLOSED — merchant acceptance checklist

Offline review of `ZarinPalAdapter` (`backend/src/commerce/gateway.ts`) with injected transports and synthetic fixtures. Never selected at runtime.

| # | Item | Current adapter behaviour | Evidence needed from the merchant |
| --- | --- | --- | --- |
| 1 | Merchant account and environment | Merchant id must be a UUID | Active production merchant id; sandbox vs production confirmation |
| 2 | API contract | Fixed `https://payment.zarinpal.com/pg/v4/payment/{request,verify,inquiry}.json`, `redirect: "error"`, 10 s timeout, 16 KiB response cap | Written confirmation that v4 is the supported contract for this account |
| 3 | Amount unit | Sends integer IRR with `currency: "IRR"` | Confirmation the account accepts IRR (not only IRT/Toman); a staging transaction showing the charged amount |
| 4 | Currency compatibility | Refuses anything but IRR before any request | As above |
| 5 | Minimum amount | Refuses below 10,000 IRR | Merchant's real minimum |
| 6 | Merchant id validation | UUID shape only | Provider rejects unknown merchant with a defined code |
| 7 | Callback | HTTPS only, no query, no credentials; return handled at `/payments/zarinpal/return`, which only enqueues server verification | Registered callback domain; CDN passes the query unchanged |
| 8 | Authority format | `^A[A-Za-z0-9]{32}$` | Confirmed format and length |
| 9 | Server-to-server verification | Verify binds the stored amount; browser `Status` is never trusted | — |
| 10 | Duplicate references | A reused `ref_id` is kept as a financial exception, never a second license (tested) | — |
| 11 | Already verified | Code 101 treated as verified | Confirm 101 semantics |
| 12 | Failed and cancelled | Any non-100/101 result stays UNKNOWN until reconciliation; quota released only on definitive failure | Provider's definitive-failure codes |
| 13 | Unknown results | UNKNOWN never retries charge creation; durable inquiry recovers orphan authorities (tested with the fake provider) | — |
| 14 | Inquiry semantics | Inquiry call is made, then verification decides; the inquiry status vocabulary is **not** interpreted yet | Inquiry status values and terminal states |
| 15 | Rate limiting and retries | Worker retries with backoff; bounded probing | Provider rate limits |
| 16 | Refunds | No refund method exists; refund requests are recorded and reviewed only | Who settles refunds, through which channel |

Credentials stay out of GitHub, images, CI artifacts, screenshots and chat; they belong only in the server env file.

### Required payment tests (all synthetic, no money)

| # | Scenario | Test |
| --- | --- | --- |
| 1 | Successful synthetic payment | backend `Forged callback cannot pay; verified synthetic capture fulfills exactly once under duplicate workers`; full-stack rehearsal coupon checkout |
| 2 | Invalid browser callback | same test; rehearsal forged callback |
| 3 | Verification mismatch | `Merchant/amount/currency/authority mismatch remains unknown and auditable` |
| 4 | Duplicate callback | `Forged callback…duplicate workers` |
| 5 | Duplicate payment reference | `Duplicate capture and reused provider references retain financial exceptions without duplicate licenses` |
| 6 | Paid but fulfillment pending | `Paid signing failure never loses payment and safely retries fulfillment` |
| 7 | Worker interruption | `Expired worker lease recovers after crash…` |
| 8 | Late verification | `Definitive failure releases quota; late-paid released allocation is preserved as a paid exception` |
| 9 | Coupon quota exhausted concurrently | `Twenty PostgreSQL checkouts cannot reserve more than the last coupon allocation` |
| 10 | Purchase after price change | `Commerce uses real snapshots…` (append-only price change keeps the order snapshot) |
| 11 | Invalid merchant/currency contract | `Invalid merchant, callback, currency or amount contracts are refused before any provider request` (new) |
| 12 | Failed provider transport | `Gateway malformed, nonauthoritative, oversized and transport failures stay unknown` |
| 13 | Unknown provider state | `Ambiguous verification retains coupon…`, `Ambiguous create never retries charge creation…` |
| 14 | Exactly one signed license | `Duplicate capture…without duplicate licenses`; rehearsal checks one fulfillment and identical license ids on repeated pickup |
| + | Commerce disabled / client price | `Disabled commerce and client-supplied prices cannot create an order over direct HTTP` (new) |

## Cross-cutting production requirements

- **Encrypted backup and restore:** infrastructure backup design exists (`docs/yarizan/database.md` in the infrastructure repository); the restore drill must include the signing key and the five secrets and compare `schema_migrations` with the release manifest (now **10**).
- **Financial reconciliation:** Admin `finance` report and per-order reconciliation (`POST /admin/commerce/orders/{id}/reconcile`, `finance.reconcile`); daily comparison with the merchant settlement report is an owner process to define.
- **Audit and incident response:** append-only `audit_logs`, `payment_transitions`, `commerce_job_runs`; an incident runbook (key compromise, payment outage, SMS outage) is still needed.
- **Licensing guarantees kept:** offline perpetual access, trial limits and signed revocation are unchanged by this PR.
