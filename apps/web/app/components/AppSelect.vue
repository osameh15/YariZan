<script setup lang="ts">
import { ref, computed, watch, nextTick, useId, onMounted, onBeforeUnmount } from 'vue';
import { useControlPopup } from '../composables/useControlPopup';
const model = defineModel<string>({ required: true });
const props = defineProps<{
  label: string;
  options: readonly { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
}>();
const id = useId(),
  open = ref(false),
  active = ref(0),
  root = ref<HTMLElement>(),
  trigger = ref<HTMLButtonElement>(),
  proxy = ref<HTMLInputElement>(),
  panel = ref<HTMLElement>();
const { popupStyle } = useControlPopup(trigger, panel, open);
const selected = computed(() => props.options.find((o) => o.value === model.value));
function show() {
  if (props.disabled) return;
  active.value = Math.max(
    0,
    props.options.findIndex((o) => o.value === model.value),
  );
  open.value = true;
}
function choose(index: number) {
  const option = props.options[index];
  if (!option) return;
  model.value = option.value;
  open.value = false;
  trigger.value?.focus();
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    event.stopPropagation();
    open.value = false;
    return;
  }
  if (event.key === 'Tab') {
    open.value = false;
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault();
    if (!open.value) {
      show();
      return;
    }
    if (['Enter', ' '].includes(event.key)) choose(active.value);
    else
      active.value =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? props.options.length - 1
            : Math.max(
                0,
                Math.min(
                  props.options.length - 1,
                  active.value + (event.key === 'ArrowDown' ? 1 : -1),
                ),
              );
  } else if (event.key.length === 1) {
    const index = props.options.findIndex((o) => o.label.startsWith(event.key));
    if (index >= 0) {
      if (!open.value) show();
      active.value = index;
    }
  }
  nextTick(() =>
    root.value?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' }),
  );
}
function outside(event: Event) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
watch(model, async () => {
  await nextTick();
  proxy.value?.dispatchEvent(new Event('input', { bubbles: true }));
});
watch(
  () => props.disabled,
  (value) => {
    if (value) open.value = false;
  },
);
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div ref="root" class="custom-field select-field">
    <label :id="id + '-label'" :for="id">{{ label }}</label>
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="select-trigger"
      role="combobox"
      :aria-labelledby="id + '-label'"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="id + '-list'"
      :aria-activedescendant="open && options[active] ? id + '-option-' + active : undefined"
      :disabled="disabled"
      @click="open ? (open = false) : show()"
      @keydown="key"
    >
      <span>{{ selected?.label ?? 'انتخاب کنید' }}</span
      ><span aria-hidden="true">⌄</span>
    </button>
    <input
      ref="proxy"
      class="validation-proxy"
      tabindex="-1"
      aria-hidden="true"
      :value="selected ? model : ''"
      :required="required"
      :disabled="disabled"
      :data-focus-target="id"
      :data-label="label"
      readonly
    />
    <ul
      v-if="open"
      :id="id + '-list'"
      ref="panel"
      :style="popupStyle"
      role="listbox"
      :aria-labelledby="id + '-label'"
      class="select-options"
    >
      <li
        v-for="(option, index) in options"
        :id="id + '-option-' + index"
        :key="option.value"
        role="option"
        :aria-selected="model === option.value"
        :data-active="active === index"
        @pointerdown.prevent
        @click="choose(index)"
      >
        {{ option.label }}<span v-if="model === option.value" aria-hidden="true">✓</span>
      </li>
      <li v-if="!options.length" class="muted" role="presentation">گزینه‌ای موجود نیست.</li>
    </ul>
  </div>
</template>
