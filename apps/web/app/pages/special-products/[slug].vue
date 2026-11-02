<script setup lang="ts">
import { standaloneProducts } from '#shared/products';
const route = useRoute();
const special = standaloneProducts.find((p) => p.slug === route.params.slug);
if (!special) throw createError({ statusCode: 404, statusMessage: 'محصول پیدا نشد' });
</script>
<template>
  <ProductDetails :sku="special.sku" />
</template>
