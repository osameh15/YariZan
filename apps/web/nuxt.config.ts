import tailwindcss from '@tailwindcss/vite';
export default defineNuxtConfig({
  compatibilityDate: '2026-10-15',
  devtools: { enabled: false },
  typescript: { strict: true, typeCheck: true },
  css: ['~/assets/css/main.css'],
  // Native BigInt is required for exact money display; target modern browsers and Node 24.
  vite: { plugins: [tailwindcss()], build: { target: 'es2022' } },
  esbuild: { options: { target: 'es2022' } },
  nitro: { esbuild: { options: { target: 'es2022' } } },
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
      link: [{ rel: 'icon', href: '/brand/symbol.webp' }],
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
