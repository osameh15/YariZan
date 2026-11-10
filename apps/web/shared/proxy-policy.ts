import { productSkuSource as sku } from './products';

export const browserRoutes = [
  ['POST', /^admin\/blog\/images$/],
  ['GET', /^admin\/blog\/images\/[0-9a-f-]{36}$/],
  ['GET', /^blog(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/],
  ['GET', /^admin\/blog$/],
  ['POST', /^admin\/blog$/],
  ['PATCH', /^admin\/blog\/[0-9a-f-]{36}$/],
  ['GET', /^commerce\/capabilities$/],
  ['POST', /^discounts\/quote$/],
  ['GET', /^orders(?:\/[0-9a-f-]{36})?$/],
  ['POST', /^orders(?:\/[0-9a-f-]{36}\/(?:payments|simulate|refund-request|cancel))?$/],
  ['GET', /^account\/orders$/],
  ['GET', /^payments\/zarinpal\/return$/],
  [
    'GET',
    /^admin\/commerce\/(?:orders|payments|campaigns|coupons|jobs|exceptions|reservations|redemptions|finance|refunds)(?:\/[0-9a-f-]{36})?$/,
  ],
  [
    'POST',
    /^admin\/commerce\/(?:campaigns|coupons|orders\/[0-9a-f-]{36}\/(?:reconcile|void|reopen|archive)|refunds\/[0-9a-f-]{36}\/review)$/,
  ],
  ['PATCH', /^admin\/commerce\/(?:campaigns|coupons)\/[0-9a-f-]{36}$/],
  ['GET', new RegExp(`^products(?:/${sku})?$`)],
  [
    'POST',
    /^auth\/(?:challenge|claim|login|logout|session\/rotate|password-reset\/(?:complete|otp)|otp\/(?:request|verify)|claim\/otp\/request)$/,
  ],
  [
    'GET',
    /^account(?:\/(?:devices|device-list|licenses|movable-licenses|entitlements|security))?$/,
  ],
  ['POST', /^account\/(?:device-label|switch-device|licenses\/move)$/],
  ['POST', /^admin\/entitlements\/[0-9a-f-]{36}\/move$/],
  ['POST', /^device-pairings\/[0-9a-f-]{36}\/(?:preview|confirm|cancel)$/],
  ['POST', /^admin\/auth\/(?:login|logout|sms\/verify)$/],
  ['POST', /^account\/security\/(?:otp|password|mobile)$/],
  [
    'POST',
    /^admin\/notes\/(?:customers|devices|licenses|activation-codes|trials|products|orders|payments|campaigns|coupons)\/[A-Za-z0-9:~-]{1,128}$/,
  ],
  ['GET', /^admin\/auth\/session$/],
  // Read-only payment readiness report; no write route exists.
  ['GET', /^admin\/payment-readiness$/],
  ['GET', /^admin\/(?:customers|devices|licenses|trials|activation-codes|products|audit|reports)$/],
  ['PATCH', new RegExp(`^admin/products/${sku}$`)],
  // Product promotions: list and create per product, update and deactivate/restore by id.
  ['GET', new RegExp(`^admin/products/${sku}/promotions$`)],
  ['POST', new RegExp(`^admin/products/${sku}/promotions$`)],
  ['PATCH', /^admin\/promotions\/[0-9a-f-]{36}$/],
  ['POST', /^admin\/promotions\/[0-9a-f-]{36}\/(?:deactivate|restore)$/],
  [
    'POST',
    new RegExp(
      `^admin/(?:customers/[0-9a-f-]{36}/(?:reset|password-reset)|devices/[0-9a-f-]{36}/(?:products/${sku}/(?:block|unblock)|remove|restore)|trials/[0-9a-f-]{36}/${sku}/reset|licenses(?:/issue|/[0-9a-f-]{36}/(?:revoke|reissue))|activation-codes(?:/[0-9a-f-]{36}/cancel)?)$`,
    ),
  ],
] as const;
export function allowedBrowserRoute(method: string, path: string) {
  return (
    !/[%\\?#]/.test(path) &&
    browserRoutes.some(([verb, pattern]) => verb === method && pattern.test(path))
  );
}
export function backendBase(value: string) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', 'api'].includes(url.hostname) ||
    url.port !== '3100' ||
    url.pathname !== '/api/v2/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Local backend destination required');
  return url;
}
