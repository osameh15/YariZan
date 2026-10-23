export const browserRoutes = [
  ['GET', /^commerce\/capabilities$/],
  ['POST', /^discounts\/quote$/],
  ['GET', /^orders(?:\/[0-9a-f-]{36})?$/],
  ['POST', /^orders(?:\/[0-9a-f-]{36}\/(?:payments|simulate|refund-request))?$/],
  ['GET', /^account\/orders$/],
  ['GET', /^payments\/zarinpal\/return$/],
  [
    'GET',
    /^admin\/commerce\/(?:orders|payments|campaigns|coupons|jobs|exceptions|reservations|redemptions|finance|refunds)(?:\/[0-9a-f-]{36})?$/,
  ],
  [
    'POST',
    /^admin\/commerce\/(?:campaigns|coupons|orders\/[0-9a-f-]{36}\/reconcile|refunds\/[0-9a-f-]{36}\/review)$/,
  ],
  ['PATCH', /^admin\/commerce\/(?:campaigns|coupons)\/[0-9a-f-]{36}$/],
  ['GET', /^products(?:\/YARIZAN-G[1-6])?$/],
  [
    'POST',
    /^auth\/(?:challenge|claim|login|logout|session\/rotate|password-reset\/(?:complete|otp)|otp\/(?:request|verify)|claim\/otp\/request)$/,
  ],
  ['GET', /^account(?:\/(?:devices|licenses|entitlements|security))?$/],
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
  ['PATCH', /^admin\/products\/YARIZAN-G[1-6]$/],
  // Product promotions: list and create per product, update and deactivate/restore by id.
  ['GET', /^admin\/products\/YARIZAN-G[1-6]\/promotions$/],
  ['POST', /^admin\/products\/YARIZAN-G[1-6]\/promotions$/],
  ['PATCH', /^admin\/promotions\/[0-9a-f-]{36}$/],
  ['POST', /^admin\/promotions\/[0-9a-f-]{36}\/(?:deactivate|restore)$/],
  [
    'POST',
    /^admin\/(?:customers\/[0-9a-f-]{36}\/(?:reset|password-reset)|devices\/[0-9a-f-]{36}\/products\/YARIZAN-G[1-6]\/(?:block|unblock)|trials\/[0-9a-f-]{36}\/YARIZAN-G[1-6]\/reset|licenses(?:\/issue|\/[0-9a-f-]{36}\/(?:revoke|reissue))|activation-codes(?:\/[0-9a-f-]{36}\/cancel)?)$/,
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
