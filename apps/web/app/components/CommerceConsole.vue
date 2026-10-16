<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { errorMessage } from '#shared/domain';
import { financialToman, commerceState } from '#shared/commerce';
import type { paths } from '#shared/api.generated';
type CommerceSection =
  paths['/api/v2/admin/commerce/{section}']['get']['parameters']['path']['section'];
const api = useApi(true),
  route = useRoute(),
  rows = ref<Record<string, unknown>[]>([]),
  report = ref<Record<string, unknown>>({}),
  permissions = ref<string[]>([]),
  busy = ref(false),
  message = ref(''),
  success = ref(false),
  search = ref(''),
  state = ref(''),
  from = ref(''),
  to = ref(''),
  offset = ref(0),
  next = ref<number | null>(null);
const sections = [
  ['orders', 'سفارش‌ها'],
  ['payments', 'پرداخت‌ها'],
  ['campaigns', 'طرح‌های تخفیف'],
  ['coupons', 'کدهای تخفیف'],
  ['reservations', 'سهمیه‌های رزروشده'],
  ['redemptions', 'تخفیف‌های استفاده‌شده'],
  ['jobs', 'بررسی و آماده‌سازی'],
  ['exceptions', 'موارد نیازمند بررسی'],
  ['finance', 'گزارش مالی'],
  ['refunds', 'درخواست‌های بازپرداخت'],
] as const satisfies ReadonlyArray<readonly [CommerceSection, string]>;
const section = computed(() => String(route.query.section ?? 'orders'));
const supportedSection = computed(() => sections.some((s) => s[0] === section.value));
const title = computed(
  () => sections.find((s) => s[0] === section.value)?.[1] ?? 'بخش مدیریت پیدا نشد',
);
const allowed = (p: string) => permissions.value.includes(p);
async function load() {
  busy.value = true;
  message.value = '';
  rows.value = [];
  report.value = {};
  next.value = null;
  try {
    const session = await api.get('/api/v2/admin/auth/session');
    permissions.value = session.permissions;
    if (!supportedSection.value) {
      message.value = 'این بخش مدیریت وجود ندارد. یکی از بخش‌های فهرست فروش را انتخاب کنید.';
      return;
    }
    const r = await api.get(
      '/api/v2/admin/commerce/{section}',
      { section: section.value },
      {
        search: search.value,
        offset: offset.value,
        ...(state.value ? { state: state.value } : {}),
        ...(from.value ? { from: new Date(from.value + 'T00:00:00').toISOString() } : {}),
        ...(to.value ? { to: new Date(to.value + 'T00:00:00').toISOString() } : {}),
      },
    );
    if (section.value === 'finance') report.value = r;
    else {
      rows.value = r.items as Record<string, unknown>[];
      next.value = r.next_offset as number | null;
    }
  } catch (e) {
    message.value = errorMessage(e);
    if ((e as { status?: number }).status === 401) await navigateTo('/zanyari/login');
  } finally {
    busy.value = false;
  }
}
watch(section, () => {
  offset.value = 0;
  search.value = '';
  state.value = '';
  load();
});
onMounted(load);
const dialog = ref(false),
  kind = ref(''),
  selected = ref<Record<string, unknown>>({}),
  reason = ref(''),
  note = ref(''),
  requestId = ref(''),
  saving = ref(false),
  refundState = ref<'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'>('UNDER_REVIEW');
const form = reactive({
  name: '',
  starts_at: '',
  ends_at: '',
  enabled: true,
  max_redemptions: 100,
  max_per_customer: 1,
  campaign_id: '',
  code: '',
  type: 'percent' as 'percent' | 'fixed',
  value: 10,
  max_discount_irr: 0,
  min_order_irr: 0,
  skus: ['YARIZAN-G1'] as string[],
});
const campaigns = ref<Record<string, unknown>[]>([]),
  detail = ref<Record<string, unknown>>({});
