<script setup lang="ts">
import {
  legacyWindowsRelease,
  legacyWindowsRequirements,
  legacyWindowsUrl,
} from '#shared/legacy-windows';
import { productTitle } from '#shared/products';
import { persianDigits } from '#shared/digits';
import { formatSizeMb } from '#shared/windows-release';
const props = defineProps<{ sku: string }>();
const release = computed(() => legacyWindowsRelease(props.sku));
</script>
<template>
  <article v-if="release" class="panel download-status" data-testid="legacy-download">
    <span class="badge neutral">نسخهٔ آزمایشی ویندوز قدیمی</span>
    <h2>{{ productTitle(sku) }} برای ویندوز ۷ SP1 و ۸.۱</h2>
    <p class="notice">
      این نسخه برای آزمایش سازگاری با ویندوز ۷ سرویس‌پک ۱ و ویندوز ۸.۱ تهیه شده است. بررسی اجرا روی
      این دو ویندوز هنوز تکمیل نشده است. برای ویندوز ۱۰ و ۱۱، نسخهٔ اصلی بالای صفحه را انتخاب کنید.
    </p>
    <dl class="download-facts">
      <div>
        <dt>شمارهٔ نسخه</dt>
        <dd>
          <bdi dir="ltr">{{ persianDigits(release.version) }}</bdi> — آزمایشی
        </dd>
      </div>
      <div>
        <dt>حجم فایل</dt>
        <dd>{{ persianDigits(formatSizeMb(release.sizeBytes)) }} مگابایت</dd>
      </div>
      <div>
        <dt>معماری</dt>
        <dd>۳۲ و ۶۴ بیتی در یک نصب‌کننده</dd>
      </div>
      <div class="download-hash">
        <dt>کد <bdi dir="ltr">SHA-256</bdi></dt>
        <dd class="mono" dir="ltr">{{ release.sha256 }}</dd>
      </div>
    </dl>
    <h3>نیازمندی‌های ویندوز ۷ و ۸.۱</h3>
    <ul>
      <li v-for="item in legacyWindowsRequirements" :key="item">{{ item }}</li>
    </ul>
    <p class="actions">
      <a class="button secondary" :href="legacyWindowsUrl(release)" download
        >دریافت آزمایشی برای ویندوز ۷ SP1 و ۸.۱</a
      >
      <a
        class="text-link"
        href="https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48"
        target="_blank"
        rel="noopener noreferrer"
        >دریافت .NET Framework 4.8 از مایکروسافت</a
      >
    </p>
    <p class="muted">
      این نصب‌کننده امضای دیجیتال ناشر ندارد. پیش از اجرا، کد فایل را با مقدار بالا مقایسه کنید:
    </p>
    <pre
      class="legacy-hash-command"
      dir="ltr"
    ><code>certutil -hashfile "{{ release.filename }}" SHA256</code></pre>
    <p class="muted">
      مجوز، حساب و دو فرصت آزمایش همان محصول حفظ می‌شوند؛ برای این نسخه نیاز به خرید دوباره ندارید.
    </p>
  </article>
</template>
<style scoped>
.legacy-hash-command {
  max-width: 100%;
  overflow-x: auto;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--paper-warm, #f2eee4);
  font-size: 0.85rem;
}
</style>
