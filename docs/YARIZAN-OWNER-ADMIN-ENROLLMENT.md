# YariZan Production Owner Admin enrollment

Status: **implemented and tested; not run in production.** Enrolling real privileged accounts stays behind the Backend production gates (G8 secret custody, G6 SMS Admin MFA with controlled outbound access, and the related security acceptance). Until those gates are accepted, `NODE_ENV=production` still refuses to start, so this procedure cannot run against production.

## Goal

Two independent Production Admins, each with the full existing `owner` role, each proven through its own phone by SMS MFA, with no real identity, phone number, password or code in Git, CI, logs or the database in readable form.

## Design

Migration `011_admin_enrollment.sql` (forward-only) adds to `admins`:

| Column / rule | Purpose |
|---|---|
| `enrollment_state` `PENDING`/`ACTIVE` (default `ACTIVE`) | existing Admins stay active |
| `mobile_lookup` (keyed HMAC) + unique index | one phone can belong to one Admin; no plaintext phone |
| `created_at`, `enrolled_at` | audit and reporting |
| `admin_pending_is_disabled` check | a pending Admin is always disabled, has an encrypted phone and no `enrolled_at` |
| trigger `admins_enrollment_guard` | enrollment is one-way: an active Admin cannot return to pending |
| trigger `admin_roles_enrollment_guard` | a pending Admin can never hold a role, even by direct SQL |

`backend/src/admin/enrollment.ts` (`AdminEnrollment`) provides:

1. `provision`: creates a **pending, disabled** Admin with an Argon2id hash, an AES-256-GCM encrypted phone (existing `MOBILE_ENCRYPTION_KEY`), a keyed lookup (existing `OTP_HMAC_KEY`) and no role. The legacy TOTP column holds an unused random sealed value; no code path reads it, so there is no TOTP fallback. Rerunning with the same identity is a no-op and never resets a password or phone. A different phone for the same username, the same phone under another username, or a third distinct identity is refused (`ENROLLMENT_CONFLICT`, `ENROLLMENT_LIMIT`).
2. `begin`: verifies the pending Admin's password (with a dummy hash for unknown names, and a 5-per-15-minute rate limit), then sends the Admin MFA pattern. The code lives exactly 180 seconds on database time.
3. `complete`: verifies the code, which must belong to that Admin's current password and phone. It then activates the Admin, assigns `owner`, and audits `admin.enrollment_created`, `admin.enrollment_verified` (actor is the Admin itself), `admin.activated` and `admin.role_assigned`. **It creates no session.** The Admin then logs in normally with password followed by SMS MFA.
4. `report`: sanitized readiness (username, state, roles, permission count against the expected total, whether login is possible). No phone, hash, secret or code.

Usernames must match `^[a-z][a-z0-9._-]{4,31}$`, must not look like a phone number, and passwords need 16-128 characters with lower case, upper case, a digit and a symbol, and must not contain the username.

Nothing grants an Admin role to a customer or a public caller: the only code that writes `admin_user_roles` is the enrollment service (a source scan in the test suite enforces it). The development-only `tools/provision-admin.mjs` keeps its development/test restriction and must not be used against production.

## Operator procedure (run only after the gates are accepted)

Run on the VPS inside the API environment (the same private `api.env`), as an authorized operator, in an interactive terminal:

```bash
node tools/admin-enroll.mjs provision   # two prompts per Admin: username, password (twice), verified mobile; all hidden except username
node tools/admin-enroll.mjs verify      # once per Admin: username, password, then the code sent to that Admin's own phone
node tools/admin-enroll.mjs report      # sanitized report (also printed after each step)
```

The tool refuses to run without a TTY, reads secrets without echo, never takes them from arguments, the environment or files, and prints no value. Each Admin completes `verify` on their own phone, so the two enrollments are independent. The provider pattern is `562281` (Admin MFA). The owner attests that all seven patterns are approved; before real sending, the exact panel text and Body ID must be re-checked directly in the provider panel (see the SMS test plan).

Prerequisites checked by the application at startup: migrations match the reviewed set, independent HMAC and encryption keys, a live SMS provider with its token, and the production gates.

## Evidence

`backend/test/admin-enrollment.test.ts` (11 tests, disposable PostgreSQL 17, synthetic identities only):

- exactly two independent pending owners, no role, hashes and ciphertext only, no plaintext in any row;
- a pending Admin cannot log in and cannot hold a role (API and database trigger);
- wrong password, unknown user, wrong code, another Admin's code, unknown challenge, expired code (database time) and replay are all rejected;
- the stored OTP lifetime is exactly 180 seconds;
- activation uses only the Admin's own code, creates no session, and leaves the other Admin pending;
- both owners hold exactly the full permission set; other roles stay narrower; the report carries no secret;
- login after activation needs password then SMS MFA; no session before MFA; a TOTP field opens nothing;
- idempotent rerun, no password or phone reset, conflicts and the limit fail safely;
- per-Admin audit trail without secrets; role assignment only through the enrollment service; the tool refuses non-interactive use.

## Remaining before production use

G8 custody of the encryption and HMAC keys, G6 controlled outbound SMS and real Admin MFA acceptance, an isolated provider test, and the owner's own private input of the two identities at the terminal.
