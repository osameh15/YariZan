<script setup lang="ts">
import { ICON_NAMES, ICON_VARIANTS } from '#shared/icons';
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const icon = computed(
  () =>
    ICON_VARIANTS[props.name] ?? {
      asset: ICON_NAMES.includes(props.name as (typeof ICON_NAMES)[number]) ? props.name : 'info',
      rotation: 0,
    },
);
</script>
<template>
  <img
    class="app-icon"
    :data-icon="name"
    :src="'/brand/icons/' + icon.asset + '.webp'"
    alt=""
    aria-hidden="true"
    :width="size"
    :height="size"
    decoding="async"
    :style="{
      fontSize: size + 'px',
      transform: icon.rotation ? `rotate(${icon.rotation}deg)` : undefined,
    }"
  />
</template>