function localDate(d: unknown) {
  const x = new Date(String(d));
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
async function open(action: string, row: Record<string, unknown> = {}) {
  try {
    selected.value = row;
    kind.value = action;
    reason.value = '';
    refundState.value = 'UNDER_REVIEW';
    message.value = '';
    note.value = String(row.note ?? '');
    requestId.value = crypto.randomUUID();
    if (action === 'campaigns')
      Object.assign(form, {
        name: String(row.name ?? ''),
        starts_at: localDate(row.starts_at ?? new Date()),
        ends_at: localDate(row.ends_at ?? new Date(Date.now() + 86400000)),
        enabled: row.enabled ?? true,
        max_redemptions: Number(row.max_redemptions ?? 100),
        max_per_customer: Number(row.max_per_customer ?? 1),
      });
    if (action === 'coupons') {
      const c = await api.get('/api/v2/admin/commerce/{section}', { section: 'campaigns' });
      campaigns.value = c.items as Record<string, unknown>[];
      Object.assign(form, {
        campaign_id: String(row.campaign_id ?? campaigns.value[0]?.id ?? ''),
        code: String(row.code ?? ''),
        type: row.type ?? 'percent',
        value: Number(row.value ?? 10),
        max_discount_irr: Number(row.max_discount_irr ?? 0),
        min_order_irr: Number(row.min_order_irr ?? 0),
        enabled: row.enabled ?? true,
        max_redemptions: Number(row.max_redemptions ?? 100),
        max_per_customer: Number(row.max_per_customer ?? 1),
        skus: (row.skus ?? ['YARIZAN-G1']) as string[],
      });
    }
    if (action === 'detail' || action === 'reconcile') {
      detail.value = await api.get('/api/v2/admin/commerce/orders/{id}', {
        id: String(row.order_id ?? row.id),
      });
      if (action === 'reconcile') selected.value = detail.value;
    }
    dialog.value = true;
  } catch (e) {
    message.value = errorMessage(e);
    success.value = false;
  }
}
async function save() {
  saving.value = true;
  message.value = '';
  try {
    const id = String(selected.value.id ?? ''),
      base = {
        request_id: requestId.value,
        reason: reason.value,
        expected_revision: Number(selected.value.revision ?? 1),
      };
    if (kind.value === 'note') {
      await api.post(
        '/api/v2/admin/notes/{type}/{id}',
        { note: note.value, expected_revision: Number(selected.value.note_revision ?? 0) },
        { type: section.value, id },
      );
    } else if (kind.value === 'reconcile') {
      await api.post('/api/v2/admin/commerce/orders/{id}/reconcile', base, { id });
    } else if (kind.value === 'refund') {
      await api.post(
        '/api/v2/admin/commerce/refunds/{id}/review',
        { ...base, state: refundState.value },
        { id },
      );
    } else if (kind.value === 'campaigns') {
      const body = {
        ...base,
        name: form.name,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        enabled: form.enabled,
        max_redemptions: form.max_redemptions || null,
        max_per_customer: form.max_per_customer || null,
      };
      if (id) await api.patch('/api/v2/admin/commerce/campaigns/{id}', body, { id });
      else await api.post('/api/v2/admin/commerce/campaigns', body);
    } else {
      const body = {
        ...base,
        campaign_id: form.campaign_id,
        code: form.code,
        type: form.type,
        value: form.value,
        max_discount_irr: form.max_discount_irr || null,
        min_order_irr: form.min_order_irr || null,
        enabled: form.enabled,
        max_redemptions: form.max_redemptions || null,
        max_per_customer: form.max_per_customer || null,
        skus: form.skus,
      };
      if (id) await api.patch('/api/v2/admin/commerce/coupons/{id}', body, { id });
      else await api.post('/api/v2/admin/commerce/coupons', body);
    }
    dialog.value = false;
    await load();
    message.value = 'تغییرات ثبت شد.';
    success.value = true;
  } catch (e) {
    message.value = errorMessage(e);
    success.value = false;
  } finally {
    saving.value = false;
  }
}
const stateLabel = (row: Record<string, unknown>) =>
  (
    ({
      VERIFIED: 'تأییدشده',
      CREATED: 'درخواست ثبت‌شده',
      UNKNOWN: 'نتیجه نامشخص',
      PENDING: 'در انتظار',
      FAILED: 'ناموفق',
      CANCELLED: 'لغوشده',
      REVIEW: 'نیازمند بررسی',
      RUNNING: 'در حال بررسی',
      DONE: 'انجام‌شده',
      RESERVED: 'رزروشده',
      REDEEMED: 'استفاده‌شده',
      RELEASED: 'آزادشده',
      REQUESTED: 'درخواست ثبت‌شده',
      UNDER_REVIEW: 'در حال بررسی',
      APPROVED: 'درخواست تأییدشده؛ وجه برنگشته',
      REJECTED: 'درخواست ردشده',
    }) as Record<string, string>
  )[String(row.state)] ??
  commerceState({
    state: String(row.state),
    paid_at: row.paid_at,
    exception_code: row.exception_code,
  });
const navigationGroups: { title: string; ids: string[] }[] = [
  { title: 'سفارش و پرداخت', ids: ['orders', 'payments'] },
  { title: 'تخفیف‌ها', ids: ['campaigns', 'coupons', 'reservations', 'redemptions'] },
  { title: 'پیگیری مالی', ids: ['jobs', 'exceptions', 'finance', 'refunds'] },
];
</script>
<template>
  <section class="wrap section portal commerce-workspace">
    <aside class="portal-sidebar">
      <h2>فروش و امور مالی</h2>
      <NuxtLink class="text-link" to="/zanyari">بازگشت به مدیریت</NuxtLink>
      <nav aria-label="مدیریت فروش">
        <template v-for="group in navigationGroups" :key="group.title">
          <span
            v-if="
              sections.some(
                (s) =>
                  group.ids.includes(s[0]) &&
                  allowed(s[0] === 'finance' ? 'finance.read' : 'commerce.read'),
              )
            "
            class="nav-group-label"
            >{{ group.title }}</span
          >
          <NuxtLink
            v-for="s in sections.filter(
              (s) =>
                group.ids.includes(s[0]) &&
                allowed(s[0] === 'finance' ? 'finance.read' : 'commerce.read'),
            )"
            :key="s[0]"
            :to="{ path: '/zanyari/commerce', query: { section: s[0] } }"
            :aria-current="section === s[0] ? 'page' : undefined"
            >{{ s[1] }}</NuxtLink
          >
        </template>
      </nav>
    </aside>
    <div class="portal-main" :aria-busy="busy">
      <p class="eyebrow">فقط داده‌های آزمایشی</p>
      <h1>{{ title }}</h1>
      <ApiNotice
        kind="info"
        message="هیچ پرداخت یا بازپرداخت واقعی اجرا نمی‌شود. ثبت درخواست یا تأیید مدیر به معنی بازگشت وجه نیست."
      /><ApiNotice :message="message" :kind="success ? 'success' : 'error'" />
      <template v-if="supportedSection">
        <FormShell
          class="data-toolbar"
          @submit="
            offset = 0;
            load();
          "
          ><label
            >جست‌وجو<input
              v-model="search"
              maxlength="120"
              placeholder="شناسه، نام کاربری، پایه یا یادداشت" /></label
          ><PersianDatePicker v-model="from" label="از تاریخ" /><PersianDatePicker
            v-model="to"
            label="تا تاریخ (بدون این روز)"
          /><AppSelect
            v-if="['orders', 'payments', 'jobs'].includes(section)"
            v-model="state"
            label="وضعیت"
            :options="[
              { value: '', label: 'همه' },
              { value: 'PENDING', label: 'در انتظار' },
              { value: 'UNKNOWN', label: 'نامشخص' },
              { value: 'VERIFIED', label: 'تأییدشده' },
              { value: 'FULFILLED', label: 'مجوز آماده' },
              { value: 'FULFILLMENT_PENDING', label: 'در انتظار مجوز' },
              { value: 'REVIEW', label: 'نیازمند بررسی' },
              { value: 'FAILED', label: 'ناموفق' },
            ]"
          /><button class="button secondary" :disabled="busy">
            جست‌وجو و تازه‌سازی
          </button></FormShell
        >
        <button
          v-if="['campaigns', 'coupons'].includes(section) && allowed('commerce.manage')"
          class="button primary"
          @click="open(section)"
        >
          {{ section === 'campaigns' ? 'ساخت طرح تخفیف' : 'ساخت کد تخفیف' }}
        </button>
        <p v-if="section === 'finance'">
          سفارش‌ها بر اساس تاریخ ثبت گزارش می‌شوند؛ دریافت‌های تأییدشده بر اساس زمان تأیید درگاه و
          با احتساب دریافت تکراری هستند. این گزارش جایگزین تسویهٔ بانکی نیست.
        </p>
        <div
          v-if="section === 'finance' && !busy && report.currency === 'IRR'"
          class="stat-grid finance-metrics"
        >
          <article
            v-for="[key, label] in [
              ['gross_irr', 'مبلغ اولیهٔ سفارش‌های پرداخت‌شده'],
              ['discount_irr', 'تخفیف ثبت‌شده'],
              ['net_irr', 'خالص سفارش‌های پرداخت‌شده'],
              ['verified_captures_irr', 'دریافت‌های تأییدشده، شامل موارد تکراری'],
            ]"
            :key="key"
            class="panel"
            :class="{
              'metric-primary': key === 'net_irr',
              'metric-captures': key === 'verified_captures_irr',
            }"
          >
            <h2>
              {{ key.endsWith('_irr') ? financialToman(report[key]) : (report[key] ?? '۰') }}
              {{ key.endsWith('_irr') ? 'تومان' : '' }}
            </h2>
            <p>{{ label }}</p>
          </article>
        </div>
        <dl
          v-if="section === 'finance' && !busy && report.currency === 'IRR'"
          class="finance-counts"
        >
          <div
            v-for="[key, label] in [
              ['paid_orders', 'سفارش پرداخت‌شده'],
              ['redemptions', 'تخفیف استفاده‌شده'],
              ['paid_unfulfilled', 'در انتظار مجوز'],
              ['exceptions', 'نیازمند بررسی'],
              ['refund_requests', 'درخواست بازپرداخت'],
            ]"
            :key="key"
          >
            <dt>{{ label }}</dt>
            <dd>{{ new Intl.NumberFormat('fa-IR').format(Number(report[key] ?? 0)) }}</dd>
          </div>
        </dl>
        <p v-if="busy" class="notice" role="status">در حال دریافت اطلاعات…</p>
        <template v-if="section === 'finance'"
          ><div v-if="report.currency === 'IRR'" class="panel">
            <h2>وضعیت تلاش‌های پرداخت</h2>
            <p
              v-if="!busy && !(report.payment_states as unknown[] | undefined)?.length"
              class="muted"
            >
              در این بازه تلاش پرداختی ثبت نشده است.
            </p>
            <ul class="record-list">
              <li v-for="(r, i) in report.payment_states as Record<string, unknown>[]" :key="i">
                {{ stateLabel(r) }}: {{ persianDigits(r.count) }} ·
                {{ financialToman(r.amount_irr) }} تومان
              </li>
            </ul>
          </div></template
        >
        <div v-else class="table-scroll">
          <table>
            <caption>
              {{
                title
              }}
            </caption>
            <thead>
              <tr>
                <th>شناسه / عنوان</th>
                <th>اطلاعات</th>
                <th>وضعیت</th>
                <th>یادداشت داخلی</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="String(row.id)">
                <td>
                  <b>{{ row.name ?? row.code ?? row.username ?? row.sku ?? 'رکورد' }}</b
                  ><small class="record-id" dir="ltr">{{ persianDigits(row.id) }}</small>
                </td>
                <td>
                  <p v-if="row.total_irr ?? row.amount_irr">
                    {{ financialToman(row.total_irr ?? row.amount_irr) }} تومان
                  </p>
                  <p v-if="row.type">
                    {{ row.type === 'percent' ? 'درصدی' : 'مبلغ ثابت' }}:
                    {{ persianDigits(row.value) }}
                  </p>
                  <p v-if="row.max_redemptions">
                    سقف کل: {{ persianDigits(row.max_redemptions) }} · سقف مشتری:
                    {{ persianDigits(row.max_per_customer ?? 'بدون سقف') }}
                  </p>
                  <p v-if="row.held !== undefined">
                    رزروشده: {{ persianDigits(row.held) }} · استفاده‌شده:
                    {{ persianDigits(row.redeemed) }} · باقی‌مانده:
                    {{
                      row.max_redemptions
                        ? persianDigits(
                            Math.max(
                              0,
                              Number(row.max_redemptions) - Number(row.held) - Number(row.redeemed),
                            ),
                          )
                        : 'بدون سقف کل'
                    }}
                  </p>
                  <small v-if="row.provider_ref" dir="ltr">{{
                    persianDigits(row.provider_ref)
                  }}</small
                  ><small v-if="row.starts_at"
                    >{{ new Date(String(row.starts_at)).toLocaleDateString('fa-IR') }} تا
                    {{ new Date(String(row.ends_at)).toLocaleDateString('fa-IR') }}</small
                  >
                  <p v-if="row.exception_code">این مورد نیاز به بررسی مالی دارد.</p>
                </td>
                <td>
                  <span class="status-chip" :data-state="row.state">
                    {{
                      row.enabled === undefined ? stateLabel(row) : row.enabled ? 'فعال' : 'غیرفعال'
                    }}</span
                  >
                </td>
                <td class="note-preview">{{ row.note ?? '—' }}</td>
                <td>
                  <div class="table-actions">
                    <button
                      v-if="
                        ['campaigns', 'coupons'].includes(section) && allowed('commerce.manage')
                      "
                      class="button secondary"
                      @click="open(section, row)"
                    >
                      ویرایش</button
                    ><button
                      v-if="['orders', 'payments'].includes(section)"
                      class="button secondary"
                      @click="open('detail', row)"
                    >
                      جزئیات سفارش</button
                    ><button
                      v-if="
                        ['orders', 'payments', 'exceptions', 'jobs'].includes(section) &&
                        allowed('finance.reconcile')
                      "
                      class="button secondary"
                      @click="open('reconcile', row)"
                    >
                      بررسی دوبارهٔ سفارش</button
                    ><button
                      v-if="
                        ['orders', 'payments', 'campaigns', 'coupons'].includes(section) &&
                        allowed('notes.manage')
                      "
                      class="button secondary"
                      @click="open('note', row)"
                    >
                      یادداشت داخلی</button
                    ><button
                      v-if="section === 'refunds' && allowed('refunds.review')"
                      class="button secondary"
                      @click="open('refund', row)"
                    >
                      شروع بررسی درخواست
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!busy && !rows.length">رکوردی با این شرایط پیدا نشد.</p>
        </div>
        <div v-if="section !== 'finance'" class="actions">
          <button
            v-if="offset"
            class="button secondary"
            @click="
              offset = Math.max(0, offset - 20);
              load();
            "
          >
            صفحهٔ قبل</button
          ><button
            v-if="next !== null"
            class="button secondary"
            @click="
              offset = next!;
              load();
            "
          >
            صفحهٔ بعد
          </button>
        </div>
      </template>
      <NuxtLink v-else class="button secondary" to="/zanyari/commerce">بازگشت به سفارش‌ها</NuxtLink>
    </div>
    <BaseDialog
      class="commerce-dialog"
      :class="{ 'commerce-dialog-editor': kind !== 'detail' }"
      v-model="dialog"
      :title="
        kind === 'detail'
          ? 'جزئیات سفارش'
          : kind === 'note'
            ? 'یادداشت داخلی'
            : kind === 'reconcile'
              ? 'بررسی دوبارهٔ سفارش'
              : kind === 'campaigns'
                ? 'تنظیم طرح تخفیف'
                : kind === 'refund'
                  ? 'بررسی درخواست بازپرداخت'
                  : 'تنظیم کد تخفیف'
      "
    >
      <template v-if="kind === 'detail'"
        ><p>
          وضعیت:
          {{
            commerceState({
              state: String(detail.state),
              paid_at: detail.paid_at,
              exception_code: detail.exception_code,
            })
          }}
        </p>
        <p dir="ltr">{{ persianDigits(detail.id) }}</p>
        <p>مبلغ: {{ financialToman(detail.total_irr) }} تومان</p>
        <p>تخفیف: {{ financialToman(detail.discount_irr) }} تومان</p>
        <ul class="record-list">
          <li v-for="(t, i) in detail.transitions as Record<string, unknown>[]" :key="i">
            {{ stateLabel({ state: t.next_state }) }} ·
            {{ new Date(String(t.created_at)).toLocaleString('fa-IR') }}
          </li>
        </ul>
        <p>سوابق بررسی و آماده‌سازی</p>
        <ul class="record-list">
          <li v-for="(r, i) in detail.reconciliation as Record<string, unknown>[]" :key="i">
            {{
              r.event === 'DONE'
                ? 'تکمیل شد'
                : r.event === 'STARTED'
                  ? 'شروع بررسی'
                  : r.event === 'REVIEW'
                    ? 'نیازمند بررسی پشتیبانی'
                    : 'بررسی دوباره زمان‌بندی شد'
            }}
            · {{ new Date(String(r.created_at)).toLocaleString('fa-IR') }}
          </li>
        </ul></template
      >
      <FormShell v-else class="commerce-editor" @submit="save"
        ><div class="commerce-editor-fields">
          <div v-if="['campaigns', 'coupons'].includes(kind)" class="editor-section-heading">
            <h3>مشخصات {{ kind === 'campaigns' ? 'طرح' : 'کد' }} تخفیف</h3>
            <p>مبلغ‌ها به ریال هستند؛ تغییرات، قیمت سفارش‌های قبلی را عوض نمی‌کند.</p>
          </div>
          <template v-if="kind === 'note'"
            ><label>یادداشت داخلی<textarea v-model="note" maxlength="2000" /></label></template
          ><template v-else
            ><template v-if="kind === 'campaigns'"
              ><label class="editor-wide"
                >نام طرح<input v-model="form.name" required minlength="2" maxlength="120" /></label
              ><PersianDatePicker
                v-model="form.starts_at"
                label="شروع (زمان محلی)"
                time
                required /><PersianDatePicker
                v-model="form.ends_at"
                label="پایان (زمان محلی)"
                time
                required /></template
            ><template v-if="kind === 'coupons'"
              ><AppSelect
                v-model="form.campaign_id"
                label="طرح تخفیف"
                :options="campaigns.map((c) => ({ value: String(c.id), label: String(c.name) }))"
                required
                :disabled="!!selected.id"
              /><label
                >کد تخفیف<input
                  v-model="form.code"
                  required
                  dir="ltr"
                  pattern="[A-Za-z0-9_-]+"
                  maxlength="64" /></label
              ><AppSelect
                v-model="form.type"
                label="نوع تخفیف"
                :options="[
                  { value: 'percent', label: 'درصدی' },
                  { value: 'fixed', label: 'مبلغ ثابت به ریال' },
                ]"
              /><NumberStepper
                v-model="form.value"
                min="1"
                :max="form.type === 'percent' ? 100 : 9007199254740991"
                required
                :label="form.type === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف به ریال'"
              /><NumberStepper
                v-model="form.max_discount_irr"
                min="0"
                label="حداکثر تخفیف درصدی (ریال؛ صفر بدون سقف)"
              /><NumberStepper v-model="form.min_order_irr" min="0" label="حداقل خرید (ریال)" />
              <fieldset>
                <legend>پایه‌های مجاز</legend>
                <label v-for="grade in 6" :key="grade" class="checkbox"
                  ><input v-model="form.skus" type="checkbox" :value="'YARIZAN-G' + grade" />پایهٔ
                  {{ persianDigits(grade) }}</label
                >
              </fieldset></template
            ><template v-if="['campaigns', 'coupons'].includes(kind)"
              ><div class="editor-section-heading">
                <h3>سهمیه و دسترسی</h3>
                <p>صفر یعنی بدون سقف. سهمیه فقط پس از تأیید پرداخت مصرف می‌شود.</p>
              </div>
              <NumberStepper
                v-model="form.max_redemptions"
                min="0"
                label="سقف کل استفاده (صفر بدون سقف)"
              /><NumberStepper
                v-model="form.max_per_customer"
                min="0"
                label="سقف هر مشتری (صفر بدون سقف)"
              /><label class="checkbox"
                ><input v-model="form.enabled" type="checkbox" />فعال باشد</label
              ></template
            >
            <p v-if="kind === 'reconcile'">
              فقط بررسی و آماده‌سازی دوباره زمان‌بندی می‌شود؛ پرداخت تازه‌ای ساخته نمی‌شود و محدودیت
              دستگاه یا نسل حساب دور زده نخواهد شد.
            </p>
            <AppSelect
              v-if="kind === 'refund'"
              v-model="refundState"
              label="نتیجهٔ بررسی"
              :options="[
                { value: 'UNDER_REVIEW', label: 'در حال بررسی' },
                { value: 'APPROVED', label: 'درخواست پذیرفته شد؛ وجه هنوز بازنگشته است' },
                { value: 'REJECTED', label: 'درخواست رد شد' },
              ]" />
            <p v-if="kind === 'refund'">
              این عملیات فقط نتیجهٔ بررسی پرونده را ثبت می‌کند. هیچ وجهی بازگردانده نمی‌شود و مجوز
              خرید تغییر نمی‌کند.
            </p>
            <label
              >دلیل تغییر<textarea
                v-model="reason"
                required
                minlength="10"
                maxlength="1000"
              /></label
          ></template>
        </div>
        <footer class="dialog-action-footer" aria-label="عملیات فرم">
          <ApiNotice :message="message" />
          <div class="actions">
            <button class="button primary" :disabled="saving">
              {{ kind === 'note' ? 'ذخیرهٔ یادداشت' : 'ثبت تغییرات' }}</button
            ><button
              type="button"
              class="button secondary"
              :disabled="saving"
              @click="dialog = false"
            >
              انصراف
            </button>
          </div>
        </footer></FormShell
      >
    </BaseDialog>
  </section>
</template>
