<script setup lang="ts">
import { standaloneProduct } from '#shared/products';
import { standaloneRelease, standaloneDownloadUrl } from '#shared/standalone-releases';
const props = defineProps<{ sku: string }>();
const product = computed(() => standaloneProduct(props.sku));
const release = computed(() => standaloneRelease(props.sku));
</script>
<template>
  <template v-if="product">
    <article class="panel download-status">
      <header class="download-product-heading">
        <h2>دریافت {{ product.title }}</h2>
        <NuxtLink
          class="button secondary download-product-link"
          :to="'/special-products/' + product.slug"
        >
          مشخصات و خرید بازی
          <AppIcon name="arrow-up-left" :size="18" />
        </NuxtLink>
      </header>
      <WindowsDownloadOptions
        v-if="release"
        :sku="sku"
        :modern-url="standaloneDownloadUrl(release)"
      >
        <ul>
          <li>ویندوز ۱۰ (۳۲ یا ۶۴ بیتی) یا ویندوز ۱۱ (۶۴ بیتی)</li>
          <li>نصب‌کننده نسخهٔ مناسب رایانهٔ شما را انتخاب می‌کند.</li>
          <li>اینترنت برای اتصال حساب، شروع آزمایش و دریافت مجوز</li>
        </ul>
        <DownloadFacts
          :version="release.version"
          :size-bytes="release.sizeBytes"
          :sha256="release.sha256"
        />
        <UnsignedInstallerNotice />
      </WindowsDownloadOptions>
      <p v-else class="notice">
        نصب‌کنندهٔ این بازی پس از تکمیل بررسی و انتشار، از همین صفحه قابل دریافت خواهد بود.
      </p>
    </article>
    <article class="panel">
      <h2>آزمایش و فعال‌سازی</h2>
      <ul>
        <li>برای دو نوبت آزمایش، برنامه را به حساب خود متصل کنید.</li>
        <li>
          پس از خرید، مجوز خودکار دریافت می‌شود. اگر کد فعال‌سازی دارید، آن را در بازی وارد کنید.
        </li>
        <li>پس از فعال‌سازی، می‌توانید بازی را آفلاین باز کنید.</li>
      </ul>
    </article>
    <StandaloneReleaseHistory :sku="sku" />
  </template>
</template>
<style scoped>
.download-product-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin-block-end: 1rem;
}
.download-product-heading h2 {
  margin: 0;
}
.download-product-link {
  min-height: 48px;
  gap: 0.6rem;
  font-weight: 750;
  border-color: var(--teal, #21665e);
  color: var(--teal, #21665e);
}
@media (max-width: 520px) {
  .download-product-link {
    width: 100%;
  }
}
</style>
