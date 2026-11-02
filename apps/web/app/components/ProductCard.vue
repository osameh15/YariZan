<script setup lang="ts">
import type { PublicProduct } from '#shared/catalog-snapshot';
import { gradeNames, availability } from '#shared/domain';
import PriceBlock from './PriceBlock.vue';
import { productPath, productTitle, standaloneProduct } from '#shared/products';
// publicOnly: rendered by the public storefront/brochure, where nothing can be bought yet.
defineProps<{ product: PublicProduct; publicOnly?: boolean }>();
</script>
<template>
  <article
    class="product-card"
    :data-grade="product.grade"
    :class="{ 'coming-soon': product.publication_status === 'coming_soon' }"
  >
    <div class="product-art" :data-grade="product.grade">
      <template v-if="standaloneProduct(product.sku)">
        <span class="grade-number" aria-hidden="true">{{
          standaloneProduct(product.sku)?.symbol
        }}</span>
        <span class="small-label">بازی مستقل · محصولات ویژه</span>
        <strong>{{ product.title_fa }}</strong>
        <span class="book-lines" aria-hidden="true"></span>
        <img src="/brand/symbol.webp" alt="" width="42" height="42" />
      </template>
      <template v-else
        ><span class="grade-number" aria-hidden="true">{{
          new Intl.NumberFormat('fa-IR').format(product.grade)
        }}</span
        ><span class="small-label">دفتر بازی و یادگیری</span
        ><strong>پایهٔ {{ gradeNames[product.grade - 1] }}</strong
        ><span class="book-lines" aria-hidden="true"></span
        ><img src="/brand/symbol.webp" alt="" width="42" height="42"
      /></template>
    </div>
    <div class="product-info">
      <span
        class="badge"
        :class="product.publication_status === 'coming_soon' ? 'neutral' : 'available'"
        >{{ availability(product, publicOnly) }}</span
      >
      <h3>
        <NuxtLink :to="productPath(product)">{{ productTitle(product.sku) }}</NuxtLink>
      </h3>
      <p>
        {{ standaloneProduct(product.sku)?.description ?? 'یک دنیای مستقل، برای یک پایهٔ تازه.' }}
      </p>
      <div class="card-bottom">
        <PriceBlock
          :list="product.price_irr"
          :test-price="product.test_price"
          :promotion="product.publication_status === 'coming_soon' ? null : product.promotion"
        /><NuxtLink
          class="round-link"
          :to="productPath(product)"
          :aria-label="`آشنایی با ${product.title_fa}`"
          >↖</NuxtLink
        >
      </div>
    </div>
  </article>
</template>
