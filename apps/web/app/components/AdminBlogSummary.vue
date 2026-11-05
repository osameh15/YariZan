<script setup lang="ts">
import { blogDate, type BlogPost } from '#shared/blog-model';
import { errorMessage } from '#shared/domain';
const api = useApi(true),
  posts = ref<BlogPost[]>([]),
  loading = ref(true),
  message = ref('');
const states = [
  { state: 'PUBLISHED', label: 'نوشتهٔ منتشرشده' },
  { state: 'DRAFT', label: 'پیش‌نویس برای بازبینی' },
  { state: 'ARCHIVED', label: 'نوشتهٔ بایگانی‌شده' },
];
async function load() {
  loading.value = true;
  message.value = '';
  try {
    posts.value = ((await api.get('/api/v2/admin/blog')) as { posts: BlogPost[] }).posts;
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="panel admin-blog-summary" aria-label="خلاصهٔ وبلاگ">
    <header class="section-heading">
      <div>
        <p class="eyebrow">صدای یاریزان</p>
        <h2>وبلاگ و نوشته‌ها</h2>
      </div>
      <NuxtLink class="button secondary" to="/zanyari/blog">مدیریت وبلاگ ←</NuxtLink>
    </header>
    <p v-if="loading" role="status">در حال دریافت نوشته‌ها…</p>
    <p v-else-if="message" role="status">
      {{ message }}
      <button type="button" class="button secondary" @click="load">تلاش دوباره</button>
    </p>
    <template v-else
      ><div class="editorial-metrics">
        <div v-for="item in states" :key="item.state">
          <strong>{{
            new Intl.NumberFormat('fa-IR').format(
              posts.filter((p) => p.state === item.state).length,
            )
          }}</strong
          ><span>{{ item.label }}</span>
        </div>
      </div>
      <ul v-if="posts.length" class="editorial-recent">
        <li v-for="post in posts.slice(0, 3)" :key="post.id">
          <NuxtLink :to="'/zanyari/blog?post=' + post.id"
            ><img
              v-if="
                post.cover_image &&
                (post.cover_image.startsWith('/blog-covers/') || post.state === 'PUBLISHED')
              "
              :src="post.cover_image ?? undefined"
              alt=""
              width="80"
              height="56"
              loading="lazy"
            />
            <div>
              <strong>{{ post.title }}</strong
              ><small
                >{{
                  post.state === 'DRAFT'
                    ? 'پیش‌نویس'
                    : post.state === 'PUBLISHED'
                      ? 'منتشرشده'
                      : 'بایگانی‌شده'
                }}
                · {{ blogDate(post.updated_at) }}</small
              >
            </div>
            <span aria-hidden="true">←</span></NuxtLink
          >
        </li>
      </ul>
      <p v-else class="muted">نخستین نوشته را در مدیریت وبلاگ بسازید.</p></template
    >
  </section>
</template>
