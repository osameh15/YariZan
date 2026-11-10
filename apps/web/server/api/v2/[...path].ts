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
  const deviceContext = getHeader(event, 'x-yarizan-device');
  if (!admin && mutating && deviceContext) {
    if (!/^[0-9a-f-]{36}$/.test(deviceContext)) return fail(400, 'INVALID_REQUEST');
    headers['X-YariZan-Device'] = deviceContext;
  }
  const name = admin ? 'yz_admin' : 'yz_customer';
  const cookie = (getHeader(event, 'cookie') ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter(
      (v) => v.startsWith(name + '=') && new RegExp('^' + name + '=[A-Za-z0-9_-]{43}$').test(v),
    );
  const forwarded = cookie.length === 1 && !route.startsWith('products') ? [cookie[0]!] : [];
  // Device trust (G5) reaches only the sign-in steps that read it, and only in its exact format.
  const trustName = {
    'auth/login': 'yz_trust',
    'auth/otp/verify': 'yz_trust',
    'admin/auth/login': 'yz_trust_admin',
    'admin/auth/sms/verify': 'yz_trust_admin',
  }[route];
  if (trustName) {
    const trust = (getHeader(event, 'cookie') ?? '')
      .split(';')
      .map((v) => v.trim())
      .filter((v) =>
        new RegExp('^' + trustName + '=[A-Za-z0-9_-]{20,200}\\.[0-9a-f]{64}$').test(v),
      );
    if (trust.length === 1) forwarded.push(trust[0]!);
  }
  if (forwarded.length) headers.Cookie = forwarded.join('; ');
  const maxBody = route === 'admin/blog/images' ? 524288 : 32768;
  if (route === 'admin/blog/images' && !forwarded.length) return fail(401, 'UNAUTHENTICATED');
  let body: string | undefined;
  if (mutating) {
    if (getHeader(event, 'transfer-encoding')) return fail(400, 'INVALID_REQUEST');
    if (Number(getHeader(event, 'content-length') ?? 0) > maxBody)
      return fail(400, 'INVALID_REQUEST');
    body = (await readRawBody(event)) || undefined;
    if (body && Buffer.byteLength(body) > maxBody) return fail(400, 'INVALID_REQUEST');
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
    if (/^admin\/blog\/images\/[0-9a-f-]{36}$/.test(route) && response.ok) {
      if (response.headers.get('content-type')?.split(';')[0] !== 'image/webp')
        return fail(503, 'SERVICE_UNAVAILABLE');
      const image = Buffer.from(await response.arrayBuffer());
      if (image.length > 350000) return fail(503, 'SERVICE_UNAVAILABLE');
      setHeader(event, 'Content-Type', 'image/webp');
      return image;
    }
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
