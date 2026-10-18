<script setup lang="ts">
const { data: products, status, error, refresh } = await useCatalog();
useSeoMeta({ title: 'دنیای پایه‌ها | یاریزان' });
const { publicOnly, storefront } = useSiteMode();
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
      <p v-if="storefront">
        قیمت‌ها به تومان و برای هر پایه جداگانه است. پایهٔ اول نخستین عرضه است و پایه‌های دیگر
        به‌زودی می‌رسند. خرید اینترنتی هنوز فعال نیست؛ برای تهیهٔ برنامه کنار شما هستیم.
      </p>
      <p v-else-if="publicOnly">
        این فهرست برای معرفی پایه‌هاست. قیمت هنگام آغاز فروش اعلام می‌شود و خرید اینترنتی هنوز فعال
        نیست؛ برای راهنمایی کنار شما هستیم.
      </p>
      <p v-else>
        قیمت‌ها به تومان است. پرداخت اینترنتی هنوز فعال نیست؛ برای راهنمایی خرید کنار شما هستیم.
      </p>
    </div>
    <LoadState
      :loading="status === 'pending'"
      :error="!!error"
      :empty="products?.length === 0"
      @retry="refresh()"
      ><div class="product-grid">
        <ProductCard
          v-for="p in products"
          :key="p.sku"
          :product="p"
          :public-only="publicOnly"
        /></div
    ></LoadState>
  </div>
</template>
