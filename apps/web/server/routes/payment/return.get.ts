import { defineEventHandler, getQuery, sendRedirect, setHeader, createError } from 'h3';
import { backendBase } from '#shared/proxy-policy';
import { paymentReturnAuthority } from '#shared/payment-return';
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  const q = getQuery(event),
    config = useRuntimeConfig(event);
  if (typeof q.Authority !== 'string' || !paymentReturnAuthority.test(q.Authority))
    throw createError({ statusCode: 400 });
  const target = new URL('payments/zarinpal/return', backendBase(config.apiBase));
  target.searchParams.set('Authority', q.Authority);
  // The browser's OK/NOK is forwarded for display only; the Backend never settles on it.
  if (q.Status === 'OK' || q.Status === 'NOK') target.searchParams.set('Status', q.Status);
  const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw createError({ statusCode: 400 });
  const result = (await response.json()) as { order_id?: string };
  if (!/^[0-9a-f-]{36}$/.test(result.order_id ?? '')) throw createError({ statusCode: 400 });
  return sendRedirect(event, '/payment/result?order=' + result.order_id, 303);
});
