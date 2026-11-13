<script setup lang="ts">
import { standaloneRelease, standaloneReleaseHistory } from '#shared/standalone-releases';
import { productTitle } from '#shared/products';
import { persianDigits } from '#shared/digits';
const props = defineProps<{ sku: string }>();
const releases = computed(() => standaloneReleaseHistory(props.sku));
const latest = computed(() => standaloneRelease(props.sku));
</script>
<template>
  <article v-if="releases.length" class="panel" data-testid="special-release-history">
    <h2>تاریخچهٔ نسخه‌ها و یادداشت انتشار، {{ productTitle(sku) }}</h2>
    <ul class="release-history" role="list">
      <li v-for="item in releases" :key="item.version">
        <div class="release-history-heading">
          <h3 class="release-history-version">
            نسخهٔ <bdi dir="ltr">{{ persianDigits(item.version) }}</bdi>
          </h3>
          <span v-if="item.version === latest?.version" class="release-history-latest"
            >آخرین نسخه</span
          >
        </div>
        <ul class="release-history-notes" role="list">
          <li v-for="note in item.notes" :key="note">{{ note }}</li>
        </ul>
      </li>
    </ul>
  </article>
</template>
