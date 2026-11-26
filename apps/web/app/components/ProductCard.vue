<script setup lang="ts">
import { computed } from 'vue';
import { productIcon } from '#shared/icons';
import type { PublicProduct } from '#shared/catalog-snapshot';
import { gradeNames, availability } from '#shared/domain';
import PriceBlock from './PriceBlock.vue';
import { productPath, productShots, productTitle, standaloneProduct } from '#shared/products';
import { productDownloadPath } from '#shared/product-download';
// publicOnly: rendered by the public storefront/brochure, where nothing can be bought yet.
const props = defineProps<{ product: PublicProduct; publicOnly?: boolean }>();
const cover = computed(() => productShots(props.product.sku)[0]);
const downloadPath = computed(() => productDownloadPath(props.product.sku));
</script>
<template>
  <article
    class="product-card"
    :data-grade="product.grade"
    :class="{ 'coming-soon': product.publication_status === 'coming_soon' }"
  >
    <NuxtLink
      v-if="cover"
      class="product-shot"
      :to="productPath(product)"
      tabindex="-1"
      aria-hidden="true"
    >
      <img :src="cover.src" alt="" width="1280" height="720" loading="lazy" decoding="async" />
      <span v-if="standaloneProduct(product.sku)" class="shot-badge">بازی مستقل</span>
    </NuxtLink>
    <div v-else class="product-art" :data-grade="product.grade">
      <span class="grade-number" aria-hidden="true">{{
        standaloneProduct(product.sku)?.symbol ??
        new Intl.NumberFormat('fa-IR').format(product.grade)
      }}</span>
      <span class="small-label">دفتر بازی و یادگیری</span>
      <strong v-if="standaloneProduct(product.sku)">{{
        standaloneProduct(product.sku)!.title
      }}</strong>
      <strong v-else>پایهٔ {{ gradeNames[product.grade - 1] }}</strong>
      <span class="book-lines" aria-hidden="true"></span>
      <img src="/brand/symbol.webp" alt="" width="42" height="42" />
    </div>
    <div class="product-info">
      <span
        class="badge"
        :class="product.publication_status === 'coming_soon' ? 'neutral' : 'available'"
        >{{ availability(product, publicOnly) }}</span
      >
      <h3>
        <AppIcon :name="productIcon(product.sku)" :size="24" class="product-feature-icon" />
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
          ><AppIcon name="arrow-up-left"
        /></NuxtLink>
      </div>
      <NuxtLink
        v-if="downloadPath"
        class="button secondary product-download-button"
        :to="downloadPath"
        >دریافت برنامهٔ ویندوز</NuxtLink
      >
      <button
        v-else-if="product.grade > 0 && product.publication_status === 'coming_soon'"
        class="button secondary is-disabled product-download-button"
        type="button"
        disabled
      >
        دریافت به‌زودی
      </button>
    </div>
  </article>
</template>
<style scoped>
.product-card,
.product-info {
  display: flex;
  flex-direction: column;
}
.product-card > :first-child {
  flex-shrink: 0;
}
.product-info {
  flex: 1;
}
.product-info > .badge {
  align-self: flex-start;
}
.card-bottom {
  margin-block-start: auto;
}
.product-download-button {
  margin-block-start: 20px;
  align-self: flex-start;
}
</style>
