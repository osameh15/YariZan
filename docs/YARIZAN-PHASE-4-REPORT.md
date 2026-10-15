# YariZan Phase 4 engineering report

## Preflight and implementation plan

Base: e474a6a92adb4cd341289a7f4238c6f128cb3f99, current origin/main. PR #3 merged 2026-10-15T18:25:12Z; GitHub REST confirmed merged=true and matching merge SHA. Main push CI 38785466716 succeeded (https://github.com/osameh15/YariZan/actions/runs/38785466716). No other main workflows exist for this SHA because backend/web workflows are pull-request triggered. Initial tree clean. Created feat/yarizan-v2-commerce in the existing Web worktree, without a fourth checkout or editing main. Codebase-memory index is unavailable (Transport closed); direct source/migration fallback is used.

Before editing source, inventory confirms 001-008 provide products/prices, orders/items, payment attempts/events, campaigns/codes/reservations/redemptions and refund records, but no commerce API, worker, checkout or finance operations. Existing reusable authority: customer cookies/CSRF/generation, Admin SMS MFA/RBAC/idempotent operations, revisioned notes, immutable audit/outbox, Licenses.ensureLicense and desktop pickup, PostgreSQL migrations/drift checks. Existing 60-route OpenAPI is authoritative, older commerce examples are not implementations.

Plan / requirements mapping:

1. A: forward-only migration 009 extends existing tables with immutable snapshots, device/generation scope, bounded amounts, payment transitions and durable leased jobs; existing identity/license/session contracts remain.
2. B: integer-only quotes and server-side coupons, campaign/code revision management, quota locking/reservations and generic probing errors.
3. C: disabled/fake provider selection; typed ZarinPal adapter with injected offline test transport, fixed TLS endpoints and explicit IRR. Persist attempt before external call, never retry ambiguous creation. Durable verification/reconciliation outside database locks, bounded backoff/operator exceptions.
4. D: verified payment persists before fulfillment. Unique source item and business fulfillment; existing perpetual signed license. Signing failure remains paid/pending. Generation reset, blocks, duplicate captures/references and late released coupons become financial exceptions, never erased payments.
5. E: real Persian RTL quote/checkout/simulated continuation/result/orders, and RBAC/MFA Admin campaigns/codes/orders/payments/jobs/exceptions/finance; revisioned notes and safe refund-request review only.
6. F: PostgreSQL concurrency/failure/restart, adapter unit, browser/security, real C# verifier/provisioning and Windows regressions; 17 actual application screenshots, full contracts/report, focused commits and Draft PR. No production operations.

Safety: no live payment/refund, SMS, merchant credential, production signing key, external gateway request, infrastructure/DNS/PHP/MySQL or real data is authorized. Production startup and real-provider configuration remain closed. Synthetic fulfillment is not commercial readiness.
