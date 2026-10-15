<script setup lang="ts">
import type { Product } from '#shared/domain';
import { gradeNames, toman, availability } from '#shared/domain';
defineProps<{ product: Product }>();
</script>
<template>
  <article
    class="product-card"
    :class="{ 'coming-soon': product.publication_status === 'coming_soon' }"
  >
    <div class="product-art" :data-grade="product.grade">
      <span class="grade-number" aria-hidden="true">{{
        new Intl.NumberFormat('fa-IR').format(product.grade)
      }}</span
      ><span class="small-label">دفتر بازی و یادگیری</span
      ><strong>پایهٔ {{ gradeNames[product.grade - 1] }}</strong
      ><span class="book-lines" aria-hidden="true"></span
      ><img src="/brand/symbol.webp" alt="" width="42" height="42" />
    </div>
    <div class="product-info">
      <span
        class="badge"
        :class="product.publication_status === 'coming_soon' ? 'neutral' : 'available'"
        >{{ availability(product) }}</span
      >
      <h3>
        <NuxtLink :to="`/products/grade-${product.grade}`"
          >یاریزان پایهٔ {{ gradeNames[product.grade - 1] }}</NuxtLink
        >
      </h3>
      <p>یک دنیای مستقل، برای یک پایهٔ تازه.</p>
      <div class="card-bottom">
        <span class="price">{{ toman(product.price_irr) }} <small>تومان</small></span
        ><NuxtLink
          class="round-link"
          :to="`/products/grade-${product.grade}`"
          :aria-label="`آشنایی با پایهٔ ${gradeNames[product.grade - 1]}`"
          >↖</NuxtLink
        >
      </div>
    </div>
  </article>
</template>
