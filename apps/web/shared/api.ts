import type { paths } from './api.generated';
export type ApiPath = keyof paths;
type Operation<P extends ApiPath, M extends string> = M extends keyof paths[P]
  ? paths[P][M]
  : never;
export type ApiBody<P extends ApiPath, M extends string> =
  Operation<P, M> extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;
export type ApiResult<P extends ApiPath, M extends string> =
  Operation<P, M> extends { responses: infer R }
    ? R[keyof R & (200 | 201)] extends { content: { 'application/json': infer B } }
      ? B
      : unknown
    : never;
export function apiPath(route: string, params: Record<string, string> = {}) {
  let path = route;
  for (const [key, value] of Object.entries(params))
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  if (path.includes('{') || !path.startsWith('/api/v2/')) throw new Error('Invalid API path');
  return path;
}
