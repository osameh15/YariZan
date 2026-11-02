<script setup lang="ts">
const { data: products, status, error, refresh } = await useCatalog();
const { publicOnly } = useSiteMode();
const special = computed(() => products.value?.filter((p) => p.grade === 0) ?? []);
useSeoMeta({
  title: 'محصولات ویژه | یاریزان',
  description: 'بازی‌های مستقل یاریزان؛ دو فرصت آزمایش و مجوز همیشگی برای هر بازی.',
});
</script>
<template>
  <section class="wrap section">
    <div class="page-intro">
      <p class="eyebrow">هر بازی، یک کشف تازه</p>
      <h1>محصولات ویژه</h1>
      <p>
        بازی موردعلاقهٔ فرزندتان را جداگانه انتخاب کنید؛ هر بازی برنامه و مجوز مستقل خودش را دارد.
      </p>
    </div>
    <LoadState
      :loading="status === 'pending'"
      :error="!!error"
      :empty="!special.length"
      @retry="refresh()"
    >
      <div class="product-grid">
        <ProductCard
          v-for="product in special"
          :key="product.sku"
          :product="product"
          :public-only="publicOnly"
        />
      </div>
    </LoadState>
  </section>
</template>
