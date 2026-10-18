# Backend Production-Gate Readiness Plan (prioritized)

All commercial and security gates remain **closed**. This plan orders the work needed before the full application (accounts, licensing, checkout, Admin) can run in production. Each gate opens only through a reviewed code change with its own tests and the owner's explicit approval. Details per gate: `YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md`.

## Priority order

| # | Gate / work item | Why first | Owner decision | Engineering work | Acceptance |
| --- | --- | --- | --- | --- | --- |
| 1 | **G8_SECRET_CUSTODY** | Every other gate stores or uses keys; recovery must exist before real data | Who holds the offline backup of the five keys | Generation runbook on the server, root-only env file, encrypted offline backup, restore drill including keys | Restore onto a clean host; an existing customer signs in |
| 2 | **G1_SIGNING_CUSTODY** | Licenses are permanent; a lost or leaked signing key is unrecoverable for customers | Offline signer vs mounted key; holder; rotation | Load an allowlisted production `kid` from a mounted secret file; refuse development keys in production; dual-root rotation runbook; Windows build embeds the reviewed root | Key ceremony record; key-backup restore test; release check passes with production roots |
| 3 | **G5_TRUSTED_RATE_LIMITS** | Without it, abuse limits collapse behind the CDN | Accept the trusted-proxy design | Accept a client-IP header only from Traefik's ingress address; Traefik trusts the CDN ranges; spoofing tests | Spoofed header from a non-proxy peer ignored; per-client buckets in load test |
| 4 | **G6_ADMIN_SMS_MFA** | Admin is unusable in production without SMS | Approve MeliPayamak account, pattern and sender | API-network-only egress to `rest.payamak-panel.com`; staging delivery test to each Admin number | Real OTP delivered; provider failure keeps Admin login closed |
| 5 | **G4_DESKTOP_CREDENTIALS** | Customers activate on real Windows machines | Device matrix; TPM required or not | Physical acceptance run (TPM keys, two profiles, high DPI, network loss, signed installer) | Checklist executed on two machines; signed installer verified |
| 6 | **G1_FIRST_CLAIM_ASSURANCE** | Policy, not code, is missing | Dispute and support policy; accepted residual risk | Support-mediated ownership dispute runbook using existing Admin evidence operations | Written policy; test that a disputed device resets only with recorded evidence |
| 7 | **ZARINPAL_LIVE_GATE_CLOSED** | Last: money moves only after 1–6 | Merchant account, amount unit, refund ownership | Complete the 16-item merchant checklist; staging transaction; reconciliation against the settlement report; read-only Payment Readiness dashboard (design ready) | Merchant evidence recorded; staging payment verified and reconciled; owner approval |

## Cross-cutting prerequisites

- Production database with migration 010 and `--initialize-prices` bootstrap (runbook ready).
- Encrypted backup and restore drill expecting **10** migrations and including keys.
- Incident runbooks: key compromise, payment outage, SMS outage, data-subject requests.
- Legal pages (privacy, terms, refunds) — also required for indexing (see the SEO audit).
- Monitoring and alerting for `commerce_exceptions`, overdue jobs and unknown verifications.

## Suggested sequencing

1. **Now:** G8 runbook and restore drill; signing custody decision; legal pages.
2. **Next:** G5 implementation; G6 provider approval and staging delivery.
3. **Then:** G4 physical acceptance with a signed build; G1 policy.
4. **Finally:** ZarinPal merchant acceptance in staging, Payment Readiness dashboard, owner go/no-go.

Nothing in this plan is executed automatically; every gate change is its own reviewed PR.
