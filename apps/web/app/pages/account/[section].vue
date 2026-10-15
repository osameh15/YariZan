<script setup lang="ts">
const route = useRoute();
if (!['devices', 'licenses', 'security', 'orders'].includes(String(route.params.section)))
  throw createError({ statusCode: 404, statusMessage: 'صفحه پیدا نشد' });
useSeoMeta({ title: 'حساب من | یاریزان' });
</script>
<template><CustomerPortal :key="$route.path" /></template>
