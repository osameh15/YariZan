<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean; limit?: number; home?: boolean }>(), { limit: 3 });
const { data, error, refresh } = await useBlogPosts();
</script>
<template>
  <section
    v-if="data?.posts.length || error"
    :class="['blog-highlights', { 'wrap section': home }]"
    aria-label="نوشته‌های یاریزان"
  >
    <header class="section-heading">
      <div>
        <p class="eyebrow">برای لحظه‌های کشف و یادگیری</p>
        <h2>از وبلاگ یاریزان</h2>
      </div>
      <NuxtLink class="text-link" to="/blog">همهٔ نوشته‌ها <AppIcon name="arrow-left" /></NuxtLink>
    </header>
    <p v-if="error" class="notice" role="status">
      دریافت نوشته‌ها ممکن نشد.
      <button type="button" class="button secondary" @click="refresh()">تلاش دوباره</button>
    </p>
    <div v-else :class="['blog-post-grid', { 'blog-highlights-compact': compact }]">
      <BlogCard
        v-for="post in data?.posts.slice(0, limit)"
        :key="post.slug"
        :post="post"
        :compact="true"
      />
    </div>
  </section>
</template>
