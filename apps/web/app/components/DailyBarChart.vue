<script setup lang="ts">
// Single-series daily bar chart: one hue (validated #0a8a76), thin bars with 2px gaps and 4px
// rounded tops anchored to the baseline, recessive grid, hover/keyboard tooltip and a table view.
import { persianDigits } from '#shared/digits';
const props = defineProps<{
  title: string;
  /** Persian unit for the tooltip, e.g. «حساب». */
  unit: string;
  points: { day: string; value: number }[];
}>();
const H = 180,
  PAD_TOP = 12,
  PAD_BOTTOM = 26,
  PAD_START = 34;
// The drawing width follows the real container width, so axis text keeps its CSS size instead of
// shrinking with a scaled viewBox on narrow cards.
const plot = ref<HTMLElement | null>(null);
const W = ref(600);
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (!plot.value) return;
  const measure = () => (W.value = Math.max(240, Math.round(plot.value?.clientWidth ?? 600)));
  measure();
  observer = new ResizeObserver(measure);
  observer.observe(plot.value);
});
onBeforeUnmount(() => observer?.disconnect());
const active = ref<number | null>(null);
const max = computed(() => {
  const m = Math.max(1, ...props.points.map((p) => p.value));
  // A small "nice" ceiling so the top grid line is a round number.
  const step = m <= 4 ? 1 : m <= 10 ? 2 : m <= 50 ? 10 : 10 ** Math.floor(Math.log10(m));
  const top = Math.ceil(m / step) * step;
  // An even ceiling keeps the middle grid line on a whole number (counts are never fractional).
  return top > 1 && top % 2 ? top + step : top;
});
const plotH = H - PAD_TOP - PAD_BOTTOM;
const slot = computed(() => (W.value - PAD_START) / Math.max(1, props.points.length));
const barW = computed(() => Math.max(2, slot.value - 2));
// Time runs left to right even on an RTL page: the oldest day is at the left, today at the right.
const x = (i: number) => PAD_START + i * slot.value + 1;
const y = (v: number) => PAD_TOP + plotH - (v / max.value) * plotH;
function barPath(i: number, v: number) {
  if (v <= 0) return '';
  const left = x(i),
    w = barW.value,
    top = y(v),
    base = PAD_TOP + plotH,
    r = Math.min(4, w / 2, base - top);
  return `M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}H${left + w - r}Q${left + w},${top} ${left + w},${top + r}V${base}Z`;
}
const ticks = computed(() => (max.value > 1 ? [0, max.value / 2, max.value] : [0, max.value]));
const fmtDay = (d: string) =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(new Date(d + 'T12:00:00Z'));
const total = computed(() => props.points.reduce((n, p) => n + p.value, 0));
const n = (v: number) => persianDigits(String(Math.round(v)));
function onKey(e: KeyboardEvent) {
  const last = props.points.length - 1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    active.value = Math.min(last, Math.max(0, (active.value ?? last) + step));
  } else if (e.key === 'Escape') active.value = null;
}
const tip = computed(() => {
  if (active.value === null) return null;
  const p = props.points[active.value];
  if (!p) return null;
  return {
    left: ((x(active.value) + barW.value / 2) / W.value) * 100,
    text: `${fmtDay(p.day)}: ${n(p.value)} ${props.unit}`,
  };
});
</script>
<template>
  <figure class="daily-chart">
    <figcaption>
      <span class="daily-chart-title">{{ title }}</span>
      <span class="daily-chart-total">{{ n(total) }} {{ unit }} در ۳۰ روز گذشته</span>
    </figcaption>
    <div ref="plot" class="daily-chart-plot">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        :width="W"
        :height="H"
        role="img"
        :aria-label="`${title}: ${n(total)} ${unit} در ۳۰ روز گذشته. با کلیدهای جهت روزها را بخوانید.`"
        tabindex="0"
        dir="ltr"
        @keydown="onKey"
        @mouseleave="active = null"
        @blur="active = null"
      >
        <g class="daily-chart-grid">
          <template v-for="t in ticks" :key="t">
            <line :x1="PAD_START" :x2="W" :y1="y(t)" :y2="y(t)" />
            <text :x="PAD_START - 6" :y="y(t) + 4" text-anchor="end">{{ n(t) }}</text>
          </template>
        </g>
        <g class="daily-chart-bars">
          <path
            v-for="(p, i) in points"
            :key="p.day"
            :d="barPath(i, p.value)"
            :class="{ dim: active !== null && active !== i }"
          />
        </g>
        <g class="daily-chart-axis">
          <text
            v-for="(p, i) in points"
            v-show="i % 7 === points.length % 7 || i === points.length - 1"
            :key="'l' + p.day"
            :x="i === points.length - 1 ? W : x(i) + barW / 2"
            :y="H - 6"
            :text-anchor="i === points.length - 1 ? 'end' : 'middle'"
          >
            {{ fmtDay(p.day) }}
          </text>
        </g>
        <!-- Hit targets: the full column, wider than the bar. -->
        <rect
          v-for="(p, i) in points"
          :key="'h' + p.day"
          :x="PAD_START + i * slot"
          :y="0"
          :width="slot"
          :height="H"
          fill="transparent"
          @mouseenter="active = i"
        />
      </svg>
      <div v-if="tip" class="daily-chart-tip" :style="{ left: tip.left + '%' }" role="status">
        {{ tip.text }}
      </div>
    </div>
    <details class="daily-chart-table">
      <summary>نمایش جدول</summary>
      <table>
        <caption class="sr-only">
          {{
            title
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">روز</th>
            <th scope="col">{{ unit }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in [...points].reverse()" :key="'t' + p.day">
            <th scope="row">{{ fmtDay(p.day) }}</th>
            <td>{{ n(p.value) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
