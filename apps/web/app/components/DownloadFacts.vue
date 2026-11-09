<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { formatSizeMb } from '#shared/windows-release';
defineProps<{
  version: string;
  sizeBytes: number;
  sha256: string;
  experimental?: boolean;
  releasedAt?: string;
  format?: string;
}>();
</script>
<template>
  <dl class="download-facts">
    <div>
      <dt>شمارهٔ نسخه</dt>
      <dd>
        <bdi dir="ltr" data-testid="download-version">{{ persianDigits(version) }}</bdi>
        <span v-if="experimental"> — آزمایشی</span>
      </dd>
    </div>
    <div v-if="releasedAt">
      <dt>تاریخ انتشار</dt>
      <dd>{{ releasedAt }}</dd>
    </div>
    <div>
      <dt>حجم فایل</dt>
      <dd>{{ persianDigits(formatSizeMb(sizeBytes)) }} مگابایت</dd>
    </div>
    <div>
      <dt>معماری</dt>
      <dd>۳۲ و ۶۴ بیتی در یک نصب‌کننده</dd>
    </div>
    <div>
      <dt>قالب نصب‌کننده</dt>
      <dd>
        <bdi dir="ltr">{{ (format ?? 'exe').toUpperCase() }}</bdi>
      </dd>
    </div>
    <div class="download-hash">
      <dt>کد <bdi dir="ltr">SHA-256</bdi></dt>
      <dd class="mono" dir="ltr">{{ sha256 }}</dd>
    </div>
  </dl>
</template>
