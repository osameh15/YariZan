<script setup lang="ts">
import { ref, onMounted, useId } from 'vue';
const emit = defineEmits<{ submit: [event: SubmitEvent] }>();
const form = ref<HTMLFormElement>();
const summary = ref<string[]>([]),
  submitted = ref(false),
  prefix = useId();
const digits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
function fields() {
  return form.value
    ? Array.from(
        form.value.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          'input,textarea,select',
        ),
      ).filter((f) => !f.disabled && f.type !== 'hidden')
    : [];
}
function message(f: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const v = f.value,
    label =
      f.getAttribute('data-label') ??
      (Array.from(f.closest('label')?.childNodes ?? [])
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim() ||
        'این بخش');
  if (
    f.required &&
    (!v.trim() || (f instanceof HTMLInputElement && f.type === 'checkbox' && !f.checked))
  )
    return `${label} را وارد کنید.`;
  if (!v) return '';
  const min = Number(f.getAttribute('minlength') ?? 0),
    max = Number(f.getAttribute('maxlength') ?? 100000);
  if (v.length < min) return `حداقل ${new Intl.NumberFormat('fa-IR').format(min)} نویسه وارد کنید.`;
  if (v.length > max) return `حداکثر ${new Intl.NumberFormat('fa-IR').format(max)} نویسه مجاز است.`;
  const pattern = f.getAttribute('pattern');
  if (pattern && !new RegExp('^(?:' + pattern + ')$').test(digits(v)))
    return (
      f.getAttribute('data-format-message') ?? 'ساختار این مقدار درست نیست؛ دوباره بررسی کنید.'
    );
  if (
    f.getAttribute('data-kind') === 'mobile' &&
    !/^(?:09[0-9]{9}|\+989[0-9]{9}|00989[0-9]{9})$/.test(digits(v).replace(/[\s-]/g, ''))
  )
    return 'شمارهٔ همراه را به‌صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.';
  const match = f.getAttribute('data-match');
  if (match) {
    const other = fields().find((x) => x.name === match);
    if (other && v !== other.value) return 'رمز عبور و تکرار آن یکسان نیستند.';
  }
  if (f instanceof HTMLInputElement && f.type === 'number') {
    const n = Number(v);
    if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER)
      return 'یک عدد معتبر وارد کنید.';
    const step = Number(f.step || 1);
    if (step > 0 && Math.abs(n / step - Math.round(n / step)) > 0.000001)
      return 'مقدار را با گام مشخص‌شده وارد کنید.';
    if (f.min && n < Number(f.min)) return 'مقدار واردشده کمتر از حد مجاز است.';
    if (f.max && n > Number(f.max)) return 'مقدار واردشده بیشتر از حد مجاز است.';
  }
  return '';
}
function paint(f: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index: number) {
  if (!f.id) f.id = prefix + '-field-' + index;
  const id = f.id + '-error';
  let p = form.value?.querySelector<HTMLElement>('[id="' + CSS.escape(id) + '"]');
  if (!p) {
    p = document.createElement('span');
    p.id = id;
    p.className = 'field-error';
    (f.closest('label') ?? f).insertAdjacentElement('afterend', p);
  }
  const error = submitted.value ? message(f) : '';
  p.textContent = error;
  f.setAttribute('aria-invalid', error ? 'true' : 'false');
  const described = (f.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  if (!described.includes(id)) f.setAttribute('aria-describedby', [...described, id].join(' '));
  return error;
}
function validate(event: SubmitEvent) {
  submitted.value = true;
  const fs = fields();
  for (const f of fs) {
    if (f.getAttribute('inputmode') === 'numeric' && f.getAttribute('pattern') === '[0-9]{6}') {
      f.value = digits(f.value);
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  summary.value = fs.map(paint).filter(Boolean);
  if (summary.value.length) {
    fs.find((f) => message(f))?.focus();
    return;
  }
  emit('submit', event);
}
function refresh() {
  fields().forEach(paint);
  if (submitted.value) summary.value = fields().map(message).filter(Boolean);
}
onMounted(refresh);
</script>
<template>
  <form ref="form" novalidate @submit.prevent="validate" @focusout="refresh" @input="refresh">
    <div v-if="summary.length" class="form-summary" role="alert" tabindex="-1">
      <strong>لطفاً موارد مشخص‌شده را اصلاح کنید.</strong
      ><span
        >{{ new Intl.NumberFormat('fa-IR').format(summary.length) }} مورد نیاز به بررسی دارد.</span
      >
    </div>
    <slot />
  </form>
</template>
