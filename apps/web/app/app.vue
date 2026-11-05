<script setup lang="ts">
import {
  canonicalOrigin,
  canonicalPath,
  pageMetadata,
  parseIndexing,
  robotsHeader,
} from '#shared/seo';
// Origin and indexing policy are read once on the server and carried to the client payload.
const origin = useState('site-origin', () =>
  import.meta.server ? canonicalOrigin(useRuntimeConfig().webOrigin) : '',
);
const indexing = useState('seo-indexing', () =>
  import.meta.server ? parseIndexing(process.env.YARIZAN_SEO_INDEXING) : 'noindex',
);
const route = useRoute();
const pageError = useError();
// The request path is available before async pages finish rendering; route.path alone can
// omit a canonical from the initial catalog HTML and add it only during hydration.
const requestPath = import.meta.server ? useRequestURL().pathname : undefined;
const path = computed(() => (import.meta.server ? requestPath! : route.path));
const metadata = computed(() => pageMetadata(path.value));
const canonical = computed(() =>
  origin.value && !pageError.value && canonicalPath(path.value)
    ? origin.value + canonicalPath(path.value)
    : undefined,
);
useHead({
  link: () => (canonical.value ? [{ rel: 'canonical', href: canonical.value }] : []),
  meta: () => [
    {
      name: 'robots',
      content: pageError.value ? 'noindex, nofollow' : robotsHeader(indexing.value, path.value),
    },
  ],
});
useSeoMeta({
  description: () => metadata.value.description,
  ogType: 'website',
  ogLocale: 'fa_IR',
  ogSiteName: 'یاریزان',
  ogTitle: () => metadata.value.title,
  ogDescription: () => metadata.value.description,
  ogImage: () => (origin.value ? origin.value + '/brand/logo.webp' : undefined),
  ogUrl: () => canonical.value,
  twitterCard: 'summary',
});
</script>
<template>
  <PageLoader /><NuxtLayout><NuxtPage /></NuxtLayout>
</template>
