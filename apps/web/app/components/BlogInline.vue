<script setup lang="ts">
import { blogInline } from '#shared/blog-model';
const props = defineProps<{ text: string }>();
const parts = computed(() => blogInline(props.text));
</script>
<template>
  <template v-for="(part, index) in parts" :key="index">
    <a v-if="part.href" :href="part.href">{{ part.text }}</a>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
