<script setup lang="ts">
import {
  legacyWindowsRelease,
  legacyWindowsRequirements,
  legacyWindowsUrl,
} from '#shared/legacy-windows';
import { productTitle } from '#shared/products';
const props = defineProps<{ sku: string }>();
const release = computed(() => legacyWindowsRelease(props.sku));
</script>
<template>
  <article v-if="release" class="panel download-status" data-testid="legacy-download">
    <span class="badge neutral">نسخهٔ ویندوز ۷ و ۸.۱</span>
    <h2>{{ productTitle(sku) }} برای ویندوز ۷ SP1 و ۸.۱</h2>
    <p class="notice">
      این نسخه برای ویندوز ۷ سرویس‌پک ۱ و ویندوز ۸.۱ است. برای ویندوز ۱۰ و ۱۱، نسخهٔ اصلی بالای صفحه
      را انتخاب کنید.
    </p>
    <DownloadFacts
      :version="release.version"
      :size-bytes="release.sizeBytes"
      :sha256="release.sha256"
    />
    <h3>نیازمندی‌های ویندوز ۷ و ۸.۱</h3>
    <ul>
      <li v-for="item in legacyWindowsRequirements" :key="item">{{ item }}</li>
    </ul>
    <p class="actions">
      <a class="button secondary" :href="legacyWindowsUrl(release)" download
        >دریافت برای ویندوز ۷ SP1 و ۸.۱</a
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
