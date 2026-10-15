<script setup lang="ts">
const route = useRoute();
if (
  !['products', 'customers', 'devices', 'licenses', 'trials', 'activation-codes', 'audit'].includes(
    String(route.params.section),
  )
)
  throw createError({ statusCode: 404, statusMessage: 'صفحه پیدا نشد' });
useSeoMeta({ title: 'مدیریت یاریزان' });
</script>
<template><AdminConsole :key="$route.path" /></template>
