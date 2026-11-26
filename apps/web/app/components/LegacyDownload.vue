<script setup lang="ts">
import { legacyWindowsRequirements, type LegacyWindowsRelease } from '#shared/legacy-windows';
import { productTitle } from '#shared/products';
defineProps<{ release: LegacyWindowsRelease }>();
</script>
<template>
  <section class="windows-download-option" data-testid="legacy-download">
    <h4>ویندوز ۷ SP1 و ۸.۱</h4>
    <p v-if="release.channel === 'experimental'" class="muted">
      نسخهٔ آزمایشی {{ productTitle(release.sku) }}
    </p>
    <ul>
      <li v-for="item in legacyWindowsRequirements" :key="item">{{ item }}</li>
    </ul>
    <DownloadFacts
      :version="release.version"
      :size-bytes="release.sizeBytes"
      :sha256="release.sha256"
    />
    <details>
      <summary>راهنمای نصب و بررسی فایل</summary>
      <a
        class="text-link"
        href="https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48"
        target="_blank"
        rel="noopener noreferrer"
        >دریافت .NET Framework 4.8 از مایکروسافت</a
      >
      <p class="muted">
        این نصب‌کننده امضای دیجیتال ناشر ندارد. پیش از اجرا، کد فایل را با مقدار بالا مقایسه کنید:
      </p>
      <pre
        class="legacy-hash-command"
        dir="ltr"
      ><code>certutil -hashfile "{{ release.filename }}" SHA256</code></pre>
      <p class="muted">
        مجوز، حساب و دو فرصت آزمایش همان محصول حفظ می‌شوند؛ برای این نسخه نیاز به خرید دوباره
        ندارید.
      </p>
    </details>
  </section>
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
