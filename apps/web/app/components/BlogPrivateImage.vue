<script setup lang="ts">
const props = defineProps<{ src: string; alt: string }>();
const csrf = useCookie<string>('yz_csrf_admin'),
  url = ref(''),
  failed = ref(false);
let generation = 0;
watch(
  () => props.src,
  async (src) => {
    const current = ++generation;
    url.value = '';
    failed.value = false;
    if (src.startsWith('/blog-covers/')) {
      url.value = src;
      return;
    }
    try {
      const id = src.split('/').pop()?.replace('.webp', '');
      const blob = await $fetch<Blob>('/api/v2/admin/blog/images/' + id, {
        responseType: 'blob',
        headers: { 'X-CSRF-Token': csrf.value },
        credentials: 'same-origin',
      });
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (current === generation) url.value = encoded;
    } catch {
      if (current === generation) failed.value = true;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => generation++);
</script>
<template>
  <img v-if="url" :src="url" :alt="alt" width="1536" height="1024" class="blog-cover" />
  <p v-else role="status" class="notice">
    {{ failed ? 'دریافت تصویر ممکن نشد.' : 'در حال دریافت تصویر…' }}
  </p>
</template>
