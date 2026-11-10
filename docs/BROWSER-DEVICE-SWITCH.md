# Browser device selection

Customers can choose another active device linked to the same verified mobile number from the
account header or checkout. The picker shows device names and IDs, marks the selected device,
and keeps the current page/product after switching. No logout, password prompt or new SMS is
needed while the browser session remains valid. A number with only one connected device sees
instructions to connect the other computer first.

This changes the browser's selected device only. Existing desktop credentials, licenses, trial
counters and invoices keep their original device. The chosen device's account, orders, prices
and ownership are loaded again before purchase; existing invoices are never reassigned.

## Session authority

`POST /api/v2/account/switch-device` requires a valid customer session, the matching CSRF token
and same-origin request. The target must be active, on its current device generation, and have
the same verified mobile lookup as the current device. The server rechecks these conditions
under device/customer/session locks. Unknown, retired, unverified and unrelated targets are
refused without retiring the current session.

Migration 022 records the original sign-in's customer, generation, credential stamp and mobile
lookup on switched sessions. Each switch retires the old token and creates new session/CSRF
tokens, preserving the original expiry and authority through further switches and session
rotation. Password reset, mobile changes or device reset invalidate descendants of that
sign-in as well as the original device's sessions. Expired sessions still require normal login.
Each successful switch is audited without raw mobile numbers, passwords or session tokens.

Other tabs reload their device-bound views through a storage event containing only a random
marker. Customer mutations also carry `X-YariZan-Device`, the device ID obtained from the loaded
account. The API refuses a mismatch with `DEVICE_CONTEXT_CHANGED`; a stale tab cannot silently
create an invoice for the newly selected device even if browser storage is unavailable.
New invoice and quote requests from switched sessions require that device header, so an old
website tab from before this feature cannot submit a purchase without the device binding.

## Validation

Integration coverage includes same-mobile switching, separate device orders, fixed expiry,
token/CSRF rotation, credential reset of the original sign-in, stale device contexts, invalid
targets, expiry, concurrent replay, and logout. Browser coverage exercises checkout and account
switches without auth calls at desktop/mobile widths, cross-tab refresh, and creating an invoice
only for the chosen device.
