import type { ApiPath, ApiBody, ApiResult } from '#shared/api';
import { apiPath } from '#shared/api';
export function useApi(admin = false) {
  const lifetime = new AbortController();
  onScopeDispose(() => lifetime.abort());
  const csrf = useCookie<string | undefined>(admin ? 'yz_csrf_admin' : 'yz_csrf_customer');
  const deviceContext = useState<string | undefined>('customer-device-context');
  async function call<P extends ApiPath, M extends 'get' | 'post' | 'patch'>(
    route: P,
    method: M,
    body: unknown,
    params?: Record<string, string>,
    query?: Record<string, string | number>,
  ) {
    const result = await $fetch<ApiResult<P, M>>(apiPath(route, params), {
      method: method.toUpperCase() as 'GET' | 'POST' | 'PATCH',
      ...(method === 'get' ? {} : { body: (body ?? {}) as Record<string, unknown> }),
      query,
      headers: {
        ...(csrf.value ? { 'X-CSRF-Token': csrf.value } : {}),
        ...(!admin && method !== 'get' && deviceContext.value
          ? { 'X-YariZan-Device': deviceContext.value }
          : {}),
      },
      signal: lifetime.signal,
      timeout: 15000,
      retry: 0,
      credentials: 'same-origin',
    });
    if (
      !admin &&
      method === 'post' &&
      ['/api/v2/auth/login', '/api/v2/auth/otp/verify', '/api/v2/auth/claim'].includes(route) &&
      result &&
      typeof result === 'object' &&
      'csrf_token' in result
    )
      deviceContext.value = undefined;
    if (!admin && method === 'get' && route === '/api/v2/account') {
      deviceContext.value = (result as { device_id: string }).device_id;
    }
    if (import.meta.client) {
      refreshCookie('yz_csrf_customer');
      refreshCookie('yz_csrf_admin');
    }
    return result;
  }
  return {
    get: <P extends ApiPath>(
      route: P,
      params?: Record<string, string>,
      query?: Record<string, string | number>,
    ) => call(route, 'get', undefined, params, query),
    post: <P extends ApiPath>(
      route: P,
      body: ApiBody<P, 'post'>,
      params?: Record<string, string>,
    ) => call(route, 'post', body, params),
    patch: <P extends ApiPath>(
      route: P,
      body: ApiBody<P, 'patch'>,
      params?: Record<string, string>,
    ) => call(route, 'patch', body, params),
    clear() {
      csrf.value = undefined;
      if (!admin) deviceContext.value = undefined;
    },
  };
}
