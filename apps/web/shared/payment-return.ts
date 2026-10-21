// Authorities the payment return route forwards to the Backend: the fake test authority, a
// production ZarinPal authority ("A" + 32-40 alphanumerics; the documented form has 36 characters)
// and a sandbox authority ("S"...). Strictly alphanumeric so nothing can alter a URL. This MUST equal
// PAYMENT_RETURN_AUTHORITY in backend/src/commerce/gateway.ts; tests/unit/payment-return.test.ts
// fails if the two ever differ, so the web layer can never be stricter or looser than the Backend.
export const paymentReturnAuthority = /^(?:FAKE-[0-9a-f-]{36}|[AS][A-Za-z0-9]{32,40})$/;
