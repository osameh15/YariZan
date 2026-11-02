<script setup lang="ts">
import { standaloneProduct } from '#shared/products';
import { standaloneRelease, standaloneDownloadUrl } from '#shared/standalone-releases';
import { persianDigits } from '#shared/digits';
const props = defineProps<{ sku: string }>();
const product = computed(() => standaloneProduct(props.sku));
const release = computed(() => standaloneRelease(props.sku));
</script>
<template>
  <template v-if="product">
    <article class="panel download-status">
      <h2>دریافت {{ product.title }}</h2>
      <template v-if="release">
        <dl class="download-facts">
          <div>
            <dt>شمارهٔ نسخه</dt>
            <dd>
              <bdi dir="ltr">{{ persianDigits(release.version) }}</bdi>
            </dd>
          </div>
          <div class="download-hash">
            <dt>کد <bdi dir="ltr">SHA-256</bdi></dt>
            <dd class="mono" dir="ltr">{{ release.sha256 }}</dd>
          </div>
        </dl>
        <p class="notice">
          این نصب‌کننده امضای دیجیتال ناشر ندارد. پیش از اجرا، کد
          <bdi dir="ltr">SHA-256</bdi> فایل را با مقدار بالا مقایسه کنید.
        </p>
      </template>
      <p v-else class="notice">
        نصب‌کنندهٔ این بازی پس از تکمیل بررسی و انتشار، از همین صفحه قابل دریافت خواهد بود.
      </p>
      <p class="actions">
        <a v-if="release" class="button" :href="standaloneDownloadUrl(release)" download
          >دریافت مستقیم برای ویندوز</a
        >
        <NuxtLink class="button secondary" :to="'/special-products/' + product.slug"
          >مشخصات و خرید بازی</NuxtLink
        >
      </p>
    </article>
    <div class="support-grid">
      <article class="panel">
        <h2>نیازمندی‌های سیستم</h2>
        <ul>
          <li>ویندوز ۱۰ یا ۱۱، نسخهٔ ۳۲ یا ۶۴ بیتی</li>
          <li>نصب‌کننده نسخهٔ مناسب رایانهٔ شما را انتخاب می‌کند.</li>
          <li>اتصال اینترنت برای دریافت، شروع نوبت آزمایش و دریافت مجوز</li>
        </ul>
      </article>
      <article class="panel">
        <h2>آزمایش و فعال‌سازی</h2>
        <ul>
          <li>برای دو نوبت آزمایش، برنامه را به حساب خود متصل کنید.</li>
          <li>پس از خرید، مجوز خودکار دریافت می‌شود یا کد فعال‌سازی همین بازی را وارد کنید.</li>
          <li>با مجوز معتبر، بازی در اجراهای بعدی مستقیم و آفلاین باز می‌شود.</li>
        </ul>
      </article>
    </div>
  </template>
</template>
