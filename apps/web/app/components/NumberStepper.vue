<script setup lang="ts">
import { useAttrs, useId, ref, watch, nextTick } from 'vue';
import { latinDigits } from '#shared/persian-date';
import { decimalValue } from '#shared/decimal-input';
defineOptions({ inheritAttrs: false });
const model = defineModel<number>({ required: true });
const props = withDefaults(
  defineProps<{
    min?: number | string;
    max?: number | string;
    step?: number | string;
    label?: string;
    disabled?: boolean;
  }>(),
  { step: 1, min: 0, max: Number.MAX_SAFE_INTEGER, label: 'مقدار' },
);
const attrs = useAttrs(),
  id = useId(),
  raw = ref(
    Number.isNaN(model.value)
      ? ''
      : String(model.value).replace(/[0-9]/g, (digit) => String.fromCharCode(1776 + Number(digit))),
  ),
  field = ref<HTMLInputElement>();
watch(model, async (value) => {
  raw.value = String(value).replace(/[0-9]/g, (digit) => String.fromCharCode(1776 + Number(digit)));
  await nextTick();
  field.value?.dispatchEvent(new Event('input', { bubbles: true }));
});
function input(event: Event) {
  const target = event.target as HTMLInputElement;
  raw.value = target.value;
  const value = decimalValue(latinDigits(raw.value).replace(/٫/g, '.'), String(props.step));
  if (value !== undefined && value >= Number(props.min) && value <= Number(props.max))
    model.value = value;
}
// Scale the decimal text with BigInt; stepping never adds monetary floats.
function move(direction: number) {
  const current = Number.isFinite(model.value) ? String(model.value) : String(props.min),
    step = String(props.step),
    precision = Math.max(current.split('.')[1]?.length ?? 0, step.split('.')[1]?.length ?? 0);
  const scale = 10n ** BigInt(precision),
    integer = (s: string) => {
      const [whole = '0', fraction = ''] = s.split('.');
      return BigInt(whole) * scale + BigInt(fraction.padEnd(precision, '0') || '0');
    };
  const next = integer(current) + BigInt(direction) * integer(step),
    text = precision
      ? (next / scale).toString() + '.' + (next % scale).toString().padStart(precision, '0')
      : next.toString();
  const value = Number(text);
  if (value >= Number(props.min) && value <= Number(props.max) && Number.isFinite(value))
    model.value = value;
}
</script>
<template>
  <div class="custom-field number-field">
    <label :for="id">{{ label }}</label>
    <div class="number-stepper">
      <button
        type="button"
        :aria-label="'کاهش ' + label"
        :disabled="disabled || model <= Number(min)"
        @click="move(-1)"
      >
        −
      </button>
      <input
        :id="id"
        ref="field"
        v-bind="attrs"
        :value="raw"
        type="text"
        role="spinbutton"
        inputmode="decimal"
        maxlength="32"
        dir="ltr"
        data-kind="number"
        :data-label="label"
        :aria-valuenow="Number.isFinite(model) ? model : undefined"
        :aria-valuemin="Number(min)"
        :aria-valuemax="Number(max)"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        @input="input"
        @keydown.up.prevent="move(1)"
        @keydown.down.prevent="move(-1)"
      />
      <button
        type="button"
        :aria-label="'افزایش ' + label"
        :disabled="disabled || model >= Number(max)"
        @click="move(1)"
      >
        +
      </button>
    </div>
  </div>
</template>
