# YariZan authentication, SMS and internal notes contracts

Phase 3.1 supersedes the password-first browser claim and TOTP Admin login descriptions in historical Phase 3 documentation. Implemented OpenAPI is `YARIZAN-OPENAPI-BACKEND-V2.json`. No commercial enrollment or deployment is enabled.

## Trust boundaries

Public username remains the deterministic device username. Mobile verification proves receipt of a phone message, not physical possession of genuine hardware. Multiple authorized Windows profiles retain one machine UUID, owner generation, purchased entitlements and trial allocation. The browser approves; only fresh device-key proof receives enrollment/credential pickup. The five desktop signed-artifact response profiles, ADR-0004 domains, offline paid verification and indefinite current-process trial continuation are unchanged.

Customer login initially selects SMS OTP; keyboard-accessible password login remains an independent alternative. Admin login remains password followed by SMS MFA. Passwords are optional independent login credentials. New accounts can be created without one. Login with password does not require SMS. Password setting/changing requires the current verified phone OTP; changing phone verifies both numbers. Credential changes close all customer sessions. Admin authentication requires password followed by a random SMS OTP, with no TOTP fallback. Existing Admins must be independently enrolled with a verified phone by an authorized operator; old TOTP ciphertext is historical and never authenticates an API request. Migration revokes pre-SMS Admin sessions; active sessions require explicit mfa_method=SMS. New active customers are constrained to verified mobile, while migrated password accounts may attach their first phone.

## Browser contracts

All paths below are prefixed `/api/v2`. Browser POST requires exact configured Origin. Account mutations additionally require the customer HttpOnly session and synchronizer CSRF header. Admin mutations/read routes retain RBAC, CSRF and recent SMS-MFA authentication. Login/OTP admission routes are unauthenticated, exact-Origin protected and rate limited. No OTP appears in any API response.

| Method/path | Body | Success |
|---|---|---|
| POST `/auth/claim/otp/request` | pairing_id, pairing_secret, mobile | challenge_id, expires_in:300, retry_after:60 |
| POST `/auth/claim` | pairing_id, pairing_secret, otp:{challenge_id,code}; optional password | APPROVED, public username, expiry, authenticated:true; first claim also sets customer cookies and returns csrf_token |
| POST `/device-pairings/:id/confirm` | same claim fields except ID in route | same receipt; existing owner uses its session/CSRF and receives no new session/cookies or csrf_token |
| POST `/auth/login` | username, password | customer cookies + csrf_token |
| POST `/auth/otp/request` | username, mobile, purpose:LOGIN or RESET | generic challenge receipt |
| POST `/auth/otp/verify` | challenge_id, code | customer cookies + csrf_token |
| POST `/auth/password-reset/otp` | challenge_id, code, password | password_changed:true; previous sessions revoked |
| GET `/account/security` | customer cookie | has_password, mobile_masked, mobile_verified |
| POST `/account/security/otp` | purpose:PASSWORD, MOBILE_OLD or MOBILE_NEW; new mobile/current proof as applicable | challenge receipt |
| POST `/account/security/password` | challenge_id, code, password | changed:true, reauthentication_required:true |
| POST `/account/security/mobile` | new challenge_id/code plus current:{challenge_id,code} | same; all sessions revoked |
| POST `/admin/auth/login` | username, password | SMS challenge receipt; **no session yet** |
| POST `/admin/auth/sms/verify` | challenge_id, code | Admin cookies + csrf_token; recent-MFA clock begins here |
| POST `/admin/notes/:type/:id` | note (0-2000 characters), expected_revision (0 for creation) | note, new revision |

First claim: desktop creates a proof-bound five-minute pairing; browser previews ID/code, requests a phone OTP, submits the proof and receives only APPROVED. No password is required. Subsequent key-bound desktop pickup, restart recovery and AUTH renewal remain desktop-only and are excluded from Nuxt's proxy. Browser codes and cookies alone cannot perform pickup.

OTP login/reset: username plus normalized mobile must match the current active device account. Unknown/mismatched combinations receive the same random-ID/expiry/cooldown receipt and no delivery. Verification errors do not distinguish wrong, expired, used, unmatched or foreign proofs. Dispatch occurs after admission and never waits on provider latency in the response, avoiding a vendor-timing account-enumeration signal. No response claims carrier delivery. Client copy says that a code is sent only if details match.

Phone format accepts Iranian `09xxxxxxxxx`, `+989xxxxxxxxx`, `00989xxxxxxxxx`, spaces/hyphens, and Persian/Arabic decimal digits. Stored ciphertext uses a dedicated AES-256-GCM key; a separate domain-separated HMAC supports exact normalized-phone lookup. Lists expose only a masked value. Multiple devices may share a family phone; username disambiguates login.

Security changes: PASSWORD sends to the existing phone. MOBILE_OLD sends to the existing phone; its proof authorizes requesting MOBILE_NEW to the proposed phone. The final change consumes both proofs atomically, binds the current session/customer/generation and credential stamp, and closes all sessions. A migrated password account without a phone may attach its first phone only with its existing password plus new-number OTP; final stamp/session validation prevents a race. A customer without access to the previous number uses independent support recovery, never a username/HWID-only reset.

