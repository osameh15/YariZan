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
      <h2>دریافت {{ product.title }}</h2>
      <div v-if="release" class="windows-download-options">
        <section class="windows-download-option" data-testid="modern-download">
          <h3>نسخهٔ اصلی برای ویندوز ۱۰ و ۱۱</h3>
          <a class="button primary" :href="standaloneDownloadUrl(release)" download
            >دریافت برای ویندوز ۱۰ و ۱۱</a
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
          <p class="muted">
            این نصب‌کننده امضای دیجیتال ناشر ندارد. پیش از اجرا، کد
            <bdi dir="ltr">SHA-256</bdi> فایل را با مقدار بالا مقایسه کنید.
          </p>
        </section>
        <LegacyDownload :sku="sku" />
      </div>
      <p v-else class="notice">
        نصب‌کنندهٔ این بازی پس از تکمیل بررسی و انتشار، از همین صفحه قابل دریافت خواهد بود.
      </p>
      <p class="actions">
        <NuxtLink class="text-link" :to="'/special-products/' + product.slug"
          >مشخصات و خرید بازی</NuxtLink
        >
      </p>
    </article>
    <div class="support-grid">
      <article class="panel">
        <h2>آزمایش و فعال‌سازی</h2>
        <ul>
          <li>برای دو نوبت آزمایش، برنامه را به حساب خود متصل کنید.</li>
          <li>پس از خرید، مجوز خودکار دریافت می‌شود یا کد فعال‌سازی همین بازی را وارد کنید.</li>
          <li>با مجوز معتبر، بازی در اجراهای بعدی مستقیم و آفلاین باز می‌شود.</li>
        </ul>
      </article>
    </div>
    <StandaloneReleaseHistory :sku="sku" />
  </template>
</template>
