<script setup lang="ts">
import { blogDate as persianPublishDate, type BlogPost } from '#shared/blog-model';
const blogPath = (slug: string) => '/blog/' + slug;
const { live } = useSiteMode();
const request = useRequestFetch();
const { data, error, refresh } = await useAsyncData('public-blog', () =>
  live.value
    ? request<{ posts: BlogPost[] }>('/api/v2/blog')
    : Promise.resolve({ posts: [] as BlogPost[] }),
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
      <article v-for="(post, index) in blogPosts" :key="post.slug" class="blog-post-card">
        <div class="blog-post-kicker">
          <span class="pill">{{ post.category }}</span>
          <span class="blog-post-number" aria-hidden="true">{{
            new Intl.NumberFormat('fa-IR').format(index + 1)
          }}</span>
        </div>
        <h2>
          <NuxtLink :to="blogPath(post.slug)">{{ post.title }}</NuxtLink>
        </h2>
        <p>{{ post.description }}</p>
        <footer>
          <time :datetime="post.published_at!">{{ persianPublishDate(post.published_at!) }}</time>
          <NuxtLink
            class="text-link"
            :to="blogPath(post.slug)"
            :aria-label="'خواندن مقاله: ' + post.title"
            >خواندن مقاله <span aria-hidden="true">←</span></NuxtLink
          >
        </footer>
      </article>
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
