<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import {
  formatSizeMb,
  latestDownloadPath,
  latestWindowsRelease,
  releasePath,
  windowsReleases,
} from '#shared/windows-release';

useSeoMeta({
  title: 'دریافت یاریزان برای ویندوز | یاریزان',
  description: 'دریافت رسمی یاریزان برای ویندوز از خود سایت، همراه با مشخصات و کد SHA-256.',
});
const release = latestWindowsRelease();
const history = windowsReleases;
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

    <article v-if="!release" class="panel download-status" data-testid="download-unavailable">
      <h2>نسخهٔ ویندوز به‌زودی منتشر می‌شود</h2>
      <p>
        هنوز نسخهٔ تأییدشدهٔ یاریزان برای ویندوز منتشر نشده است. پس از انتشار، دکمهٔ دریافت مستقیم،
        شمارهٔ نسخه، حجم فایل، تاریخ انتشار و کد SHA-256 همین‌جا قرار می‌گیرد.
      </p>
      <p>تا آن زمان لطفاً هیچ فایل نصبی با نام یاریزان را از منبع دیگری اجرا نکنید.</p>
      <NuxtLink class="button secondary" to="/support">گفت‌وگو با پشتیبانی</NuxtLink>
    </article>

    <article v-else class="panel download-status" data-testid="download-available">
      <h2>یاریزان {{ persianDigits(release.version) }} برای ویندوز</h2>
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
          <dt>کد SHA-256</dt>
          <dd dir="ltr" class="mono">{{ release.sha256 }}</dd>
        </div>
      </dl>
      <p class="actions">
        <a class="button" :href="latestDownloadPath" download>دریافت مستقیم برای ویندوز</a>
        <a class="button secondary" :href="releasePath(release)" download>پیوند ثابت این نسخه</a>
      </p>
    </article>

    <div class="support-grid">
      <article class="panel">
        <h2>نیازمندی‌های پیش‌بینی‌شده</h2>
        <p>
          ویندوز ۱۰ یا ۱۱ (۶۴ بیتی). نیازمندی‌های دقیق پس از آزمون نهایی روی دستگاه‌های واقعی ویندوز
          و پیش از انتشار همین‌جا اعلام می‌شود.
        </p>
      </article>
      <article class="panel">
        <h2>مجوز و فعال‌سازی</h2>
        <p>
          دریافت برنامه به‌تنهایی دسترسی به بازی‌ها را باز نمی‌کند. هر پایه روی همان دستگاه فعال
          می‌شود و مجوز به آن دستگاه وابسته است. خرید اینترنتی و فعال‌سازی هنوز فعال نشده است.
        </p>
      </article>
      <article class="panel">
        <h2>راهنمای نصب</h2>
        <ol>
          <li>فایل را از همین صفحه دریافت کنید.</li>
          <li>پیش از اجرا، کد SHA-256 فایل را با مقدار این صفحه مقایسه کنید.</li>
          <li>فایل نصب را اجرا کنید و مراحل نصب را دنبال کنید.</li>
          <li>پس از نصب، برنامه را باز کنید و راهنمای فعال‌سازی را دنبال کنید.</li>
        </ol>
      </article>
      <article class="panel">
        <h2>راستی‌آزمایی فایل</h2>
        <p>
          در PowerShell ویندوز این فرمان را اجرا کنید و نتیجه را با کد SHA-256 بالا مقایسه کنید:
        </p>
        <pre class="code-block" dir="ltr">Get-FileHash .\نام-فایل.exe -Algorithm SHA256</pre>
        <p>
          اگر کدها یکی نبود، فایل را اجرا نکنید و به پشتیبانی خبر بدهید. پشتیبانی هرگز رمز عبور یا
          کد پیامک شما را نمی‌خواهد.
        </p>
      </article>
    </div>

    <article class="panel">
      <h2>تاریخچهٔ نسخه‌ها و یادداشت انتشار</h2>
      <p v-if="history.length === 0" data-testid="download-history-empty">
        هنوز نسخه‌ای منتشر نشده است.
      </p>
      <ul v-else class="release-history">
        <li v-for="item in history" :key="item.version">
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
