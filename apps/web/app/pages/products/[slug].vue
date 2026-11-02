<script setup lang="ts">
const route = useRoute();
const match = /^(?:grade-|yarizan-g)([1-6])$/.exec(String(route.params.slug));
if (!match) throw createError({ statusCode: 404, statusMessage: 'محصول پیدا نشد' });
</script>
<template>
  <ProductDetails :sku="'YARIZAN-G' + match[1]" />
</template>
