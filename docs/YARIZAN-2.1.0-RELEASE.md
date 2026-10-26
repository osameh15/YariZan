# YariZan 2.1.0

Release 2.1.0 changes the website, the Admin panel, the API and the Windows app together. This page lists what changed, the owner decisions behind it and what is still planned.

## Owner decisions (2026-10-26)

- A cancelled, failed or unsuccessful payment ends the invoice at once, and the customer can pay again. This replaces the 2026-10-22 rule that never ended a payment because of a browser `NOK`, verify `-51` or a timer.
- An invoice can be paid for 15 minutes after it is issued.
- Delete policy: an item with no history (for example a test device that was never connected) is deleted. Any item with history is archived or voided and hidden from the default lists. Orders, payments and the audit log are never deleted, because of tax records, ZarinPal disputes and the immutable audit trail.
- Customer login: the mobile number and an SMS code are enough. Password login still asks for the device ID.
- Windows 7 and 8 are not supported in 2.1.0, but customers need them. See "Planned" below.

## Payments and invoices (API, migration 014)

| Event | Result |
| --- | --- |
| The bank returns `Status=NOK` (customer cancelled, wrong card password, failed payment) | The attempt and the invoice end at once: `CANCELLED`, reason `customer_cancelled`. The coupon allocation is released. |
| The bank returns `OK`, but verify answers non-success and inquiry says `IN_BANK` or `FAILED` | The invoice ends: `FAILED`, reason `payment_unsuccessful`. |
| The invoice window passes (15 minutes; a payment started near the end keeps the bank page 15 more minutes) | One last verify call runs. If the customer paid but never came back, the payment is captured and the license is issued. Otherwise the invoice ends: `CANCELLED`, reason `invoice_expired`. |
| The customer presses "لغو این فاکتور" | The invoice ends: reason `customer_cancelled`. Refused while the bank has reported success and verification is still running. |
| The customer starts a new checkout while an unpaid invoice went to the bank | The old invoice ends and the new one is issued. An invoice that never went to the bank opens instead (no duplicate). |

An ended attempt is never verified again. If money reached the bank for it, the bank returns unverified money to the payer (the customer is told: within 72 hours).

Still unchanged: verify `100`, or `101` with order-bound evidence, is the only capture. Inquiry `VERIFIED`, `PAID` or `REVERSED` without a capture still raises an exception for a person to review.

Migration `014_invoice_lifecycle.sql` adds `orders.closed_reason`, `closed_at` and `archived_at`, and `devices.archived_at`. It also adds the `devices.manage` permission (owner) and lets the order snapshot trigger renew the invoice window, but only when an Admin sends an ended, unpaid invoice back to payment. The schema count is now 14.

## Admin panel

- Every list has a fixed-column table, a page size of 10, 20, 50, 100 or 200 rows, a row range and a page count.
- Each row has one "مدیریت" button. It opens a detail window with the record, the Windows profiles of a device, its grade restrictions, the internal note and every allowed operation. Long values no longer push the buttons around.
- Orders: void an unpaid invoice, send an ended invoice back to payment (15 minutes, original price, coupon re-checked), archive or unarchive, and re-check (reconcile). There is an archive filter.
- Devices: "حذف دستگاه" deletes a device with no history, or archives it when it has history. It is refused while the device has an active Windows profile or license. Archived devices can be restored. There is an archive filter.
- The audit log has paging.

New endpoints: `POST /api/v2/orders/{id}/cancel`, `POST /api/v2/admin/commerce/orders/{id}/void|reopen|archive` and `POST /api/v2/admin/devices/{id}/remove|restore`. `POST /api/v2/auth/otp/request` accepts no `username` for `LOGIN`. `POST /api/v2/auth/otp/verify` may return `{ select: [...] }`, and then takes a `username`.

## Customer website

- "سفارش‌های من" is a table with the status, the amount, the date and a live countdown for unpaid invoices. Its buttons are "پرداخت" or "جزئیات".
- The order page shows the 15-minute countdown, "لغو این فاکتور" and, after a cancel or failure, "صدور فاکتور تازه".
- Login with an SMS code asks only for the mobile number. When the number owns several devices, the customer picks one.
- The device and license pages use tables. The device page explains that reinstalling Windows keeps the device ID: the customer connects the app to the same account again.

## Windows app

- The activation page opens first, in a centered, movable window without the Windows title bar. Minimize and exit buttons are on the page, and there is no back button on the first page.
- After a trial start or an activation, the app returns to full screen and continues as before: information, then the game book. A purchased copy still opens the cover full screen.
- Version 2.1.0 (x64 and x86 launchers in one installer, Windows 10 1607 or later).

## Planned: Windows 7 and 8

The launcher targets .NET 9, which does not run on Windows 7 or 8.1. The installer also refuses them (`MinVersion=10.0.14393`). The mini-games do run there. A legacy launcher needs:

- a .NET Framework 4.8 build of `YariZan.App` and `YariZan.Core` (the CNG device key, WMI and `ECDsaCng` exist there; newer APIs such as `SHA256.HashData`, `Convert.ToHexString` and `ExportSubjectPublicKeyInfo` need replacements);
- TLS 1.2 on Windows 7 (KB3140245 and the registry defaults) and current root certificates for the API host;
- a separate installer with its own `MinVersion` and tests on real Windows 7 SP1 and 8.1 machines.
