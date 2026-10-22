# MeliPayamak pattern panel checklist

Purpose: move the six remaining patterns from `OWNER_ATTESTED` to `PANEL_VERIFIED` only with direct comparison evidence. The check reads the provider panel and sends nothing. No chargeable SMS is needed or allowed for it.

Source of truth in the repository: `backend/src/accounts/sms-templates.ts`. Admin MFA `562281` is already panel-verified with live evidence (`docs/evidence/sms-admin-mfa-live-2026-10-21.json`) and is listed for completeness only.

## Patterns to compare

Each text has exactly one placeholder, `{0}`. Every OTP text must promise three minutes, which is the server lifetime (180 seconds).

| # | Registry name | Body ID | Used for | Placeholder `{0}` | Registry status |
|---|---|---|---|---|---|
| 1 | `MOBILE_VERIFICATION` | `559424` | Claim, old mobile, new mobile OTP | 6-digit code | Owner-attested |
| 2 | `ACCOUNT_LOGIN` | `559422` | Customer login OTP | 6-digit code | Owner-attested |
| 3 | `PASSWORD_RECOVERY` | `559372` | Password reset OTP | 6-digit code | Owner-attested |
| 4 | `PASSWORD_CHANGE_VERIFICATION` | `562280` | Password change OTP | 6-digit code | Owner-attested |
| 5 | `PASSWORD_CHANGE_NOTICE` | `559421` | Password changed notice | Jalali date `1405/07/30` | Owner-attested |
| 6 | `PURCHASE_NOTICE` | `559397` | Purchase confirmation | Order UUID | Owner-attested |
| — | `ADMIN_MFA` | `562281` | Admin MFA OTP | 6-digit code | **Panel-verified** |

Approved texts (copy targets; exact characters matter, including Persian `ی` and `ک`, spaces and half spaces):

1. `559424`: `یاریزان: کد تایید شماره موبایل شما: {0} اعتبار کد: ۳ دقیقه این کد محرمانه است.`
2. `559422`: `یاریزان: کد ورود شما: {0} اعتبار کد: ۳ دقیقه این کد را در اختیار دیگران قرار ندهید.`
3. `559372`: `یاریزان: کد بازیابی رمز عبور شما: {0} است. اعتبار: ۳ دقیقه. این کد را در اختیار دیگران قرار ندهید.`
4. `562280`: `یاریزان: کد تایید تغییر رمز عبور شما: {0} اعتبار: ۳ دقیقه. این کد را در اختیار دیگران قرار ندهید.`
5. `559421`: `یاریزان: رمز عبور حساب شما در تاریخ {0} تغییر کرد. اگر این تغییر توسط شما انجام نشده است، با پشتیبانی یاریزان تماس بگیرید.`
6. `559397`: `یاریزان: سفارش شماره {0} با موفقیت پرداخت شد. برای مشاهده و فعال‌سازی محصول به حساب کاربری خود مراجعه کنید.`

## Owner steps (no SMS is sent)

1. Sign in to the MeliPayamak console and open the shared-pattern list (الگوهای اشتراکی).
2. Run `node tools/sms-test/compare-patterns.mjs` from the repository root. It reads only the repository file and your answers. It makes no network call.
3. For each pattern, answer three things:
   - the Body ID the panel shows;
   - the panel text, copied with the panel's copy action, never retyped;
   - whether the panel shows it as approved (تایید شده).
4. If pasting Persian into the terminal garbles it, put the texts in a git-ignored file instead. Use `tools/sms-test/evidence/panel-texts.txt`, one line per pattern as `<bodyId><TAB><text>`. Then run `node tools/sms-test/compare-patterns.mjs --file tools/sms-test/evidence/panel-texts.txt`.
5. The tool prints `MATCH` or `DIFFERENT` per pattern. A difference shows the first position and both characters, for example `U+064A` (Arabic Yeh) against `U+06CC` (Persian Yeh).
6. Send back only the evidence file `tools/sms-test/evidence/sms-pattern-comparison-<time>.json`. It contains hashes and verdicts, not the token or any phone number.

## What the evidence must show before a pattern is marked panel-verified

| Check | Required |
|---|---|
| `panel_body_id_matches` | `true` |
| `approved_in_panel` | `true` |
| `placeholders_in_panel` equals `placeholders_expected` | `1` = `1` |
| `text_matches` (exact, after trimming surrounding whitespace) | `true` |
| OTP texts promise three minutes | part of the exact text |

A reviewed change then sets `verification: "PANEL_VERIFIED"` and `textConfirmed: true` for exactly the patterns that passed, commits the redacted evidence under `docs/evidence/`, and updates the registry tests. A pattern that differs keeps `OWNER_ATTESTED`. Two corrections are possible: fix the panel text and have the provider approve it again, or change the registry text in a reviewed change that cites the panel. A live send is never part of this check.

## Notes

- Live delivery for these six patterns stays blocked by the registry (`textConfirmed: false` refuses to render for the live provider), whatever this checklist shows, until the reviewed change lands.
- Production SMS also stays behind gate `G6_ADMIN_SMS_MFA` and the reviewed production egress.
