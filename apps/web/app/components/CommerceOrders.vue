<script setup lang="ts">
import { errorMessage, toman, gradeNames } from '#shared/domain';
import { commerceState, commerceTone } from '#shared/commerce';
type Row = Record<string, unknown>;
const api = useApi(),
  rows = ref<Row[]>([]),
  offset = ref(0),
  limit = ref(10),
  total = ref<number | null>(null),
  next = ref<number | null>(null),
  busy = ref(false),
  message = ref(''),
  now = ref(Date.now());
const columns = [
  { key: 'title', label: 'محصول', width: '30%' },
  { key: 'amount', label: 'مبلغ', width: '17%' },
  { key: 'status', label: 'وضعیت', width: '25%' },
  { key: 'created_at', label: 'تاریخ ثبت', width: '15%' },
  { key: 'actions', label: '', width: '150px', align: 'end' as const },
];
async function load() {
  busy.value = true;
  message.value = '';
  try {
    const r = await api.get('/api/v2/account/orders', undefined, {
      offset: offset.value,
      limit: limit.value,
    });
    rows.value = r.items;
    total.value = typeof r.total === 'number' ? r.total : null;
    next.value = r.next_offset;
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
const grade = (sku: unknown) =>
  'یاریزان پایهٔ ' + (gradeNames[Number(String(sku ?? '').slice(-1)) - 1] ?? '');
/** Minutes:seconds left to pay an open invoice, or null when the window has passed. */
function left(row: Row) {
  if (row.state !== 'PENDING' || !row.expires_at) return null;
  const ms = new Date(String(row.expires_at)).getTime() - now.value;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return (
    new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(Math.floor(s / 60)) +
    ':' +
    new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(s % 60)
  );
}
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  load();
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
<template>
  <div class="orders-table">
    <header class="section-heading-row">
      <div>
        <h2>سفارش‌های من</h2>
        <p class="muted">
          هر فاکتور تا ۱۵ دقیقه پس از صدور قابل پرداخت است. اگر پرداخت لغو یا ناموفق شود، فاکتور
          بسته می‌شود و می‌توانید فاکتور تازه صادر کنید.
        </p>
      </div>
      <NuxtLink class="button primary" to="/products">خرید پایهٔ تازه</NuxtLink>
    </header>
    <ApiNotice :message="message" />
    <DataTable
      :columns="columns"
      :rows="rows"
      caption="سفارش‌های من"
      :loading="busy"
      :total="total"
      :offset="offset"
      :limit="limit"
      :has-next="next !== null"
      :page-sizes="[10, 20, 50]"
      empty="هنوز سفارشی ثبت نکرده‌اید."
      @page="
        (to) => {
          offset = to;
          load();
        }
      "
      @limit="
        (n) => {
          limit = n;
          offset = 0;
          load();
        }
      "
    >
      <template #cell-title="{ row }"
        ><b>{{ row.title_fa ?? grade(row.sku) }}</b
        ><small dir="ltr">{{ String(row.id).slice(0, 8) }}</small></template
      >
      <template #cell-amount="{ row }">{{ toman(Number(row.total_irr)) }} تومان</template>
      <template #cell-status="{ row }"
        ><span
          class="pill"
          :data-tone="
            commerceTone({
              state: String(row.state),
              paid_at: row.paid_at,
              exception_code: row.exception_code,
            })
          "
          >{{
            commerceState({
              state: String(row.state),
              paid_at: row.paid_at,
              exception_code: row.exception_code,
              closed_reason: row.closed_reason,
            })
          }}</span
        ><small v-if="left(row)"
          >مهلت پرداخت: <span class="countdown">{{ left(row) }}</span></small
        ></template
      >
      <template #cell-created_at="{ row }">{{
        new Date(String(row.created_at)).toLocaleDateString('fa-IR')
      }}</template>
      <template #cell-actions="{ row }"
        ><div class="row-actions">
          <NuxtLink
            class="button"
            :class="left(row) ? 'primary' : 'secondary'"
            :to="'/account/orders/' + row.id"
            >{{ left(row) ? 'پرداخت' : 'جزئیات' }}</NuxtLink
          >
        </div></template
      >
    </DataTable>
  </div>
</template>