Support fallback remains `/auth/password-reset/complete` with a scoped one-time grant issued through existing permission/evidence/revision controls. The UI is `/support-reset`, linked under an explicit support-grant explanation. Self-service SMS at `/reset-password` is primary. Support cannot read passwords or bypass independent ownership confirmation. A support reset does not directly replace the verified mobile.

## Initial claim and browser session atomicity

First claim consumes its pairing-bound OTP, creates the verified-mobile account, inserts exactly one eight-hour customer session (hashed token/CSRF only), appends customer.login_claim and transitions the pairing under the same PostgreSQL transaction. Device/generation/pairing/OTP locks and final revalidation prevent concurrent claims from creating additional owners or initial sessions. Audit/signing-independent transaction failure rolls everything back; no cookies are set before commit. The shared session creator/cookie writer is also used by password/OTP login and rotation.

After commit the browser gets HttpOnly yz_customer (Path=/api/v2, SameSite=Strict, Secure in production), the existing readable synchronizer CSRF cookie (Path=/), and browser-safe receipt status/username/expires_at/authenticated plus csrf_token. Session values never enter response JSON or Nuxt payloads. Exact Origin, no-store and owner CSRF checks remain. Existing-owner profile confirmation revalidates its session and returns authenticated:true without minting/replacing a session. Replays, expired/cancelled pairings, changed generation, consumed/mismatched OTP and failed transactions set no new cookies. Lost first-claim cookie delivery requires normal login; replay does not mint a replacement session.

Connect links directly to /account after approval. This is browser authentication only: fresh device-key proof remains the sole enrollment/desktop-credential pickup path. The browser never receives a desktop bearer, enrollment artifact, private key or reusable desktop proof. The retired register/desktop-confirm endpoints remain closed.

## OTP authority and delivery rules

- Six cryptographically random digits; five-minute expiry; five admitted verification attempts persisted transactionally, including failures.
- HMAC verifier includes challenge UUID, purpose and code. No plaintext OTP is stored in PostgreSQL or application logs.
- One consumption under row lock; parallel verifications create at most one business effect/session. Customer/device generation, principal, session, phone and credential stamp are rechecked where relevant. Cheap proof/binding admission precedes password hashing; no database locks span Argon2id.
- New requests retire previous unused proofs for the same purpose and principal/pairing (even when the proposed phone changes); decoy requests are isolated by phone. Fresh codes do not expand desktop trial quota.
- One request per fixed 60-second purpose/phone bucket for public login/reset, independent of whether the principal exists; other flows additionally scope to principal/pairing; six per phone/hour; 200 global/hour; customer security requests six/account/hour; first claim three/pair/hour. Existing per-IP request/verify/primary-password budgets and global password-work concurrency remain active. Bucket boundaries are documented fixed windows, not a claimed precise rolling timer.
- One process reserves at most 20 total delivery/admission slots and runs at most four vendor calls. Accepted requests enter a FIFO; excess or shutdown admission returns generic 503 SMS_UNAVAILABLE before creating a challenge. Matched and unknown/decoy requests reserve the same capacity and use identical receipts/errors without waiting for vendor timing. Decoys never contact a phone. Admission and otp.requested audit persist together before dispatch; provider exceptions are reduced to generic unavailability metadata, never raw responses or credentials. `delivered` means provider acceptance, not handset receipt.
- Immediately before dispatch, the worker checks PostgreSQL expiry, used/superseded state and prior delivery. Delayed expired/superseded requests are not sent and are audited as unavailable. Graceful shutdown closes admission, audits queued interruption, drains already-started bounded calls, then closes PostgreSQL. An already-issued vendor request cannot be recalled if expiry/supersession occurs during the network call. No automatic retry after an ambiguous provider timeout. Request a new challenge after cooldown; old proofs retire. Interrupted in-process delivery fails closed and requires a fresh request. The queue is intentionally in-process: abrupt process termination loses pending plaintext codes and delivery intent; persisted undelivered challenges fail closed, require a fresh request after cooldown and are never replayed automatically on restart. Graceful interruption is audited where PostgreSQL remains available; a crash/database outage cannot guarantee a final audit event. This phase does not claim durable carrier-delivery reconciliation or exactly-once handset delivery; deployment/reliability review remains required.
- Audit actions include otp.requested/sent/verified/verification_failed/delivery_unavailable, customer/admin login success/failure, password set/change/reset, mobile change and note create/update. Metadata excludes OTPs, mobile plaintext, password hashes and note content.

## MeliPayamak adapter

The adapter follows the vendor's [pattern-service method](https://github.com/Melipayamak/melipayamak-php/blob/master/src/SmsRest.php) and [service messaging examples](https://github.com/Melipayamak/melipayamak-php). Fixed destination: `https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber`. POST form fields are username, password, to, text and bodyId. `text` carries the pattern variables in template order, joined by `;`. Values never contain `;` or control characters, digits are sent as Latin digits, and an OTP must be exactly six digits.

