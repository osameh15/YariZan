<script setup lang="ts">
import { type BlogSummary } from '#shared/blog-model';
const blogPath = (slug: string) => '/blog/' + slug;
const { live } = useSiteMode();
const request = useRequestFetch();
const { data, error, refresh } = await useAsyncData('public-blog', () =>
  live.value
    ? request<{ posts: BlogSummary[] }>('/api/v2/blog')
    : Promise.resolve({ posts: [] as BlogSummary[] }),
);
const blogPosts = computed(() => data.value?.posts ?? []);
import { jsonLd, pageMetadata } from '#shared/seo';

const metadata = pageMetadata('/blog');
useSeoMeta({ title: metadata.title, description: metadata.description });
const origin = useState<string>('site-origin');
useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: jsonLd({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: metadata.title,
        description: metadata.description,
        inLanguage: 'fa-IR',
        url: origin.value + '/blog',
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: blogPosts.value.map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: post.title,
            url: origin.value + blogPath(post.slug),
          })),
        },
      }),
    },
  ],
}));
</script>

<template>
  <section class="wrap section blog-index">
    <div class="page-intro">
      <p class="eyebrow">برای خانواده‌های همراه کودک</p>
      <h1>وبلاگ یاریزان</h1>
      <p>ایده‌هایی برای بازی و یادگیری، انتخاب آگاهانهٔ بازی آموزشی و شروع آسان‌تر با یاریزان.</p>
    </div>
    <p v-if="error" role="alert">
      دریافت نوشته‌ها ممکن نشد.
      <button type="button" class="button secondary" @click="refresh()">تلاش دوباره</button>
    </p>
    <p v-else-if="!blogPosts.length" class="notice">
      نوشته‌های تازه به‌زودی در این بخش منتشر می‌شوند.
    </p>
    <div class="blog-post-grid">
      <BlogCard v-for="post in blogPosts" :key="post.slug" :post="post" />
    </div>
    <aside class="blog-next-step">
      <div>
        <h2>بازی مناسب را از نزدیک بشناسید</h2>
        <p>
          معرفی پایه‌ها و بازی‌های مستقل را ببینید و پیش از انتخاب، شرایط دریافت و آزمایش را بررسی
          کنید.
        </p>
      </div>
      <NuxtLink class="button secondary" to="/products">آشنایی با محصولات</NuxtLink>
    </aside>
  </section>
</template>
