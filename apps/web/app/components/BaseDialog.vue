<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
defineProps<{ title: string }>();
const titleId = useId();
const dialog = ref<HTMLDialogElement>();
let trigger: HTMLElement | null = null;
watch(model, async (value) => {
  await nextTick();
  if (value) {
    trigger = document.activeElement as HTMLElement;
    dialog.value?.showModal();
    dialog.value?.querySelector<HTMLElement>('.dialog-top button')?.focus({ preventScroll: true });
    dialog.value?.querySelectorAll<HTMLElement>('*').forEach((element) => {
      if (element.scrollTop) element.scrollTop = 0;
    });
    if (dialog.value) dialog.value.scrollTop = 0;
  } else {
    dialog.value?.close();
    trigger?.focus();
  }
});
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="dialog"
    @cancel="model = false"
    @close="model = false"
  >
    <div class="dialog-top">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="icon-button" aria-label="بستن پنجره" @click="model = false">
        <AppIcon name="close" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
