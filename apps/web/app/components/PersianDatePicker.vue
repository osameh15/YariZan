<script setup lang="ts">
import { ref, computed, watch, nextTick, useId, onMounted, onBeforeUnmount } from 'vue';
import { useControlPopup } from '../composables/useControlPopup';
import { persianParts, persianDate, persianMonthDays, persianMonths } from '#shared/persian-date';
const model = defineModel<string>({ required: true });
const props = defineProps<{ label: string; required?: boolean; time?: boolean }>();
const id = useId(),
  open = ref(false),
  year = ref(1405),
  month = ref(1),
  activeDay = ref(1),
  hour = ref(0),
  minute = ref(0),
  root = ref<HTMLElement>(),
  trigger = ref<HTMLButtonElement>(),
  proxy = ref<HTMLInputElement>(),
  panel = ref<HTMLElement>();
const { popupStyle, placePopup } = useControlPopup(trigger, panel, open, true);
const number = (n: number) => new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(n);
const selected = computed(() =>
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(model.value)
    ? new Date(model.value.slice(0, 10) + 'T12:00:00Z')
    : undefined,
);
const display = computed(() =>
  selected.value && !Number.isNaN(selected.value.getTime())
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long', timeZone: 'UTC' }).format(
        selected.value,
      ) +
      (props.time
        ? '، ' + (model.value.split('T')[1] ?? '۰۰:۰۰').replace(/[0-9]/g, (d) => number(Number(d)))
        : '')
    : 'انتخاب تاریخ',
);
const days = computed(() => persianMonthDays(year.value, month.value));
const offset = computed(
  () => (new Date(persianDate(year.value, month.value, 1) + 'T12:00:00Z').getUTCDay() + 1) % 7,
);
function show() {
  const date = selected.value ?? new Date(),
    p = persianParts(date);
  year.value = p.year;
  month.value = p.month;
  activeDay.value = p.day;
  hour.value = Number(model.value.split('T')[1]?.slice(0, 2) ?? 0);
  minute.value = Number(model.value.split('T')[1]?.slice(3, 5) ?? 0);
  open.value = !open.value;
  if (open.value)
    void placePopup().then(() => {
      if (open.value)
        root.value?.querySelector<HTMLButtonElement>('[aria-current="date"]')?.focus();
    });
}
function changeMonth(delta: number) {
  activeDay.value = 1;
  month.value += delta;
  if (month.value === 0) {
    month.value = 12;
    year.value--;
  }
  if (month.value === 13) {
    month.value = 1;
    year.value++;
  }
}
function choose(day: number) {
  const date = persianDate(year.value, month.value, day);
  model.value =
    date +
    (props.time
      ? 'T' + String(hour.value).padStart(2, '0') + ':' + String(minute.value).padStart(2, '0')
      : '');
  open.value = false;
  trigger.value?.focus();
}
function updateTime() {
  if (selected.value)
    model.value =
      model.value.slice(0, 10) +
      'T' +
      String(hour.value).padStart(2, '0') +
      ':' +
      String(minute.value).padStart(2, '0');
}
function dayKey(event: KeyboardEvent, day: number) {
  const delta = (
    { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>
  )[event.key];
  if (delta !== undefined) {
    event.preventDefault();
    const target = Math.min(days.value, Math.max(1, day + delta));
    root.value?.querySelector<HTMLButtonElement>('[data-day="' + target + '"]')?.focus();
  }
}
function revealFocus(event: FocusEvent) {
  const target = event.target as HTMLElement;
  nextTick(() =>
    requestAnimationFrame(() => {
      if (!panel.value?.contains(target)) return;
      const field = target.getBoundingClientRect(),
        box = panel.value.getBoundingClientRect();
      if (field.bottom > box.bottom - 12) panel.value.scrollTop += field.bottom - box.bottom + 12;
      else if (field.top < box.top + 12) panel.value.scrollTop -= box.top + 12 - field.top;
    }),
  );
}
function calendarEnter(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement) event.preventDefault();
}
function escape(event: KeyboardEvent) {
  if (open.value) {
    event.preventDefault();
    event.stopPropagation();
    open.value = false;
    trigger.value?.focus();
  }
}
function outside(event: Event) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
watch([year, month], () => {
  void placePopup();
  activeDay.value = Math.min(activeDay.value, days.value);
});
watch(model, async () => {
  await nextTick();
  proxy.value?.dispatchEvent(new Event('input', { bubbles: true }));
});
</script>
<template>
  <div ref="root" class="custom-field date-field" @keydown.esc="escape">
    <label :id="id + '-label'" :for="id">{{ label }}</label>
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="date-trigger"
      :aria-labelledby="id + '-label'"
      :aria-expanded="open"
      :aria-controls="id + '-calendar'"
      @click="show"
    >
      <span>{{ display }}</span
      ><span aria-hidden="true">▦</span>
    </button>
    <input
      ref="proxy"
      class="validation-proxy"
      tabindex="-1"
      aria-hidden="true"
      :value="selected ? model : ''"
      :required="required"
      :data-focus-target="id"
      :data-label="label"
      readonly
    />
    <section
      v-if="open"
      :id="id + '-calendar'"
      ref="panel"
      :style="popupStyle"
      class="persian-calendar"
      @keydown.enter="calendarEnter"
      @focusin="revealFocus"
      :aria-label="'تقویم شمسی ' + label"
    >
      <div class="calendar-navigation">
        <button
          type="button"
          class="calendar-month-button"
          aria-label="ماه قبل"
          :disabled="year === 1 && month === 1"
          @click="changeMonth(-1)"
        >
          →</button
        ><strong aria-live="polite">{{ persianMonths[month - 1] }} {{ number(year) }}</strong
        ><button
          type="button"
          class="calendar-month-button"
          aria-label="ماه بعد"
          :disabled="year === 2999 && month === 12"
          @click="changeMonth(1)"
        >
          ←
        </button>
      </div>
      <NumberStepper v-model="year" label="سال شمسی" :min="1" :max="2999" />
      <div class="calendar-week" aria-hidden="true">
        <span v-for="name in ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']" :key="name">{{ name }}</span>
      </div>
      <div class="calendar-days">
        <span v-for="blank in offset" :key="'blank-' + blank"></span
        ><button
          v-for="day in days"
          :key="day"
          type="button"
          :data-day="day"
          :tabindex="activeDay === day ? 0 : -1"
          @focus="activeDay = day"
          :aria-label="number(day) + ' ' + persianMonths[month - 1] + ' ' + number(year)"
          :aria-current="
            selected && model.slice(0, 10) === persianDate(year, month, day) ? 'date' : undefined
          "
          @click="choose(day)"
          @keydown="dayKey($event, day)"
        >
          {{ number(day) }}
        </button>
      </div>
      <div v-if="time" class="calendar-time">
        <NumberStepper
          v-model="hour"
          label="ساعت"
          :max="23"
          @update:model-value="updateTime"
        /><NumberStepper
          v-model="minute"
          label="دقیقه"
          :max="59"
          @update:model-value="updateTime"
        />
      </div>
      <div class="calendar-actions">
        <button
          type="button"
          class="text-link"
          @click="
            const p = persianParts(new Date());
            year = p.year;
            month = p.month;
            choose(p.day);
          "
        >
          امروز</button
        ><button
          v-if="!required"
          type="button"
          class="text-link"
          @click="
            model = '';
            open = false;
            trigger?.focus();
          "
        >
          پاک کردن تاریخ</button
        ><button
          type="button"
          class="text-link"
          @click="
            open = false;
            trigger?.focus();
          "
        >
          بستن تقویم
        </button>
      </div>
    </section>
  </div>
</template>
