import { defineEventHandler, setHeader, getRequestURL } from 'h3';
import { parseIndexing, robotsHeader } from '#shared/seo';
export default defineEventHandler((event) => {
  if (
    /^\/(?:account|zanyari|login|connect|reset-password|support-reset|checkout|payment)(?:\/|$)/.test(
      getRequestURL(event).pathname,
    )
  )
    setHeader(event, 'Cache-Control', 'no-store');
  // Default noindex, nofollow; protected routes are never indexable (see shared/seo.ts).
  setHeader(
    event,
    'X-Robots-Tag',
    robotsHeader(parseIndexing(process.env.YARIZAN_SEO_INDEXING), getRequestURL(event).pathname),
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
