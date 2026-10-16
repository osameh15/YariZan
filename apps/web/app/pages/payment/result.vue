<script setup lang="ts">
const id = String(useRoute().query.order ?? '');
if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404 });
useSeoMeta({ title: 'بررسی نتیجهٔ پرداخت | یاریزان' });
</script>
<template><CommerceOrder :id="id" /></template>
