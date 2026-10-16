<script setup lang="ts">
import { persianDigits, asciiDigits } from '#shared/digits';
const model = defineModel<string>({ required: true });
function input(event: Event) {
  const field = event.target as HTMLInputElement;
  const start = field.selectionStart,
    end = field.selectionEnd;
  model.value = asciiDigits(field.value);
  field.value = persianDigits(field.value);
  if (start !== null && end !== null) field.setSelectionRange(start, end);
}
</script>
<template>
  <input :value="persianDigits(model)" @input="input" />
</template>
