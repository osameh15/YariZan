# Login SMS notices

Owner screenshot and confirmation on 2026-11-06: customer login Body ID 578985 and Admin login Body ID 578987 are still awaiting MeliPayamak approval. The owner subsequently requested automatic activation without another release. Both retain textConfirmed=false (approval is not asserted) and use PROVIDER_ENFORCED: real successful logins attempt these two allowlisted patterns using the existing shared API; MeliPayamak decides whether the pattern may send. No pattern-specific URL is required or stored. The existing server-side shared-service token and allowlisted MeliPayamak endpoint are reused.

Customer text: یاریزان: شما در تاریخ {0} وارد حساب خود شده اید.

Admin text: یاریزان: شما در تاریخ {0} وارد پنل ادمین شده اید.

Each has one date argument, formatted from the event creation time as Jalali with Latin digits and Tehran's 24-hour time, for example 1405/08/15 13:25. Password-change notices now use the same date/time formatter. Existing OTP templates still carry only a six-digit code and retain three-minute validity. Purchase notices still carry only the order UUID.

Successful password, OTP and initial-claim customer logins enqueue a dedicated event in the same transaction as the session; Admin notices are queued only after the second SMS factor is verified. Failures, session refreshes and existing-owner profile approvals do not enqueue login notices. Dedicated event names prevent old login audit history from being sent on deployment. The existing worker claims each event once before sending, so an ambiguous provider response cannot send duplicates or block authentication. Rejected/unavailable notices are audited without retry. Once MeliPayamak approves a pattern, the next successful login can send automatically, without a site setting, deployment or extra owner confirmation. No test SMS or polling is used to infer approval. Notices older than 24 hours are skipped.

No follow-up code change is needed for approval. Existing live-send and capability controls still apply. OTP and other notices retain their existing panel-verification requirements. No live send or provider approval was claimed or tested here. Secrets, recipient numbers, codes and rendered SMS bodies are not logged.
