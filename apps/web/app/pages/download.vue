<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { standaloneProduct, standaloneProducts } from '#shared/products';
import { standaloneRelease } from '#shared/standalone-releases';
import {
  gradeStatus,
  gradeTitles,
  grades,
  latestForGrade,
  latestUrl,
  parseGrade,
  releaseUrl,
  releasesForGrade,
  type Grade,
} from '#shared/windows-release';

useSeoMeta({
  title: 'دریافت یاریزان برای ویندوز | یاریزان',
  description:
    'دریافت یاریزان برای ویندوز ۱۰ و ۱۱ و نسخهٔ آزمایشی ویندوز ۷ SP1 و ۸.۱؛ نیازمندی‌ها، حجم و کد بررسی فایل.',
});
const route = useRoute();
const requestedProduct = computed(() => standaloneProduct(String(route.query.product ?? '')));
const specialTab = computed(() => route.query.tab === 'special' || !!requestedProduct.value);
const selectedProduct = computed(() => requestedProduct.value ?? standaloneProducts[0]);
const productStatus = (sku: string) => (standaloneRelease(sku) ? 'available' : 'coming-soon');
const selected = ref<Grade>(parseGrade(route.query.grade));
// Keep the address in step with the choice so a grade can be shared or bookmarked. The router is
// not involved: a lagging route update must never overwrite a newer keyboard selection.
watch(selected, (grade) => {
  if (import.meta.client) history.replaceState(history.state, '', `/download?grade=${grade}`);
});
const release = computed(() => latestForGrade(selected.value));
const releaseHistory = computed(() => releasesForGrade(selected.value));
const status = (grade: Grade) => gradeStatus(grade);
const statusLabel = (grade: Grade) =>
  status(grade) === 'available'
    ? 'آمادهٔ دریافت'
    : status(grade) === 'content-ready'
      ? 'محتوا آماده است'
      : 'به‌زودی';
const defaultRequirements = [
  'ویندوز ۱۰ (۳۲ یا ۶۴ بیتی) یا ویندوز ۱۱ (۶۴ بیتی)',
  'اتصال اینترنت برای دریافت برنامه، شروع نوبت آزمایش و دریافت مجوز',
];
const formatDate = (iso: string) =>
  persianDigits(
    new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso + 'T00:00:00Z')),
  );
