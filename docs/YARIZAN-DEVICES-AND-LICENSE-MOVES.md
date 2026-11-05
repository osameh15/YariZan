# Device names, checkout device and license moves

Owner decision, 2026-11-05: one mobile number can own several devices, and every purchase binds to
one device. A customer who bought while signed in for one PC and installed the app on another found
the app waiting for a purchase that belonged to the first PC. Two changes close that gap.

## Choosing the device before paying

- Checkout shows the device the license binds to: its name and its `YZ-…` identifier.
- «خرید برای دستگاه دیگر» signs out and returns to the login page. Signing in with an SMS code
  lists every device of that mobile, so the customer picks the right one. Choosing another device
  therefore always needs a fresh SMS code; there is no new way to switch accounts.

## Device names

- In «حساب من ← دستگاه‌های من» a customer names the current device (1–40 characters, for example
  «رایانهٔ خانه»). The name is stored on that device's account (`customers.device_label`).
- Names appear in the login device picker, at checkout, in the device list and in the move dialog.
- The device list shows every active device of the same verified mobile. An unverified mobile
  shows only the current device.

## Moving a paid license

- Customer: «محصولات و مجوزها ← انتقال به دستگاه دیگر», once per purchase, only for a license
  that came from a purchase, and only to another active device of the same verified mobile.
- Admin: «مجوزهای خرید ← انتقال به دستگاه دیگر» with the target `YZ-…` identifier. Admin may move
  again, and may move licenses that came from Admin or activation codes, but still only between
  devices of one verified mobile. It uses the `licenses.reissue` permission.
- A move revokes the source license (a new signed decision) and the source entitlement, and creates
  a `TRANSFER` entitlement on the target that points at the source (`entitlements.transferred_from`).
  Nothing is deleted. Each move writes the audit event `entitlement.moved`.
- The target device receives the license through the normal purchased-license check. The source
  device stops opening the product at its next license check; until then it continues offline,
  as with any revocation.
- A license that was moved away no longer blocks buying the same product again for the old device.
- The target must not already own the product or have an open order for it.

API: `GET /api/v2/account/device-list`, `POST /api/v2/account/device-label`,
`GET /api/v2/account/movable-licenses`, `POST /api/v2/account/licenses/move`,
`POST /api/v2/admin/entitlements/{id}/move`. Migration 016 adds the columns and constraints; the
schema count is 16.