The registry `backend/src/accounts/sms-templates.ts` selects the Body ID per event. The owner's panel confirmed ID and purpose only. **The pattern text (variable count and order) is not yet verified against the panel**, so every entry has `textConfirmed:false` and the live provider refuses to send it (generic `SMS_UNAVAILABLE`, no vendor call). Setting a flag requires a reviewed change citing the panel text.

| Event | Body ID | Variables (in order) | State |
|---|---|---|---|
| CLAIM, MOBILE_OLD, MOBILE_NEW | 559424 mobile verification | code | text unconfirmed |
| LOGIN | 559422 account login | code | text unconfirmed |
| RESET | 559372 password recovery | code | text unconfirmed |
| PASSWORD_CHANGED (notice, not OTP) | 559421 | date `YYYY/MM/DD` Jalali, Latin digits (assumed) | text and date format unconfirmed; dispatch not wired |
| PURCHASE_CONFIRMED (notice) | 559397 | unknown | variables unknown; purchase delivery stays simulated |
| PASSWORD (OTP) | none | n/a | **unmapped**: 559421 is a post-change notice, not an OTP. Needs an approved OTP pattern |
| ADMIN (MFA OTP) | none | n/a | **unmapped**: the customer login wording is not suitable for a privileged step-up. Needs a separately approved Admin pattern. G6 stays closed |

Unmapped events fail closed in live mode. The fake provider still serves them for local tests.

TLS verification stays enabled; redirects are forbidden, timeout is ten seconds, response body is bounded to 8 KiB. The adapter accepts HTTP success plus RetStatus=1 and a positive numeric Value; malformed/error/negative receipts fail closed. It never logs vendor payloads. Vendor acceptance/carrier delivery, template approval, actual variable mapping, credits and account permissions require a separately authorized live acceptance test. None was attempted here.

| Environment | Meaning |
|---|---|
| NODE_ENV | explicit development/test/production; production remains unconditionally closed |
| SMS_PROVIDER | disabled (default), fake (development/test only), melipayamak |
| MOBILE_ENCRYPTION_KEY | independent random 32-byte hex key for phone/fake-fixture encryption |
| OTP_HMAC_KEY | independent random 32-byte hex key for OTP verifiers and domain-separated phone lookup |
| MELIPAYAMAK_USERNAME/PASSWORD | vendor account/API credentials, outside Git and logs |
| SMS_ALLOW_LIVE | explicit true required for vendor selection; defaults false |
| SMS_FAKE_OUTBOX | optional `.local/<lowercase-name>.jsonl`; encrypted fake delivery only |
| ADMIN_MOBILE | independently verified phone for development-only Admin bootstrap |

Missing vendor configuration refuses startup when melipayamak is selected. Disabled SMS refuses OTP issuance; password customer login continues independently. Fake mode cannot open production, has no public mailbox and never claims real delivery. All five cryptographic keys must be distinct when SMS is enabled. Key rotation requires re-encrypting phones/rebuilding blind indexes and invalidating outstanding proofs through a reviewed migration; no production key rotation or custody is supplied.

For isolated manual fake-SMS testing, select fake, set independent synthetic keys and SMS_FAKE_OUTBOX. After a UI request, run `node --env-file=.env dist/src/accounts/read-fake-sms.js` from backend; Compose equivalent: `docker compose exec api node dist/src/accounts/read-fake-sms.js`. This explicit local operator command prints only an unused/unexpired **synthetic** OTP and masked target; it is not application logging or a browser API, and refuses disabled/vendor mode. Never enable a public debug endpoint or reuse these test keys commercially.

## Notes and search

Types: customers, devices, licenses, activation-codes, trials, products. Trial IDs are `device_uuid~SKU~account_generation`, using URL-safe separators. All others use their UUID, or SKU for products. Notes cover the counter records actually shown in Admin, not mutable copies of immutable trial-start history. Profile UUID search returns the shared machine record and its contextual note.

Read requires the entity's normal permission; write additionally requires notes.manage. Owner has all scopes; support can annotate only records it can already read; catalog/auditor have no implicit note-write privilege. One typed revisioned row per entity; generated foreign-key columns enforce real parent references and safe deletion. `expected_revision:0` means new note. Stale writes return 409 STALE_REVISION and never auto-overwrite. Empty note clears visible text while preserving revision/audit history.

List search is literal case-insensitive substring for username, identifiers, SKU and note text; exact normalized mobile search uses a blind-index equality, not phone fragments. Percent/underscore/backslash are escaped. Pagination stays bounded at 50 rows, deterministic ordering, explicit next_offset. GIN trigram indexes cover note text, usernames and primary UUID text; phone lookup has a partial B-tree. Cross-entity joins/very short terms can still require scans; production capacity/EXPLAIN tuning is a deployment review dependency, not a claim of constant-time full-text search.

Notes are rendered as text, never HTML. Preview and full editor share the same safe source; mutations audit actor/type/revision without copying note content to logs. Do not put OTPs/passwords/activation plaintext in notes. Operational retention and staff policy still need independent approval.
