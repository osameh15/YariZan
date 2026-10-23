// Authorities the payment return route forwards to the Backend: the fake test authority, a
// production ZarinPal authority ("A" + 32-40 alphanumerics; the documented form has 36 characters)
// and a sandbox authority ("S"...). Strictly alphanumeric so nothing can alter a URL. This MUST equal
// PAYMENT_RETURN_AUTHORITY in backend/src/commerce/gateway.ts; tests/unit/payment-return.test.ts
// fails if the two ever differ, so the web layer can never be stricter or looser than the Backend.
export const paymentReturnAuthority = /^(?:FAKE-[0-9a-f-]{36}|[AS][A-Za-z0-9]{32,40})$/;

// The only external destinations the UI may send a customer to for payment: a StartPay page of the
// official ZarinPal SANDBOX with a sandbox authority, or, only while the API reports live payments,
// of the production gateway with a production authority. A redirect that does not match is never
// followed.
export const sandboxStartPay =
  /^https:\/\/sandbox\.zarinpal\.com\/pg\/StartPay\/S[A-Za-z0-9]{32,40}$/;
export const liveStartPay = /^https:\/\/payment\.zarinpal\.com\/pg\/StartPay\/A[A-Za-z0-9]{32,40}$/;

/** The StartPay pattern this deployment allows: live only in live mode, sandbox only in sandbox mode. */
export function startPayPattern(
  caps: { sandbox?: boolean; real_payments_enabled?: boolean } | null,
) {
  if (caps?.real_payments_enabled === true) return liveStartPay;
  if (caps?.sandbox === true) return sandboxStartPay;
  return null;
}
