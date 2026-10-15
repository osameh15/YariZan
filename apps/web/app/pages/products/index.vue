<script setup lang="ts">
const { data: products, status, error, refresh } = await useCatalog();
useSeoMeta({ title: 'دنیای پایه‌ها | یاریزان' });
</script>
<template>
  <div class="wrap section">
    <div class="page-intro">
      <p class="eyebrow">شش پایه، شش ماجرای مستقل</p>
      <h1>دنیای پایه‌ها</h1>
      <p>از اولین کشف‌ها تا قدم‌های بزرگ‌تر؛ همراه پایهٔ فرزندتان انتخاب کنید.</p>
    </div>
    <div class="catalog-note">
      <span aria-hidden="true">✦</span>
      <p>
        قیمت‌ها به تومان است. پرداخت اینترنتی هنوز فعال نیست؛ برای راهنمایی خرید کنار شما هستیم.
      </p>
    </div>
    <LoadState
      :loading="status === 'pending'"
      :error="!!error"
      :empty="products?.length === 0"
      @retry="refresh()"
      ><div class="product-grid">
        <ProductCard v-for="p in products" :key="p.sku" :product="p" /></div
    ></LoadState>
  </div>
</template>
