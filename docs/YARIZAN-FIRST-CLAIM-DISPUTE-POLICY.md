# First-claim and device-ownership dispute policy (G1_FIRST_CLAIM_ASSURANCE)

Status: **policy direction approved by the owner (2026-10-22), including the seven-day notice.** The final public wording is part of the consolidated legal-text sign-off; the gate stays closed until that sign-off and the evidence below exist.

## The residual risk being accepted

The first account claim of a Windows device needs four things: a key-proof pairing from the app, a five-minute browser code, the customer's mobile OTP, and the app picking up the result. There is no hardware attestation (ADR-0006), so someone who copies an unclaimed device's fingerprint and generates their own device key could claim that device first.

This proposal **accepts that residual risk** and handles it with a support dispute process instead of hardware attestation. TPM attestation stays a possible later desktop track.

## Who owns a device account

- The first verified claim (mobile OTP plus app pickup) creates the device's account.
- Further Windows profiles on the same device need the existing owner's approval in the browser.
- Purchases and licenses belong to that account and that device.

## When a customer disputes ownership

A dispute is opened through the published support channel (website support page, support phones). Support never asks for a password, OTP or payment card data.

Evidence accepted (at least one strong item, recorded as `evidence_ref`):

1. **Strong:** a purchase receipt or ZarinPal reference for a YariZan order on this device, matching the order in Admin.
2. **Strong:** control of the mobile number on the account, proven by a fresh OTP to that number.
3. **Supporting only:** the device username shown in the app (`YZ-…`) together with a recent screenshot of the Lock page on that device.

The device username or hardware identifier **alone is never proof** (the Admin console already says so).

## What support may do (existing audited Admin operations)

| Situation | Operation | Requirement |
|---|---|---|
| Claimant proves ownership; the current account holder does not respond within 7 days of a notice to the account's mobile | customer reset (revokes licenses, resets entitlements, new device generation) | `evidence_ref`, reason, Admin with fresh SMS MFA |
| Paid licenses must move to the rightful owner | license reissue with recovery record | `evidence_ref`; audit `license_recoveries` |
| Account holder lost the mobile number | password or mobile reset through support | `evidence_ref` (strong item 1) |

Each operation needs an Admin with recent SMS MFA. It is idempotent per request, and both the request and the result are written to the append-only audit log. Evidence files themselves are kept outside the application (support archive); only their reference is stored.

## Suspected fraud and exceptional cases

- Signs of fraud include two competing claimants, a claimant who cannot pass a fresh OTP to any number on record, a recent unresolved payment, or evidence that does not match the order in Admin.
- In those cases support asks for additional evidence, a second Admin reviews the case, and nothing changes until the review ends. The seven-day notice period is never shortened.
- An urgent safety block, for example a reported stolen device, may only restrict the device (the existing Admin product block); it never transfers ownership.

## Refusals

- No reset or transfer is made on the device identifier alone, on an unverifiable story, or under time pressure.
- No transfer is made while a payment for the device is unresolved (payment reconciliation first).

## Records and review

- Every dispute gets an internal note on the device and the customer (Admin notes).
- The owner reviews all disputes monthly.

## Acceptance (gate evidence)

- Owner approval of this policy.
- The support runbook (this document) is published to support staff.
- **Existing tests:** a disputed device can be reset only with recorded evidence (`OWNERSHIP_EVIDENCE_REQUIRED` refusals in the Backend integration suite), and the Admin MFA and permission tests.
