import tailwindcss from '@tailwindcss/vite';
import type { NuxtPage } from 'nuxt/schema';
import { brochurePageAllowed } from './shared/site-mode';

// Build profile: "full" (default) or "brochure". A brochure build physically omits every
// account, commerce, Admin and API proxy route; the runtime YARIZAN_SITE_MODE must match it.
const buildProfile = process.env.YARIZAN_BUILD_PROFILE ?? 'full';
if (!['full', 'brochure', 'storefront'].includes(buildProfile))
  throw new Error('YARIZAN_BUILD_PROFILE_INVALID: expected full, brochure or storefront');
// brochure and storefront are public-only builds with the same physical omissions.
const brochure = buildProfile !== 'full';
function keepBrochurePages(pages: NuxtPage[]) {
  for (let index = pages.length - 1; index >= 0; index--) {
    const page = pages[index]!;
    const sample = page.path.replace(':slug()', 'grade-1');
    if (!brochurePageAllowed(sample)) pages.splice(index, 1);
  }
}
export default defineNuxtConfig({
  compatibilityDate: '2026-10-15',
  devtools: { enabled: false },
  typescript: { strict: true, typeCheck: true },
  css: ['~/assets/css/main.css', '~/assets/css/premium.css'],
  // Native BigInt is required for exact money display; target modern browsers and Node 24.
  vite: { plugins: [tailwindcss()], build: { target: 'es2022' } },
  esbuild: { options: { target: 'es2022' } },
  nitro: {
    esbuild: { options: { target: 'es2022' } },
    replace: { __YARIZAN_BUILD_PROFILE__: JSON.stringify(buildProfile) },
    output: {
      dir: process.env.YARIZAN_OUTPUT_DIR ?? (brochure ? `.output-${buildProfile}` : '.output'),
    },
  },
  // Brochure builds never contain the browser API proxy or the payment return handler.
  ignore: brochure ? ['server/api/**', 'server/routes/payment/**'] : [],
  hooks: { 'pages:extend': (pages) => (brochure ? keepBrochurePages(pages) : undefined) },
  runtimeConfig: { apiBase: 'http://127.0.0.1:3100/api/v2/', webOrigin: 'http://localhost:3200' },
  app: {
    head: {
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      title: 'یاریزان | یادگیری با طعم بازی',
      meta: [
        {
          name: 'description',
          content:
            'یاریزان؛ بازی‌های آموزشی فارسی برای شش پایهٔ دبستان. دو فرصت تجربه و دسترسی آفلاین پس از فعال‌سازی.',
        },
      ],
      link: [
        { rel: 'icon', href: '/brand/symbol.webp' },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/Shabnam.woff2',
          crossorigin: 'anonymous',
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/Shabnam-Bold.woff2',
          crossorigin: 'anonymous',
        },
      ],
    },
  },
  routeRules: {
    '/checkout': { headers: { 'cache-control': 'no-store' } },
    '/payment/**': { headers: { 'cache-control': 'no-store' } },
    '/account/**': { headers: { 'cache-control': 'no-store' } },
    '/zanyari/**': { headers: { 'cache-control': 'no-store' } },
    '/connect': { headers: { 'cache-control': 'no-store' } },
    '/login': { headers: { 'cache-control': 'no-store' } },
    '/support-reset': { headers: { 'cache-control': 'no-store' } },
    '/reset-password': { headers: { 'cache-control': 'no-store' } },
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },
});
