<script setup lang="ts">
defineProps<{ loading?: boolean; error?: boolean; empty?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="loading-state" role="status" aria-live="polite" aria-busy="true">
    <span>در حال دریافت اطلاعات…</span>
    <div class="skeleton-grid" aria-hidden="true"><span v-for="i in 3" :key="i"></span></div>
  </div>
  <div v-else-if="error" class="notice error" role="alert">
    <p>اطلاعات دریافت نشد. لطفاً دوباره تلاش کنید.</p>
    <button class="button secondary" @click="$emit('retry')">تلاش دوباره</button>
  </div>
  <div v-else-if="empty" class="empty" role="status">هنوز موردی برای نمایش وجود ندارد.</div>
  <slot v-else />
</template>
