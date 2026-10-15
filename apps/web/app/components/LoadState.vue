<script setup lang="ts">
defineProps<{ loading?: boolean; error?: boolean; empty?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="notice" role="status">در حال دریافت اطلاعات…</div>
  <div v-else-if="error" class="notice error" role="alert">
    <p>اطلاعات دریافت نشد. لطفاً دوباره تلاش کنید.</p>
    <button class="button secondary" @click="$emit('retry')">تلاش دوباره</button>
  </div>
  <div v-else-if="empty" class="notice">هنوز موردی برای نمایش وجود ندارد.</div>
  <slot v-else />
</template>
