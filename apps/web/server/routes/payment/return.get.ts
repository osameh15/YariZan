import { defineEventHandler, getQuery, sendRedirect, setHeader, createError } from 'h3';
import { backendBase } from '#shared/proxy-policy';
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  const q = getQuery(event),
    config = useRuntimeConfig(event);
  if (
    typeof q.Authority !== 'string' ||
    !/^(?:FAKE-[0-9a-f-]{36}|A[A-Za-z0-9]{32})$/.test(q.Authority)
  )
    throw createError({ statusCode: 400 });
  const target = new URL('payments/zarinpal/return', backendBase(config.apiBase));
  target.searchParams.set('Authority', q.Authority);
  const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw createError({ statusCode: 400 });
  const result = (await response.json()) as { order_id?: string };
  if (!/^[0-9a-f-]{36}$/.test(result.order_id ?? '')) throw createError({ statusCode: 400 });
  return sendRedirect(event, '/payment/result?order=' + result.order_id, 303);
});
