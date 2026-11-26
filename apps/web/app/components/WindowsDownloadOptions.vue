<script setup lang="ts">
import { legacyWindowsRelease, legacyWindowsUrl } from '#shared/legacy-windows';

const props = defineProps<{ sku: string; modernUrl: string }>();
const legacy = computed(() => legacyWindowsRelease(props.sku));
</script>

<template>
  <div class="download-layout">
    <div
      class="download-action-row"
      role="group"
      aria-label="دریافت نصب‌کنندهٔ ویندوز"
      data-testid="download-action-row"
    >
      <a class="button primary" :href="modernUrl" download> دریافت برای ویندوز ۱۰ و ۱۱ </a>
      <a v-if="legacy" class="button secondary" :href="legacyWindowsUrl(legacy)" download>
        دریافت برای ویندوز ۷ SP1 و ۸.۱
      </a>
    </div>
    <section class="download-information" data-testid="download-information">
      <h3>نیازمندی‌ها و اطلاعات نصب‌کننده</h3>
      <div class="windows-download-options">
        <section class="windows-download-option" data-testid="modern-download">
          <h4>نسخهٔ اصلی برای ویندوز ۱۰ و ۱۱</h4>
          <slot />
        </section>
        <LegacyDownload v-if="legacy" :release="legacy" />
      </div>
    </section>
  </div>
</template>

<style>
.download-layout {
  display: grid;
  gap: 1rem;
}
.download-action-row,
.windows-download-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 0.75rem;
}
.download-action-row {
  padding: clamp(0.75rem, 2vw, 1.25rem);
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--paper-warm, #f2eee4);
}
.download-action-row > .button {
  min-height: 52px;
  text-align: center;
}
.download-information {
  min-width: 0;
  padding: clamp(0.75rem, 2vw, 1.25rem);
  border: 1px solid var(--line);
  border-radius: 1rem;
}
.download-information > h3 {
  margin-block: 0 0.75rem;
}
.windows-download-option {
  min-width: 0;
  padding: 0.75rem;
}
.windows-download-option > h4 {
  margin-block: 0 0.75rem;
}
.windows-download-option > ul,
.windows-download-option > details {
  margin-block: 1rem;
}
@media (min-width: 720px) {
  .windows-download-option + .windows-download-option {
    border-inline-start: 1px solid var(--line);
  }
}
</style>