</script>
<template>
  <section class="wrap section">
    <div class="page-intro download-intro">
      <p class="eyebrow">نسخهٔ ویندوز</p>
      <h1>دریافت یاریزان برای ویندوز</h1>
      <p>
        نسخهٔ رسمی یاریزان فقط از همین سایت دریافت می‌شود. فایل را از جای دیگری، پیام‌رسان یا لینک
        ناشناس نگیرید.
      </p>
    </div>

    <nav class="download-tabs" aria-label="انتخاب نوع برنامه">
      <NuxtLink class="download-tab" to="/download" :aria-current="!specialTab ? 'page' : undefined"
        >دنیای پایه‌ها</NuxtLink
      >
      <NuxtLink
        class="download-tab"
        to="/download?tab=special"
        :aria-current="specialTab ? 'page' : undefined"
        >محصولات ویژه</NuxtLink
      >
    </nav>
    <template v-if="specialTab">
      <p class="download-legend">محصول موردنظر را انتخاب کنید</p>
      <div class="grade-cards product-cards" data-testid="product-picker">
        <NuxtLink
          v-for="product in standaloneProducts"
          :key="product.sku"
          class="grade-card"
          :class="{ 'is-selected': selectedProduct?.sku === product.sku }"
          :to="'/download?product=' + product.sku"
          :aria-current="selectedProduct?.sku === product.sku ? 'true' : undefined"
          :data-status="productStatus(product.sku)"
        >
          <img
            v-if="product.shots.length"
            class="product-thumb"
            :src="product.shots[0]!.src"
            alt=""
            width="1280"
            height="720"
            loading="lazy"
          />
          <span v-if="!product.shots.length" class="product-thumb" aria-hidden="true">{{
            product.symbol
          }}</span>
          <span class="grade-name">{{ product.title }}</span>
          <span class="grade-chip">{{
            productStatus(product.sku) === 'available' ? 'آمادهٔ دریافت' : 'به‌زودی'
          }}</span>
        </NuxtLink>
      </div>
      <StandaloneDownload v-if="selectedProduct" :sku="selectedProduct.sku" />
    </template>
    <template v-else>
      <form method="get" action="/download" class="grade-picker" data-testid="grade-picker">
        <fieldset>
          <legend>پایهٔ موردنظر را انتخاب کنید</legend>
          <div class="grade-cards">
            <label
              v-for="grade in grades"
              :key="grade"
              class="grade-card"
              :class="{ 'is-selected': selected === grade }"
              :data-grade="grade"
              :data-status="status(grade)"
            >
              <input v-model.number="selected" type="radio" name="grade" :value="grade" />
              <span class="grade-number" aria-hidden="true">{{ persianDigits(grade) }}</span>
              <span class="grade-name">پایهٔ {{ gradeTitles[grade] }}</span>
              <span class="grade-chip">{{ statusLabel(grade) }}</span>
            </label>
          </div>
        </fieldset>
        <noscript
          ><button class="button secondary" type="submit">نمایش پایهٔ انتخاب‌شده</button></noscript
        >
      </form>

      <article
        class="panel download-status"
        :data-testid="release ? 'download-available' : 'download-unavailable'"
        aria-live="polite"
      >
        <template v-if="release">
          <span class="badge neutral">نسخهٔ اصلی برای ویندوز ۱۰ و ۱۱</span>
          <h2>
            یاریزان پایهٔ {{ gradeTitles[selected] }}، نسخهٔ
            <span dir="ltr">{{ persianDigits(release.version) }}</span>
          </h2>
          <DownloadFacts
            :version="release.version"
            :size-bytes="release.sizeBytes"
            :sha256="release.sha256"
            :released-at="formatDate(release.releasedAt)"
            :format="release.format"
          />
          <div
            v-if="release.approval.signature === 'unsigned-owner-approved'"
            class="notice"
            data-testid="download-unsigned-notice"
          >
            <p>
              این فایل نصب امضای دیجیتال ناشر (<bdi dir="ltr">Authenticode</bdi>) ندارد. ویندوز ممکن
              است هنگام اجرا با پیام «<bdi dir="ltr">Windows protected your PC</bdi>» یا «ناشر
              ناشناس» هشدار دهد.
            </p>
            <p>
              پیش از اجرا، کد <bdi dir="ltr">SHA-256</bdi> فایل دریافتی را با مقدار بالا مقایسه
              کنید. فقط اگر دقیقاً یکی بود، روی «<bdi dir="ltr">More info</bdi>» و سپس «<bdi
                dir="ltr"
                >Run anyway</bdi
              >» بزنید. این فایل را فقط از همین صفحه دریافت کنید.
            </p>
            <p>
              مجوزهای بازی همچنان با امضای رمزنگاری‌شدهٔ یاریزان صادر و در برنامه بررسی می‌شوند.
            </p>
          </div>
          <p class="actions">
            <a class="button" :href="latestUrl(selected)" download>دریافت برای ویندوز ۱۰ و ۱۱</a>
            <a class="button secondary" :href="releaseUrl(release)" download>پیوند ثابت این نسخه</a>
          </p>
        </template>
        <template v-else>
          <h2>پایهٔ {{ gradeTitles[selected] }}: نسخهٔ ویندوز به‌زودی منتشر می‌شود</h2>
          <p>
            هنگام انتشار، نسخه، حجم، تاریخ و کد <bdi dir="ltr">SHA-256</bdi> این پایه همین‌جا نمایش
            داده می‌شود.
          </p>
          <p>لطفاً هیچ فایل نصبی با نام یاریزان را از منبعی جز همین صفحه اجرا نکنید.</p>
          <p class="actions">
            <span class="button secondary is-disabled" role="link" aria-disabled="true"
              >به‌زودی</span
            >
            <NuxtLink class="button secondary" to="/support">گفت‌وگو با پشتیبانی</NuxtLink>
          </p>
        </template>
      </article>

      <LegacyDownload v-if="release" :sku="'YARIZAN-G' + selected" />

      <div class="support-grid">
        <article class="panel">
          <h2>نیازمندی‌های نسخهٔ اصلی ویندوز ۱۰ و ۱۱</h2>
          <ul>
            <li v-for="item in release ? release.requirements : defaultRequirements" :key="item">
              {{ item }}
            </li>
          </ul>
          <p>
            نسخهٔ اصلی شامل فایل‌های اجرای برنامه است و به نصب جداگانهٔ .NET Framework 4.8 نیاز
            ندارد.
          </p>
        </article>
        <article class="panel">
          <h2>مجوز و فعال‌سازی</h2>
          <p>
            دریافت برنامه به‌تنهایی دسترسی به بازی‌ها را باز نمی‌کند. هر پایه روی همان دستگاه فعال
            می‌شود و مجوز به آن دستگاه وابسته است.
          </p>
        </article>
        <article class="panel">
          <h2>راهنمای نصب</h2>
          <ol>
            <li>پایهٔ موردنظر را انتخاب و فایل را از همین صفحه دریافت کنید.</li>
            <li>
              پیش از اجرا، کد <bdi dir="ltr">SHA-256</bdi> فایل را با مقدار این صفحه مقایسه کنید.
            </li>
            <li>فایل نصب را اجرا کنید و مراحل نصب را دنبال کنید.</li>
            <li>پس از نصب، برنامه را باز کنید و راهنمای فعال‌سازی را دنبال کنید.</li>
          </ol>
        </article>
        <article class="panel">
          <h2>راستی‌آزمایی فایل</h2>
          <p>
            در <bdi dir="ltr">PowerShell</bdi> ویندوز این فرمان را اجرا کنید و نتیجه را با کد
            <bdi dir="ltr">SHA-256</bdi> بالا مقایسه کنید:
          </p>
          <pre class="code-block" dir="ltr" tabindex="0" aria-label="فرمان راستی‌آزمایی فایل">
