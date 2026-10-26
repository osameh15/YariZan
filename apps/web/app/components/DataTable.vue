<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Fixed-layout data table for the Admin panel and the customer account. Column widths are set once,
 * so long text is truncated (full value in the tooltip) and the action column never moves. The footer
 * shows the range, a page-size choice and previous/next controls.
 */
export interface Column {
  key: string;
  label: string;
  /** CSS width, for example '22%' or '160px'. */
  width?: string;
  /** Keep the cell on one line and show the full value on hover. */
  truncate?: boolean;
  align?: 'start' | 'center' | 'end';
}
const props = withDefaults(
  defineProps<{
    columns: Column[];
    rows: T[];
    caption: string;
    rowKey?: (row: T, index: number) => string;
    loading?: boolean;
    /** Total rows before paging; null when the server does not count. */
    total?: number | null;
    offset?: number;
    limit?: number;
    hasNext?: boolean;
    empty?: string;
    pageSizes?: number[];
  }>(),
  {
    rowKey: (row: T, index: number) => String(row.id ?? index),
    loading: false,
    total: null,
    offset: 0,
    limit: 20,
    hasNext: false,
    empty: 'موردی برای نمایش پیدا نشد.',
    pageSizes: () => [10, 20, 50, 100, 200],
  },
);
const emit = defineEmits<{ page: [offset: number]; limit: [limit: number] }>();
const fa = new Intl.NumberFormat('fa-IR');
const from = computed(() => (props.rows.length ? props.offset + 1 : 0));
const to = computed(() => props.offset + props.rows.length);
const pages = computed(() =>
  props.total === null ? null : Math.max(1, Math.ceil(props.total / props.limit)),
);
const page = computed(() => Math.floor(props.offset / props.limit) + 1);
const next = computed(() =>
  props.total === null ? props.hasNext : props.offset + props.limit < props.total,
);
const sizeOptions = computed(() =>
  props.pageSizes.map((n) => ({ value: String(n), label: fa.format(n) + ' ردیف' })),
);
const size = computed({
  get: () => String(props.limit),
  set: (value: string) => emit('limit', Number(value)),
});
function text(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}
</script>
<template>
  <div class="data-table-card" :aria-busy="loading">
    <div class="data-table-scroll" tabindex="0" :aria-label="caption">
      <table class="data-table">
        <caption class="sr-only">
          {{
            caption
          }}
        </caption>
        <colgroup>
          <col
            v-for="c in columns"
            :key="c.key"
            :style="c.width ? { width: c.width } : undefined"
          />
        </colgroup>
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" scope="col" :data-align="c.align ?? 'start'">
              {{ c.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="rowKey(row, index)">
            <td
              v-for="c in columns"
              :key="c.key"
              :data-label="c.label"
              :data-align="c.align ?? 'start'"
              :class="{ truncate: c.truncate }"
              :title="c.truncate ? text(row[c.key]) : undefined"
            >
              <slot :name="'cell-' + c.key" :row="row" :value="row[c.key]">{{
                text(row[c.key])
              }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="data-table-empty" role="status">
        {{ loading ? 'در حال دریافت اطلاعات…' : empty }}
      </p>
    </div>
    <footer class="data-table-footer">
      <p class="data-table-range" role="status">
        <template v-if="rows.length"
          >نمایش {{ fa.format(from) }} تا {{ fa.format(to) }}
          <template v-if="total !== null"> از {{ fa.format(total) }}</template></template
        ><template v-else>بدون ردیف</template>
      </p>
      <div class="data-table-size">
        <AppSelect v-model="size" label="تعداد در هر صفحه" :options="sizeOptions" />
      </div>
      <nav class="data-table-pager" aria-label="صفحه‌بندی">
        <button
          type="button"
          class="button secondary"
          :disabled="offset === 0 || loading"
          @click="emit('page', Math.max(0, offset - limit))"
        >
          صفحهٔ قبل
        </button>
        <span v-if="pages !== null" class="data-table-page"
          >صفحهٔ {{ fa.format(page) }} از {{ fa.format(pages) }}</span
        >
        <button
          type="button"
          class="button secondary"
          :disabled="!next || loading"
          @click="emit('page', offset + limit)"
        >
          صفحهٔ بعد
        </button>
      </nav>
    </footer>
  </div>
</template>
