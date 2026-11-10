<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
const props = withDefaults(defineProps<{ title: string; locked?: boolean }>(), { locked: false });
function cancel(event: Event) {
  if (props.locked) event.preventDefault();
  else model.value = false;
}
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
    @cancel="cancel"
    @close="model = false"
  >
    <div class="dialog-top">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="icon-button" aria-label="بستن پنجره" :disabled="locked" @click="model = false">
        <AppIcon name="close" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
