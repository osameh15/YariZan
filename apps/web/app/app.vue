<script setup lang="ts">
import { canonicalOrigin, parseIndexing, protectedRoute, sitemapPaths } from '#shared/seo';
// Origin and indexing policy are read once on the server and carried to the client payload.
const origin = useState('site-origin', () =>
  import.meta.server ? canonicalOrigin(useRuntimeConfig().webOrigin) : '',
);
const indexing = useState('seo-indexing', () =>
  import.meta.server ? parseIndexing(process.env.YARIZAN_SEO_INDEXING) : 'noindex',
);
const route = useRoute();
const canonical = computed(() =>
  origin.value && sitemapPaths.includes(route.path) ? origin.value + route.path : undefined,
);
useHead({
  link: () => (canonical.value ? [{ rel: 'canonical', href: canonical.value }] : []),
  meta: () => [
    {
      name: 'robots',
      content:
        indexing.value === 'index' && !protectedRoute.test(route.path)
          ? 'index, follow'
          : 'noindex, nofollow',
    },
  ],
});
useSeoMeta({
  ogType: 'website',
  ogLocale: 'fa_IR',
  ogSiteName: 'یاریزان',
  ogTitle: 'یاریزان | یادگیری با طعم بازی',
  ogDescription:
    'بازی‌های آموزشی فارسی برای شش پایهٔ دبستان، با دو فرصت تجربه و دسترسی آفلاین پس از فعال‌سازی.',
  ogImage: () => (origin.value ? origin.value + '/brand/logo.webp' : undefined),
  ogUrl: () => canonical.value,
  twitterCard: 'summary',
});
</script>
<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
