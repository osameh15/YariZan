<script setup lang="ts">
import { blogDate, type BlogSummary } from '#shared/blog-model';
defineProps<{ post: BlogSummary; compact?: boolean }>();
</script>
<template>
  <article :class="['blog-post-card', { 'blog-card-compact': compact }]">
    <NuxtLink
      v-if="post.cover_image"
      :to="'/blog/' + post.slug"
      class="blog-card-image"
      tabindex="-1"
      aria-hidden="true"
      ><img
        :src="post.cover_image"
        alt=""
        :width="post.cover_width ?? 1536"
        :height="post.cover_height ?? 1024"
        loading="lazy"
        decoding="async"
    /></NuxtLink>
    <div class="blog-card-copy">
      <span class="blog-category">{{ post.category }}</span>
      <h3 v-if="compact">
        <NuxtLink :to="'/blog/' + post.slug">{{ post.title }}</NuxtLink>
      </h3>
      <h2 v-else>
        <NuxtLink :to="'/blog/' + post.slug">{{ post.title }}</NuxtLink>
      </h2>
      <p v-if="!compact">{{ post.description }}</p>
      <footer>
        <time v-if="post.published_at" :datetime="post.published_at">{{
          blogDate(post.published_at)
        }}</time
        ><NuxtLink :to="'/blog/' + post.slug" class="text-link" :aria-label="'خواندن ' + post.title"
          >خواندن <span aria-hidden="true">←</span></NuxtLink
        >
      </footer>
    </div>
  </article>
</template>
