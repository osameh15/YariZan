<script setup lang="ts">
import { blogBlocks, blogDate, type BlogPost } from '#shared/blog-model';
import { jsonLd } from '#shared/seo';
const route = useRoute();
const { live } = useSiteMode();
const request = useRequestFetch();
const slug = String(route.params.slug);
if (!live.value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw createError({ statusCode: 404 });
const { data: post, error } = await useAsyncData('blog-' + slug, () =>
  request<BlogPost>('/api/v2/blog/' + slug),
);
if (!post.value) throw createError({ statusCode: error.value?.statusCode === 404 ? 404 : 503 });
const origin = useState<string>('site-origin');
const canonical = computed(() => origin.value + '/blog/' + slug);
const headings = computed(() =>
  blogBlocks(post.value?.body ?? '').filter((block) => block.type === 'heading'),
);
useSeoMeta({
  title: () => (post.value?.seo_title || post.value?.title) + ' | وبلاگ یاریزان',
  description: () => post.value?.seo_description || post.value?.description,
  ogTitle: () => post.value?.seo_title || post.value?.title,
  ogDescription: () => post.value?.seo_description || post.value?.description,
  ogType: 'article',
});
useHead(() => ({
  script: post.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: jsonLd({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'BlogPosting',
                headline: post.value.title,
                description: post.value.description,
                datePublished: post.value.published_at,
                dateModified: post.value.updated_at,
                inLanguage: 'fa-IR',
                mainEntityOfPage: canonical.value,
                author: { '@type': 'Organization', name: 'یاریزان', url: origin.value },
                publisher: {
                  '@type': 'Organization',
                  name: 'یاریزان',
                  url: origin.value,
                  logo: { '@type': 'ImageObject', url: origin.value + '/brand/logo.webp' },
                },
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'خانه', item: origin.value + '/' },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'وبلاگ یاریزان',
                    item: origin.value + '/blog',
                  },
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: post.value.title,
                    item: canonical.value,
                  },
                ],
              },
            ],
          }),
        },
      ]
    : [],
}));
</script>
<template>
  <div v-if="post" class="wrap section blog-reading">
    <nav class="blog-breadcrumbs" aria-label="مسیر صفحه">
      <NuxtLink to="/">خانه</NuxtLink><span aria-hidden="true">/</span
      ><NuxtLink to="/blog">وبلاگ یاریزان</NuxtLink>
    </nav>
    <article class="blog-article">
      <header class="blog-article-header">
        <p class="eyebrow">{{ post.category }}</p>
        <h1>{{ post.title }}</h1>
        <p class="blog-byline">
          یاریزان <span aria-hidden="true">·</span>
          <time v-if="post.published_at" :datetime="post.published_at">{{
            blogDate(post.published_at)
          }}</time>
        </p>
        <p class="hero-lead">{{ post.description }}</p>
      </header>
      <nav v-if="headings.length" class="blog-toc" aria-label="در این نوشته">
        <strong>در این نوشته می‌خوانید</strong>
        <ul>
          <li v-for="heading in headings" :key="heading.id">
            <a :href="'#' + heading.id">{{ heading.text }}</a>
          </li>
        </ul>
      </nav>
      <BlogBody :body="post.body" />
    </article>
    <aside class="blog-resource-links">
      <NuxtLink class="text-link" to="/blog">بازگشت به نوشته‌ها ←</NuxtLink>
    </aside>
  </div>
</template>
