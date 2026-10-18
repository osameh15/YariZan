// Search indexing policy. The first public deployment stays "noindex, nofollow" until the owner
// accepts live TLS, content, mobile rendering, CDN behaviour, error pages and prices. Indexing is
// opt-in through YARIZAN_SEO_INDEXING=index; anything else (including unset) is noindex.
// Protected and transactional routes are never indexable and never appear in the sitemap.
export type Indexing = 'index' | 'noindex';
export function parseIndexing(value: unknown): Indexing {
  return value === 'index' ? 'index' : 'noindex';
}
export const protectedRoute =
  /^\/(?:account|zanyari|login|connect|checkout|payment|reset-password|support-reset|api)(?:\/|$)/i;
// Exactly the public, content-reviewed pages; product pages use the canonical grade-N slug.
export const sitemapPaths = [
  '/',
  '/products',
  ...[1, 2, 3, 4, 5, 6].map((g) => `/products/grade-${g}`),
  '/support',
];
export function robotsHeader(indexing: Indexing, path: string) {
  return indexing === 'index' && !protectedRoute.test(path) ? 'index, follow' : 'noindex, nofollow';
}
export function robotsTxt(indexing: Indexing, origin: string) {
  if (indexing !== 'index') return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    ...[
      '/account',
      '/zanyari',
      '/login',
      '/connect',
      '/checkout',
      '/payment',
      '/reset-password',
      '/support-reset',
      '/api',
    ].map((p) => `Disallow: ${p}`),
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}
export function sitemapXml(origin: string) {
  const urls = sitemapPaths.map((p) => `  <url><loc>${origin}${p === '/' ? '/' : p}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
// Canonical origin: only an https origin without path, or the local development origin.
export function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password)
    throw new Error('Invalid canonical origin');
  return url.origin;
}
