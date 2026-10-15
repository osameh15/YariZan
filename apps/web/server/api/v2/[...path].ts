import { useRuntimeConfig } from '#imports';
import {
  defineEventHandler,
  getRequestURL,
  getHeader,
  readRawBody,
  setResponseStatus,
  setHeader,
} from 'h3';
import { allowedBrowserRoute, backendBase } from '#shared/proxy-policy';
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event),
    url = getRequestURL(event),
    route = url.pathname.slice('/api/v2/'.length),
    method = event.method;
  const fail = (status: number, code: string) => {
    setResponseStatus(event, status);
    return { error: { code } };
  };
  setHeader(event, 'Cache-Control', 'no-store');
  if (!allowedBrowserRoute(method, route)) return fail(404, 'NOT_FOUND');
  const origin = new URL(config.webOrigin).origin,
    suppliedOrigin = getHeader(event, 'origin');
  const admin = route.startsWith('admin/'),
    mutating = !['GET', 'HEAD'].includes(method);
  if (mutating && suppliedOrigin !== origin) return fail(403, 'CSRF_REJECTED');
  if (admin && route !== 'admin/auth/login' && !suppliedOrigin) {
    if (
      getHeader(event, 'sec-fetch-site') !== 'same-origin' ||
      !/^[A-Za-z0-9_-]{43}$/.test(getHeader(event, 'x-csrf-token') ?? '')
    )
      return fail(403, 'CSRF_REJECTED');
  }
  if (suppliedOrigin && suppliedOrigin !== origin) return fail(403, 'CSRF_REJECTED');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (mutating || admin) headers.Origin = origin;
  const csrf = getHeader(event, 'x-csrf-token');
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const name = admin ? 'yz_admin' : 'yz_customer';
  const cookie = (getHeader(event, 'cookie') ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter(
      (v) => v.startsWith(name + '=') && new RegExp('^' + name + '=[A-Za-z0-9_-]{43}$').test(v),
    );
  if (cookie.length === 1 && !route.startsWith('products')) headers.Cookie = cookie[0]!;
  let body: string | undefined;
  if (mutating) {
    if (getHeader(event, 'transfer-encoding')) return fail(400, 'INVALID_REQUEST');
    if (Number(getHeader(event, 'content-length') ?? 0) > 32768)
      return fail(400, 'INVALID_REQUEST');
    body = (await readRawBody(event)) || undefined;
    if (body && Buffer.byteLength(body) > 32768) return fail(400, 'INVALID_REQUEST');
  }
  try {
    const target = new URL(route, backendBase(config.apiBase));
    target.search = url.search;
    const response = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (response.headers.get('content-type')?.split(';')[0] !== 'application/json')
      return fail(503, 'SERVICE_UNAVAILABLE');
    const text = await response.text();
    if (Buffer.byteLength(text) > 1024 * 1024) return fail(503, 'SERVICE_UNAVAILABLE');
    setResponseStatus(event, response.status);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) setHeader(event, 'Set-Cookie', cookies);
    setHeader(event, 'Content-Type', 'application/json');
    return text;
  } catch {
    return fail(503, 'SERVICE_UNAVAILABLE');
  }
});
