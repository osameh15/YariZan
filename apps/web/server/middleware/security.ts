import { defineEventHandler, setHeader, getRequestURL } from 'h3';
import { parseIndexing, protectedRoute, robotsHeader } from '#shared/seo';
import { pinNoStore } from '../utils/no-store';
// Runs for every request and does not depend on Nitro routeRules: protected paths (any letter
// case, since page routing is case-insensitive; GHSA-vjh5-4x84-xrqp) are never cacheable, even
// when they end in an error page.
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (protectedRoute.test(path)) pinNoStore(event);
  // Default noindex, nofollow; protected routes are never indexable (see shared/seo.ts).
  setHeader(
    event,
    'X-Robots-Tag',
    robotsHeader(parseIndexing(process.env.YARIZAN_SEO_INDEXING), path),
  );
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Referrer-Policy', 'no-referrer');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setHeader(
    event,
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://trustseal.enamad.ir; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
});
