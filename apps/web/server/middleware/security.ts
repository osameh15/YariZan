import { defineEventHandler, setHeader, getRequestURL } from 'h3';
export default defineEventHandler((event) => {
  if (
    /^\/(?:account|zanyari|login|connect|reset-password|support-reset)(?:\/|$)/.test(
      getRequestURL(event).pathname,
    )
  )
    setHeader(event, 'Cache-Control', 'no-store');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Referrer-Policy', 'no-referrer');
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setHeader(
    event,
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
});
