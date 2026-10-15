# ADR-0007: Mobile OTP, SMS Admin MFA and internal notes

Status: implementation for independent review; commercial startup remains blocked.

Base: Draft PR #3, 79a0e34c87b4e6ebb1388c4ecdfd521adac29a4d. Clean worktree confirmed. Graph index/coverage service returned Transport closed; inspected source directly.

Sequence: additive migration and provider/OTP authority; customer and Admin flows; notes/search; shared custom Persian validation and copy; actual PostgreSQL/browser/C#/Windows tests, screenshots, contracts/report and focused commits on the same branch. No merge/deployment.

A verified mobile binds to a machine account generation; it does not prove physical hardware ownership. First claim requires a pairing-scoped OTP. Optional passwords remain independently usable. Login/reset requests have generic challenge receipts; unknown combinations receive indistinguishable non-deliverable challenges. Six-digit random OTPs are HMAC-bound to challenge/purpose, five-minute expiry, five attempts, one consumption. Mobile data is encrypted; exact phone search uses a domain-separated blind index. Sensitive password/mobile changes need proof of the existing verified number. Mobile replacement additionally verifies the new number. Sessions are revoked on credential changes. Admin password admission precedes SMS and no TOTP fallback remains.

MeliPayamak uses a fixed HTTPS pattern-service endpoint and approved template with the OTP as variable {0}. Disabled/missing configuration fails closed. Fake SMS is explicitly development/test-only, never an API code-return shortcut. Test delivery can use an encrypted local fixture spool, not application logs. No actual SMS is sent during this work.

Internal notes use one revisioned row per typed entity, restrictive references validated under transaction locks, scoped read/write permission, immutable audit metadata without note content, trigram search and bounded pagination. Notes must not contain passwords, OTPs, activation plaintext or payment secrets. Exact mobile search is permission-scoped and never exposes full mobile values in results.
