<script setup lang="ts">
import { useControlPopup } from '../composables/useControlPopup';
const model = defineModel<string>({ required: true });
const props = defineProps<{
  label: string;
  options: readonly { value: string; label: string; description?: string }[];
  placeholder?: string;
  disabled?: boolean;
}>();
const id = useId(),
  root = ref<HTMLElement>(),
  trigger = ref<HTMLInputElement>(),
  panel = ref<HTMLElement>(),
  open = ref(false),
  query = ref(''),
  active = ref(0);
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .toLocaleLowerCase()
    .trim();
const selected = computed(() => props.options.find((o) => o.value === model.value));
const filtered = computed(() =>
  props.options.filter((o) =>
    normalize(o.label + ' ' + (o.description ?? '')).includes(normalize(query.value)),
  ),
);
const { popupStyle, placePopup } = useControlPopup(trigger, panel, open);
function show() {
  if (props.disabled) return;
  query.value = '';
  open.value = true;
  active.value = 0;
}
function close() {
  open.value = false;
  query.value = selected.value?.label ?? '';
}
async function choose(index: number) {
  const option = filtered.value[index];
  if (!option) return;
  model.value = option.value;
  await nextTick();
  close();
  trigger.value?.focus({ preventScroll: true });
  open.value = false;
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (open.value) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    return;
  }
  if (event.key === 'Tab') {
    close();
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) {
    if ((event.key === 'Home' || event.key === 'End') && !open.value) return;
    event.preventDefault();
    if (!open.value) {
      show();
      return;
    }
    if (event.key === 'Enter') {
      void choose(active.value);
      return;
    }
    active.value =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? filtered.value.length - 1
          : Math.max(
              0,
              Math.min(
                filtered.value.length - 1,
                active.value + (event.key === 'ArrowDown' ? 1 : -1),
              ),
            );
    nextTick(() =>
      panel.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
function outside(event: Event) {
  if (!root.value?.contains(event.target as Node)) close();
}
watch(model, () => {
  query.value = selected.value?.label ?? '';
});
watch(query, () => {
  if (open.value) {
    active.value = 0;
    void placePopup();
  }
});
watch(
  () => props.disabled,
  (value) => {
    if (value) close();
  },
);
onMounted(() => {
  query.value = selected.value?.label ?? '';
  document.addEventListener('pointerdown', outside);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div ref="root" class="custom-field combobox-field">
    <label :for="id">{{ label }}</label>
    <div class="combobox-input-wrap">
      <span class="combobox-search-icon" aria-hidden="true">⌕</span
      ><input
        :id="id"
        ref="trigger"
        v-model="query"
        role="combobox"
        type="text"
        autocomplete="off"
        :placeholder="placeholder ?? 'جست‌وجو و انتخاب…'"
        :disabled="disabled"
        :aria-expanded="open"
        :aria-controls="id + '-list'"
        aria-autocomplete="list"
        :aria-activedescendant="open && filtered[active] ? id + '-option-' + active : undefined"
        @focus="show"
        @input="open = true"
        @keydown="key"
        @blur="close"
      /><span class="combobox-chevron" aria-hidden="true"><AppIcon name="chevron-down" /></span>
    </div>
    <ul
      v-if="open"
      :id="id + '-list'"
      ref="panel"
      class="select-options combobox-options"
      :style="popupStyle"
      role="listbox"
      :aria-label="label"
    >
      <li
        v-for="(option, index) in filtered"
        :id="id + '-option-' + index"
        :key="option.value"
        role="option"
        :aria-selected="model === option.value"
        :data-active="active === index"
        @pointerdown.prevent
        @click="choose(index)"
      >
        <div>
          <strong>{{ option.label }}</strong
          ><small v-if="option.description">{{ option.description }}</small>
        </div>
        <span v-if="model === option.value" class="select-check" aria-hidden="true"
          ><AppIcon name="check"
        /></span>
      </li>
      <li v-if="!filtered.length" role="presentation" class="combobox-empty">
        نوشته‌ای با این عبارت پیدا نشد.
      </li>
    </ul>
  </div>
</template>
