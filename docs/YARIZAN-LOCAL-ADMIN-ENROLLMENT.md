# Local owner Admin enrollment (workstation acceptance)

Scope: enroll the two real owner identities on the **local** stack only (`backend/compose.yaml`, database `yarizan` on `127.0.0.1:55432`). This is not production enrollment. Production stays behind G8, G6 and the other Backend gates (`docs/YARIZAN-OWNER-ADMIN-ENROLLMENT.md`).

SMS: the local stack uses the fake provider. Codes are encrypted with the local key into a git-ignored outbox and read back on the workstation. **No chargeable SMS is sent.** A real-SMS enrollment would need a separate authorization for each send.

## Synthetic validation (done before any real identity)

`backend/test/admin-enrollment.test.ts` runs the whole flow on a disposable database (`yarizan_phase2_test`) with synthetic identities and fake SMS. It has 12 tests, all passing:

| Requirement | Test |
|---|---|
| No permissions before activation | "A pending Admin cannot log in and holds no role (API and database)" |
| Independent passwords and identity records | "Exactly two independent pending owners …", "Rerunning is idempotent …" |
| Correct role and complete permission set | "Both owners hold the complete permission set …" |
| Password plus MFA login, no session before MFA | "An activated owner logs in only with password then SMS MFA …" |
| Expiry, replay and invalid proof rejected | "Enrollment rejects wrong passwords, wrong, foreign, expired and replayed codes", "Each Admin activates only through its own code …" |
| Full audit attribution | "Creation, verification, activation and role assignment are audited per Admin without secrets" |
| No escalation from customer routes | "Customer or forged credentials never reach Admin routes or change Admin roles"; "Only the reviewed enrollment path writes Admin role assignments" |
| No secret exposure | audit and outbox scanned for passwords, phones and codes; the operator tool refuses non-interactive use and echoes nothing |

## Owner steps (your own terminals; never paste values into chat)

Prerequisites: the local stack is running (`cd backend && docker compose --profile web up -d --build`), and `main` is pulled.

1. **Terminal A:** `powershell -ExecutionPolicy Bypass -File tools\local\Invoke-LocalAdminEnrollment.ps1 provision`
   - For owner 1 and then owner 2, enter: the username (visible), the password twice (hidden) and the mobile (hidden).
   - Usernames: `^[a-z][a-z0-9._-]{4,31}$`, not phone-like.
   - Passwords: 16-128 characters with lower case, upper case, a digit and a symbol, not containing the username.
   - Expected: both are `created (PENDING)`, and the report lists both as `PENDING` with no role.
2. **Terminal A:** `... Invoke-LocalAdminEnrollment.ps1 verify`, then the owner 1 username and password. It says a code was sent and waits.
3. **Terminal B:** `... Invoke-LocalAdminEnrollment.ps1 code`, which prints `SYNTHETIC LOCAL SMS ONLY: ADMIN, mobile ending ####, code ######`. Check that the last four digits are owner 1's. Type the code into terminal A within 180 seconds.
   - Expected: `ACTIVE, role owner. No session was created.`
4. Repeat steps 2 and 3 for owner 2. Owner 2 must still be `PENDING` until its own code is entered.
5. **Terminal A:** `... Invoke-LocalAdminEnrollment.ps1 report`. Expected: both `ACTIVE`, roles `["owner"]`, `permissions` equal to `permissions_expected`, `complete_owner: true`, `can_log_in: true`.
6. **Browser login:** open `http://localhost:3200/zanyari/login` and enter username and password. For the code, run `docker exec yarizan-v2-local-api-1 node dist/src/accounts/read-fake-sms.js`. Expected: the Admin console opens only after the code.

## Negative checks to record (pass or fail only)

| # | Action | Expected |
|---|---|---|
| N1 | Browser login with a wrong password | refused; no code requested |
| N2 | Correct password, then `000000` | refused; no session |
| N3 | Correct password, wait more than 3 minutes, then enter the code | refused (expired) |
| N4 | After a successful login, submit the same code again in a new login attempt | refused (replay) |
| N5 | Log in as owner 2 with owner 1's password | refused |
| N6 | Open `http://localhost:3200/zanyari` in a private window without logging in | login page only |

## What to send back

The sanitized `report` JSON from step 5 (it has no phone, hash or code) and the pass or fail for N1-N6. Do not send usernames if you prefer; the report can be redacted to states and counts.
