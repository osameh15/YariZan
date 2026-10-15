import type { ApiPath, ApiBody, ApiResult } from '#shared/api';
import { apiPath } from '#shared/api';
export function useApi(admin = false) {
  const lifetime = new AbortController();
  onScopeDispose(() => lifetime.abort());
  const csrf = useCookie<string | undefined>(admin ? 'yz_csrf_admin' : 'yz_csrf_customer');
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
      headers: csrf.value ? { 'X-CSRF-Token': csrf.value } : {},
      signal: lifetime.signal,
      timeout: 15000,
      retry: 0,
      credentials: 'same-origin',
    });
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
    },
  };
}
