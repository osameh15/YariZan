<script setup lang="ts">
const id = String(useRoute().params.id);
if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404 });
useSeoMeta({ title: 'جزئیات سفارش | یاریزان' });
</script>
<template><CommerceOrder :id="id" /></template>