Get-FileHash .\نام-فایل.exe -Algorithm SHA256</pre>
          <p>
            اگر کدها یکی نبود، فایل را اجرا نکنید و به پشتیبانی خبر بدهید. پشتیبانی هرگز رمز عبور یا
            کد پیامک شما را نمی‌خواهد.
          </p>
        </article>
      </div>

      <article class="panel">
        <h2>تاریخچهٔ نسخه‌ها و یادداشت انتشار، پایهٔ {{ gradeTitles[selected] }}</h2>
        <p v-if="releaseHistory.length === 0" data-testid="download-history-empty">
          برای این پایه هنوز نسخه‌ای منتشر نشده است.
        </p>
        <ul v-else class="release-history" role="list">
          <li v-for="item in releaseHistory" :key="item.version">
            <div class="release-history-heading">
              <h3 class="release-history-version">
                نسخهٔ <bdi dir="ltr">{{ persianDigits(item.version) }}</bdi>
              </h3>
              <span v-if="item.version === release?.version" class="release-history-latest">
                آخرین نسخه
              </span>
              <time :datetime="item.releasedAt">{{ formatDate(item.releasedAt) }}</time>
            </div>
            <ul class="release-history-notes" role="list">
              <li v-for="note in item.notes" :key="note">{{ note }}</li>
            </ul>
          </li>
        </ul>
      </article>
    </template>
    <p class="muted">
      برای پرسش دربارهٔ نصب یا مجوز، <NuxtLink to="/support">با پشتیبانی</NuxtLink> گفت‌وگو کنید.
    </p>
  </section>
</template>
