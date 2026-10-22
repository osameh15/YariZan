<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import {
  formatSizeMb,
  gradeStatus,
  gradeTitles,
  grades,
  latestForGrade,
  latestPath,
  parseGrade,
  releasePath,
  releasesForGrade,
  type Grade,
} from '#shared/windows-release';

useSeoMeta({
  title: 'دریافت یاریزان برای ویندوز | یاریزان',
  description: 'دریافت رسمی یاریزان برای ویندوز از خود سایت، با انتخاب پایه، مشخصات و کد SHA-256.',
});
const route = useRoute();
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
  'ویندوز ۱۰ یا ۱۱ (۶۴ بیتی)',
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
    <div class="page-intro">
      <p class="eyebrow">نسخهٔ ویندوز</p>
      <h1>دریافت یاریزان برای ویندوز</h1>
      <p>
        نسخهٔ رسمی یاریزان فقط از همین سایت دریافت می‌شود. فایل را از جای دیگری، پیام‌رسان یا لینک
        ناشناس نگیرید.
      </p>
    </div>

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
        <h2>
          یاریزان پایهٔ {{ gradeTitles[selected] }}، نسخهٔ
          <span dir="ltr">{{ persianDigits(release.version) }}</span>
        </h2>
        <dl class="download-facts">
          <div>
            <dt>شمارهٔ نسخه</dt>
            <dd dir="ltr">{{ persianDigits(release.version) }}</dd>
          </div>
          <div>
            <dt>تاریخ انتشار</dt>
            <dd>{{ formatDate(release.releasedAt) }}</dd>
          </div>
          <div>
            <dt>حجم فایل</dt>
            <dd>{{ persianDigits(formatSizeMb(release.sizeBytes)) }} مگابایت</dd>
          </div>
          <div>
            <dt>قالب نصب‌کننده</dt>
            <dd dir="ltr">{{ release.format.toUpperCase() }}</dd>
          </div>
          <div class="download-hash">
            <dt>کد <bdi dir="ltr">SHA-256</bdi></dt>
            <dd dir="ltr" class="mono">{{ release.sha256 }}</dd>
          </div>
        </dl>
        <div
          v-if="release.approval.signature === 'unsigned-owner-approved'"
          class="notice"
          data-testid="download-unsigned-notice"
        >
          <p>
            این فایل نصب امضای دیجیتال ناشر (<bdi dir="ltr">Authenticode</bdi>) ندارد. ویندوز ممکن
            است هنگام اجرا با پیام «<bdi dir="ltr">Windows protected your PC</bdi>» یا «ناشر ناشناس»
            هشدار دهد.
          </p>
          <p>
            پیش از اجرا، کد <bdi dir="ltr">SHA-256</bdi> فایل دریافتی را با مقدار بالا مقایسه کنید.
            فقط اگر دقیقاً یکی بود، روی «<bdi dir="ltr">More info</bdi>» و سپس «<bdi dir="ltr"
              >Run anyway</bdi
            >» بزنید. این فایل را فقط از همین صفحه دریافت کنید.
          </p>
          <p>مجوزهای بازی همچنان با امضای رمزنگاری‌شدهٔ یاریزان صادر و در برنامه بررسی می‌شوند.</p>
        </div>
        <p class="actions">
          <a class="button" :href="latestPath(selected)" download>دریافت مستقیم برای ویندوز</a>
          <a class="button secondary" :href="releasePath(release)" download>پیوند ثابت این نسخه</a>
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
          <span class="button secondary is-disabled" role="link" aria-disabled="true">به‌زودی</span>
          <NuxtLink class="button secondary" to="/support">گفت‌وگو با پشتیبانی</NuxtLink>
        </p>
      </template>
    </article>

    <div class="support-grid">
      <article class="panel">
        <h2>نیازمندی‌های سیستم</h2>
        <ul>
          <li v-for="item in release ? release.requirements : defaultRequirements" :key="item">
            {{ item }}
          </li>
        </ul>
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
      <ul v-else class="release-history">
        <li v-for="item in releaseHistory" :key="item.version">
          <strong dir="ltr">{{ persianDigits(item.version) }}</strong>
          <span>{{ formatDate(item.releasedAt) }}</span>
          <ul>
            <li v-for="note in item.notes" :key="note">{{ note }}</li>
          </ul>
        </li>
      </ul>
    </article>

    <p class="muted">
      برای پرسش دربارهٔ نصب یا مجوز، <NuxtLink to="/support">با پشتیبانی</NuxtLink> گفت‌وگو کنید.
    </p>
  </section>
</template>
