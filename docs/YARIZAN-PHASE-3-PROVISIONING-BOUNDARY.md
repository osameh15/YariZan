# Phase 3 desktop provisioning boundary

Status: historical Phase 2 boundary, superseded for executable development contracts by [ADR-0006](adr/0006-web-and-desktop-provisioning.md) and the [Phase 3 report](YARIZAN-PHASE-3-REPORT.md). The browser receipt / key-proven desktop pickup split is implemented and tested in Phase 3. Commercial production provisioning remains blocked. The following original description records the Phase 2 integration gap; it is **not the current API**.

## Historical Phase 2 development response

`POST /api/v2/auth/claim` and its `/devices/register` alias accept the same strict pairing ID, browser token, one-time desktop claim grant and optional initial password. They return `{device_id, customer_id, username, enrollment, credential}`. The enrollment is the existing signed V2 profile certificate; the bearer expires after 15 minutes. Both routes have identical Origin, ownership, one-time consumption and rate checks. Neither route accepts a fingerprint as an authentication secret.

This response serves synthetic API tests and the local harness. A future Nuxt browser must not consume this response as a production enrollment flow: doing so would expose a desktop bearer to browser application code. `/devices/authenticate` currently uses fresh CNG-key challenge proof to return a credential and scope; it does not deliver the enrollment certificate. The merged desktop does not yet implement the complete browser provisioning exchange.

## Required production integration

1. The desktop creates a pairing using its persisted CNG key, keeps its desktop confirmation/claim proof private, and opens a browser with only a narrowly scoped pairing link/code. Browser-held pairing material must not authorize device credential pickup.
2. The browser performs ownership approval and initial password creation or authenticated existing-owner approval. Browser completion returns only a non-sensitive receipt/status. It must never receive the desktop claim grant, desktop bearer, private key or a reusable device authentication secret in JavaScript, cookies, storage, URLs, analytics or logs.
3. The desktop completes a fresh, expiring, one-time key challenge bound to the approved pairing, exact profile key, fingerprint, machine UUID, current customer and generation. A desktop-controlled pickup/confirmation endpoint, or reviewed extension of `/devices/authenticate`, returns the signed enrollment and short-lived credential only to the proof-capable desktop. The server rechecks approval, generation, durable restrictions and key status transactionally. Browser session possession alone must not authorize pickup.
4. Lost responses must permit safe retry or a fresh key proof without duplicating account/enrollment business effects. Expired, replaced, revoked, reset, consumed or foreign-profile requests fail closed. Additional Windows profiles need independent key proof and explicit existing-owner/approved-profile/support authorization; they retain the same machine UUID, entitlements and trial allocation.
5. The desktop validates the existing pinned root, signed domain, profile key digest, machine UUID and fingerprint before an atomic, DPAPI-protected local enrollment update. CNG private keys remain non-exportable with their existing ACLs. Subsequent online operations obtain/renew the short-lived bearer through CNG proof. Bearer expiration does not terminate an active trial or otherwise valid offline perpetual license.

The exact pickup route/DTO and any new challenge purpose require an approved shared OpenAPI and desktop implementation before enabling production. These are acceptance requirements, not working endpoints in Phase 2. Preserve ADR-0004 artifact claims and domains; do not add fields to signed payloads casually.

## Acceptance gates

- Implement and test the browser receipt / desktop pickup split, binding to approved pairing and key, lost-response handling, expiry/replay, simultaneous pickup, account reset during confirmation and unauthorized profile attempts.
- Demonstrate that browser JavaScript and browser observability never receive desktop credentials or claim proof; add negative API tests and browser instrumentation checks.
- Run physical Windows tests across separate profiles, CNG/DPAPI persistence, process restart and locally cached license behavior. Validate artifacts with the unchanged or explicitly reviewed C# verifier.
- Independently resolve first-claim physical ownership assurance and support dispute/recovery policy. A software key plus self-reported fingerprint cannot establish genuine hardware possession and remains susceptible to preemptive fingerprint claims.
- Review commercial external signing-key custody, pinned roots and lifetime public-key retention. No synthetic development key may become a commercial trust root.

A trial-only Admin reset retires old allocation nonces. A lost old response retried after reset receives `TRIAL_ALLOCATION_CHANGED`; the integration must not silently remap that request to a new nonce. A new explicit desktop process/session can request a new start from the new allocation. A process that already verified its grant continues indefinitely offline until it exits. No heartbeat or forced network check is added.
