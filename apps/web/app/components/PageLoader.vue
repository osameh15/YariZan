<script setup lang="ts">
// Shown while a navigation loads; the throttle keeps fast page changes from flashing it.
const { isLoading } = useLoadingIndicator({ throttle: 150 });
</script>
<template>
  <Transition name="page-loader">
    <div v-if="isLoading" class="page-loader" role="status" aria-live="polite">
      <img src="/brand/logo.webp" alt="" width="118" height="78" />
      <span class="sr-only">در حال بارگذاری صفحه…</span>
    </div>
  </Transition>
</template>
