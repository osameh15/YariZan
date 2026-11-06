<script setup lang="ts">
withDefaults(
  defineProps<{ message: string; kind?: 'error' | 'success' | 'info'; retry?: boolean }>(),
  { kind: 'error', retry: false },
);
defineEmits<{ retry: [] }>();
</script>
<template>
  <div
    v-if="message"
    class="notice api-notice"
    :class="kind"
    :role="kind === 'error' ? 'alert' : 'status'"
  >
    <AppIcon :name="kind === 'error' ? 'warning' : kind === 'success' ? 'check' : 'info'" />
    <div>
      <p>{{ message }}</p>
      <button v-if="retry" type="button" class="button secondary" @click="$emit('retry')">
        تلاش دوباره
      </button>
    </div>
  </div>
</template>
