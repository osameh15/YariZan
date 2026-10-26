<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { errorMessage, toman, gradeNames } from '#shared/domain';
import type { ApiPath } from '#shared/api';
type Row = Record<string, unknown>;
let alive = true;
const noticeSuccess = ref(false);
const promoOpen = ref(false),
  promoRow = ref<Record<string, unknown>>({});
function openPromotions(row: Record<string, unknown>) {
  promoRow.value = row;
  promoOpen.value = true;
}
const promotionStatus: Record<string, string> = {
  SCHEDULED: 'قیمت ویژه زمان‌بندی‌شده',
  ACTIVE: 'قیمت ویژه فعال',
  EXPIRED: 'قیمت ویژهٔ پایان‌یافته',
  DISABLED: 'قیمت ویژهٔ غیرفعال',
};
const notesOpen = ref(false),
  noteRow = ref<Record<string, unknown>>({}),
  noteText = ref(''),
  noteMessage = ref(''),
  noteBusy = ref(false);
const noteId = (row: Record<string, unknown>) =>
  section.value === 'products'
    ? String(row.sku)
    : section.value === 'trials'
      ? [row.device_id, row.sku, row.generation].join('~')
      : String(row.id);
function editNote(row: Record<string, unknown>) {
  noteRow.value = row;
  noteText.value = String(row.note ?? '');
  noteMessage.value = '';
  notesOpen.value = true;
}
async function saveNote() {
  noteBusy.value = true;
  noteMessage.value = '';
  try {
    await api.post(
      '/api/v2/admin/notes/{type}/{id}',
      { note: noteText.value, expected_revision: Number(noteRow.value.note_revision ?? 0) },
      { type: section.value, id: noteId(noteRow.value) },
    );
    notesOpen.value = false;
    await load();
    message.value = 'یادداشت داخلی ذخیره شد.';
    noticeSuccess.value = true;
  } catch (e) {
    noteMessage.value = errorMessage(e);
  } finally {
    noteBusy.value = false;
  }
}
watch(notesOpen, (v) => {
  if (!v) {
    noteText.value = '';
    noteRow.value = {};
  }
});

const route = useRoute(),
  api = useApi(true),
  busy = ref(true),
  // False until the session check finishes: no console is shown to a signed-out visitor.
  ready = ref(false),
  message = ref(''),
  permissions = ref<string[]>([]),
  rows = ref<Row[]>([]),
  reports = ref<Row>({}),
  offset = ref(0),
  next = ref<number | null>(null),
  search = ref(''),
  limit = ref(20),
  total = ref<number | null>(null),
  archived = ref<'active' | 'archived' | 'all'>('active');
// Row details (Windows profiles, restrictions, notes, every operation) open in one modal, so the
// table keeps fixed columns and its buttons never move.
const detailOpen = ref(false),
  detail = ref<Row>({});
function showDetail(row: Row) {
  detail.value = row;
  detailOpen.value = true;
}
function act(action: string, row: Row) {
  detailOpen.value = false;
  open(action, row);
}
function note(row: Row) {
  detailOpen.value = false;
  editNote(row);
}
function page(to: number) {
  offset.value = to;
  load();
}
function pageSize(n: number) {
  limit.value = n;
  offset.value = 0;
  load();
}
function filterArchived(mode: 'active' | 'archived' | 'all') {
  archived.value = mode;
  offset.value = 0;
  load();
}
const fa = new Intl.NumberFormat('fa-IR');
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('fa-IR') : '—');
const dateTime = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
const grade = (sku: unknown) =>
  'پایهٔ ' + (gradeNames[Number(String(sku ?? '').slice(-1)) - 1] ?? String(sku ?? '—'));
type Column = { key: string; label: string; width?: string; truncate?: boolean; align?: 'end' };
const actions: Column = { key: 'actions', label: 'عملیات', width: '132px', align: 'end' };
const columns = computed<Column[]>(
  () =>
    (
      ({
        products: [
          { key: 'title_fa', label: 'محصول', width: '24%' },
          { key: 'price_irr', label: 'قیمت فهرست', width: '16%' },
          { key: 'publication_status', label: 'وضعیت عرضه', width: '13%' },
          { key: 'switches', label: 'فروش، آزمایش و فعال‌سازی', width: '22%' },
          { key: 'promotion', label: 'قیمت ویژه', width: '15%' },
          actions,
        ],
        customers: [
          { key: 'username', label: 'شناسهٔ دستگاه', width: '26%' },
          { key: 'mobile_masked', label: 'شمارهٔ همراه', width: '15%' },
          { key: 'state', label: 'وضعیت حساب', width: '13%' },
          { key: 'claimed_at', label: 'تاریخ اتصال', width: '14%' },
          { key: 'note', label: 'یادداشت داخلی', width: '18%', truncate: true },
          actions,
        ],
        devices: [
          { key: 'username', label: 'شناسهٔ دستگاه', width: '22%' },
          { key: 'customer_state', label: 'حساب متصل', width: '14%' },
          { key: 'profiles', label: 'پروفایل فعال', width: '10%' },
          { key: 'active_licenses', label: 'مجوز فعال', width: '9%' },
          { key: 'restrictions', label: 'پایهٔ محدود', width: '10%' },
          { key: 'note', label: 'یادداشت داخلی', width: '13%', truncate: true },
          { key: 'created_at', label: 'تاریخ ثبت', width: '10%' },
          actions,
        ],
        licenses: [
          { key: 'username', label: 'شناسهٔ دستگاه', width: '24%' },
          { key: 'sku', label: 'پایه', width: '13%' },
          { key: 'state', label: 'وضعیت مجوز', width: '13%' },
          { key: 'issued_at', label: 'تاریخ صدور', width: '14%' },
          { key: 'id', label: 'شناسهٔ مجوز', width: '22%', truncate: true },
          actions,
        ],
        trials: [
          { key: 'username', label: 'شناسهٔ دستگاه', width: '28%' },
          { key: 'sku', label: 'پایه', width: '15%' },
          { key: 'used', label: 'فرصت باقی‌مانده', width: '17%' },
          { key: 'allocation_epoch', label: 'دورهٔ آزمایشی', width: '14%' },
          { key: 'note', label: 'یادداشت داخلی', width: '16%', truncate: true },
          actions,
        ],
        'activation-codes': [
          { key: 'username', label: 'شناسهٔ دستگاه', width: '26%' },
          { key: 'sku', label: 'پایه', width: '14%' },
          { key: 'status', label: 'وضعیت کد', width: '13%' },
          { key: 'created_at', label: 'تاریخ ساخت', width: '15%' },
          { key: 'expires_at', label: 'پایان اعتبار', width: '15%' },
          actions,
        ],
        audit: [
          { key: 'created_at', label: 'زمان', width: '18%' },
          { key: 'action', label: 'رویداد', width: '30%', truncate: true },
          { key: 'actor_type', label: 'انجام‌دهنده', width: '14%' },
          { key: 'entity_id', label: 'شناسهٔ مورد', width: '38%', truncate: true },
        ],
      }) as Record<string, Column[]>
    )[section.value] ?? [],
);
const detailTitles: Record<string, string> = {
  products: 'جزئیات محصول',
  customers: 'جزئیات حساب مشتری',
  devices: 'جزئیات دستگاه',
  licenses: 'جزئیات مجوز خرید',
  trials: 'جزئیات فرصت آزمایشی',
  'activation-codes': 'جزئیات کد فعال‌سازی',
};
const tone = (value: unknown) =>
  ['ACTIVE', 'REDEEMED', 'published'].includes(String(value))
    ? 'ok'
    : ['REVOKED', 'CANCELLED', 'RESET', 'hidden'].includes(String(value))
      ? 'bad'
      : 'warn';
const section = computed(() => String(route.params.section ?? 'dashboard'));
const sections = [
  ['dashboard', 'نمای کلی', 'audit.read'],
  ['products', 'محصولات و قیمت', 'products.manage'],
  ['customers', 'مشتریان', 'customers.read'],
  ['devices', 'دستگاه‌ها و محدودیت‌ها', 'devices.read'],
  ['licenses', 'مجوزهای خرید', 'licenses.read'],
  ['trials', 'فرصت‌های آزمایشی', 'trials.read'],
  ['activation-codes', 'کدهای فعال‌سازی', 'activation_codes.read'],
  ['audit', 'گزارش فعالیت', 'audit.read'],
  ['commerce', 'فروش و امور مالی', 'commerce.read'],
  ['payment-readiness', 'آمادگی پرداخت', 'finance.read'],
];
const allowed = (permission: string) => permissions.value.includes(permission);
// Dashboard: totals and 30-day daily counts from /admin/reports (counts only, no amounts).
const count = (key: string) => Number(reports.value[key] ?? 0);
const dashboardTiles = computed(() => [
  { icon: '◉', label: 'حساب فعال', value: count('customers') },
  { icon: '▣', label: 'دستگاه ثبت‌شده', value: count('devices') },
  { icon: '✓', label: 'مجوز معتبر', value: count('licenses_active') },
  { icon: '◆', label: 'سفارش پرداخت‌شده', value: count('paid_orders') },
  { icon: '▶', label: 'شروع نوبت آزمایشی', value: count('trials') },
  { icon: '⟳', label: 'رویداد در انتظار پردازش', value: count('outbox_pending') },
]);
function series(key: 'accounts' | 'trials' | 'paid_orders') {
  const daily = (reports.value.daily ?? []) as Record<string, unknown>[];
  return daily.map((d) => ({ day: String(d.day), value: Number(d[key] ?? 0) }));
}
const title = computed(() => sections.find((s) => s[0] === section.value)?.[1] ?? 'مدیریت');
const dialog = ref(false),
  selected = ref<Row>({}),
  kind = ref(''),
  reason = ref(''),
  evidence = ref(''),
  targetSku = ref('YARIZAN-G1'),
  secret = ref(''),
  feedback = ref(''),
  saving = ref(false),
  submitted = ref(false),
  requestId = ref('');
const product = reactive({
  price: 0,
  publication_status: 'published' as 'published' | 'coming_soon' | 'hidden',
  sale_enabled: false,
  trial_enabled: false,
  activation_enabled: false,
});
const operationTitles: Record<string, string> = {
  product: 'ویرایش محصول',
  reset: 'بازنشانی حساب مشتری',
  'password-reset': 'ساخت مجوز بازیابی با تأیید پشتیبانی',
  block: 'مسدود کردن دسترسی یک پایه',
  unblock: 'برداشتن محدودیت این پایه',
  trial: 'بازنشانی فرصت‌های آزمایشی این پایه',
  issue: 'ثبت مجوز خرید برای دستگاه',
  code: 'ساخت کد فعال‌سازی',
  cancel: 'لغو کد فعال‌سازی',
  revoke: 'لغو اعتبار مجوز',
  reissue: 'بازیابی مجوز خرید',
  remove: 'حذف دستگاه',
  restore: 'بازگرداندن دستگاه بایگانی‌شده',
};
const needsEvidence = computed(() =>
  ['password-reset', 'issue', 'code', 'reissue'].includes(kind.value),
);
async function load() {
  busy.value = true;
  message.value = '';
  noticeSuccess.value = false;
  try {
    const session = await api.get('/api/v2/admin/auth/session');
    permissions.value = session.permissions;
    ready.value = true;
    if (section.value === 'dashboard') {
      if (allowed('audit.read')) reports.value = (await api.get('/api/v2/admin/reports')) as Row;
    } else if (!allowed(sections.find((s) => s[0] === section.value)?.[2] ?? '')) {
      message.value = 'اجازهٔ مشاهدهٔ این بخش را ندارید.';
      rows.value = [];
    } else if (section.value === 'audit') {
      rows.value = (await api.get('/api/v2/admin/audit', undefined, {
        limit: limit.value,
        offset: offset.value,
      })) as Row[];
      total.value = null;
      next.value = rows.value.length === limit.value ? offset.value + limit.value : null;
    } else {
      const result = (await api.get(('/api/v2/admin/' + section.value) as ApiPath, undefined, {
        limit: limit.value,
        offset: offset.value,
        search: search.value,
        ...(section.value === 'devices' ? { archived: archived.value } : {}),
      })) as { items: Row[]; next_offset: number | null; total?: number };
      rows.value = result.items;
      next.value = result.next_offset;
      total.value = result.total ?? null;
    }
  } catch (e) {
    rows.value = [];
    if ((e as { status?: number }).status === 401) {
      await navigateTo('/zanyari/login', { replace: true });
      return;
    }
    message.value = errorMessage(e);
    ready.value = true;
  } finally {
    busy.value = false;
  }
}
function open(action: string, row: Row) {
  selected.value = row;
  kind.value = action;
  reason.value = '';
  evidence.value = '';
  targetSku.value = String(row.sku ?? 'YARIZAN-G1');
  secret.value = '';
  feedback.value = '';
  submitted.value = false;
  requestId.value = crypto.randomUUID();
  product.price = Number(row.price_irr ?? 0) / 10;
  product.publication_status = (row.publication_status ??
    'published') as typeof product.publication_status;
  product.sale_enabled = !!row.sale_enabled;
  product.trial_enabled = !!row.trial_enabled;
  product.activation_enabled = !!row.activation_enabled;
  dialog.value = true;
}
watch(dialog, (value) => {
  if (!value) {
    secret.value = '';
    evidence.value = '';
    reason.value = '';
    selected.value = {};
  }
});
watch(
  () => product.publication_status,
  (value) => {
    if (value !== 'published') {
      product.sale_enabled = false;
      product.trial_enabled = false;
      product.activation_enabled = false;
    }
  },
);
function revision() {
  const r = selected.value;
  if (kind.value === 'product') return Number(r.revision);
  if (['revoke', 'reissue'].includes(kind.value)) return Number(r.decision_version);
  if (['block', 'unblock'].includes(kind.value)) {
    const restrictions = r.restrictions as { sku: string; revision: string }[] | undefined;
    return Number(restrictions?.find((v) => v.sku === targetSku.value)?.revision ?? 1);
  }
  if (kind.value === 'cancel') return 1;
  return Number(r.generation ?? 1);
}
async function commit() {
  if (submitted.value || saving.value) return;
  saving.value = true;
  feedback.value = '';
  const row = selected.value;
  const viewId = requestId.value;
  const body = {
    request_id: requestId.value,
    reason: reason.value,
    expected_revision: revision(),
    ...(needsEvidence.value ? { evidence_ref: evidence.value } : {}),
  };
  try {
    let result: Row = {};
    switch (kind.value) {
      case 'product': {
        const irr = product.price * 10;
        if (!Number.isSafeInteger(irr) || irr < 0) throw new Error('Invalid price');
        result = (await api.patch(
          '/api/v2/admin/products/{sku}',
          {
            ...body,
            price_irr: irr,
            publication_status: product.publication_status,
            sale_enabled: product.sale_enabled,
            trial_enabled: product.trial_enabled,
            activation_enabled: product.activation_enabled,
          },
          { sku: String(row.sku) },
        )) as Row;
        break;
      }
      case 'reset':
      case 'password-reset':
        result = (await api.post(
          kind.value === 'reset'
            ? '/api/v2/admin/customers/{id}/reset'
            : '/api/v2/admin/customers/{id}/password-reset',
          body,
          { id: String(row.id) },
        )) as Row;
        break;
      case 'block':
      case 'unblock':
        result = (await api.post(
          kind.value === 'block'
            ? '/api/v2/admin/devices/{id}/products/{sku}/block'
            : '/api/v2/admin/devices/{id}/products/{sku}/unblock',
          body,
          { id: String(row.id), sku: targetSku.value },
        )) as Row;
        break;
      case 'trial':
        result = (await api.post('/api/v2/admin/trials/{id}/{sku}/reset', body, {
          id: String(row.device_id),
          sku: String(row.sku),
        })) as Row;
        break;
      case 'issue':
        result = (await api.post('/api/v2/admin/licenses/issue', {
          ...body,
          device_id: String(row.id),
          sku: targetSku.value,
        })) as Row;
        break;
      case 'code':
        result = (await api.post('/api/v2/admin/activation-codes', {
          ...body,
          device_id: String(row.id),
          sku: targetSku.value,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })) as Row;
        break;
      case 'cancel':
        result = (await api.post('/api/v2/admin/activation-codes/{id}/cancel', body, {
          id: String(row.id),
        })) as Row;
        break;
      case 'revoke':
      case 'reissue':
        result = (await api.post(
          kind.value === 'revoke'
            ? '/api/v2/admin/licenses/{id}/revoke'
            : '/api/v2/admin/licenses/{id}/reissue',
          body,
          { id: String(row.id) },
        )) as Row;
        break;
      case 'remove':
      case 'restore':
        result = (await api.post(
          kind.value === 'remove'
            ? '/api/v2/admin/devices/{id}/remove'
            : '/api/v2/admin/devices/{id}/restore',
          body,
          { id: String(row.id) },
        )) as Row;
        break;
    }
    if (!alive || !dialog.value || requestId.value !== viewId) return;
    submitted.value = true;
    secret.value = String(result.activation_code ?? result.code ?? result.reset_grant ?? '');
    feedback.value = result.secret_already_delivered
      ? 'مجوز محرمانه قبلاً تحویل شده و دوباره نمایش داده نمی‌شود.'
      : result.removed === 'DELETED'
        ? 'عملیات ثبت شد. دستگاه سابقه‌ای نداشت و کامل حذف شد.'
        : result.removed === 'ARCHIVED'
          ? 'عملیات ثبت شد. دستگاه سابقه دارد؛ بایگانی شد و از فهرست اصلی پنهان است.'
          : 'عملیات ثبت شد. برای مشاهدهٔ وضعیت تازه، پنجره را ببندید.';
    await load();
  } catch (e) {
    feedback.value =
      errorMessage(e); /* Never automatically retry a destructive or stale operation. */
  } finally {
    saving.value = false;
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(secret.value);
    feedback.value = 'کپی شد؛ فقط در مسیر تأییدشده تحویل دهید.';
  } catch {
    feedback.value = 'کپی خودکار ممکن نشد. متن را با احتیاط انتخاب کنید.';
  }
}
async function logout() {
  try {
    await api.post('/api/v2/admin/auth/logout', undefined as never);
    api.clear();
    secret.value = '';
    permissions.value = [];
    await navigateTo('/zanyari/login');
  } catch (e) {
    message.value = errorMessage(e);
  }
}
function state(value: unknown) {
  return (
    (
      {
        ACTIVE: 'فعال',
        REVOKED: 'لغوشده',
        RESET: 'بازنشانی‌شده',
        ISSUED: 'صادرشده',
        REDEEMED: 'مصرف‌شده',
        CANCELLED: 'لغوشده',
        published: 'عرضه‌شده',
        coming_soon: 'به‌زودی',
        hidden: 'پنهان',
      } as Record<string, string>
    )[String(value)] ?? String(value ?? '—')
  );
}
onMounted(load);
onBeforeUnmount(() => {
  alive = false;
  secret.value = '';
  evidence.value = '';
});
const navigationGroups: { title: string; ids: string[] }[] = [
  { title: 'میز کار', ids: ['dashboard', 'products'] },
  { title: 'مشتریان و دستگاه‌ها', ids: ['customers', 'devices'] },
  { title: 'مجوزها و آزمایش', ids: ['licenses', 'trials', 'activation-codes'] },
  { title: 'فروش و نظارت', ids: ['commerce', 'payment-readiness', 'audit'] },
];
</script>
<template>
  <section v-if="!ready" class="wrap section portal-loader" role="status">
    <img src="/brand/logo.webp" alt="" width="118" height="78" />
    <span>در حال بررسی ورود مدیریت…</span>
  </section>
  <section v-else class="wrap section portal admin-portal">
    <aside class="portal-sidebar">
      <p class="eyebrow">مدیریت یاریزان</p>
      <h2>میز کار شما</h2>
      <nav aria-label="بخش‌های مدیریت">
        <template v-for="group in navigationGroups" :key="group.title">
          <span
            v-if="sections.some((s) => group.ids.includes(s[0]!) && allowed(s[2]!))"
            class="nav-group-label"
            >{{ group.title }}</span
          >
          <NuxtLink
            v-for="[id, label] in sections.filter(
              (s) => group.ids.includes(s[0]!) && allowed(s[2]!),
            )"
            :key="id"
            :to="id === 'dashboard' ? '/zanyari' : `/zanyari/${id}`"
            :aria-current="section === id ? 'page' : undefined"
            >{{ label }}</NuxtLink
          >
        </template>
      </nav>
      <button class="button secondary" @click="logout">خروج از مدیریت</button>
    </aside>
    <div class="portal-main" :aria-busy="busy">
      <header class="portal-heading">
        <div>
          <p class="eyebrow">تغییرات مسئولانه و قابل پیگیری</p>
          <h1>{{ title }}</h1>
        </div>
        <NuxtLink to="/zanyari/login" class="text-link">ورود مجدد برای تأیید تازه ↗</NuxtLink>
      </header>
      <ApiNotice :message="message" :kind="noticeSuccess ? 'success' : 'error'" />
      <p v-if="busy" role="status" class="notice">در حال دریافت اطلاعات…</p>
      <template v-if="section === 'dashboard'"
        ><template v-if="allowed('audit.read') && !busy">
          <div class="dashboard-stats">
            <article v-for="tile in dashboardTiles" :key="tile.label" class="panel stat-tile">
              <span class="stat-tile-icon" aria-hidden="true">{{ tile.icon }}</span>
              <strong>{{ new Intl.NumberFormat('fa-IR').format(tile.value) }}</strong>
              <p>{{ tile.label }}</p>
            </article>
          </div>
          <div class="dashboard-charts">
            <DailyBarChart
              class="panel"
              title="حساب‌های تازه"
              unit="حساب"
              :points="series('accounts')"
            />
            <DailyBarChart
              class="panel"
              title="شروع نوبت آزمایشی"
              unit="شروع"
              :points="series('trials')"
            />
            <DailyBarChart
              class="panel"
              title="سفارش‌های پرداخت‌شده"
              unit="سفارش"
              :points="series('paid_orders')"
            />
          </div>
        </template>
        <div class="panel dashboard-note">
          <h2>هر عملیات، با دلیل روشن.</h2>
          <p>
            دسترسی بخش‌ها بر اساس نقش شماست. هر ورود دومرحله‌ای تا یک ساعت معتبر است؛ پس از آن
            دوباره وارد شوید.
          </p>
          <p class="danger-copy">
            بازنشانی حساب، محدودیت پایه و بازیابی مجوز سه کار مستقل‌اند. حذف حساب محدودیت دستگاه را
            برنمی‌دارد. لغو اعتبار مجوز نمی‌تواند فوراً نسخهٔ همیشه‌آفلاین را متوقف کند.
          </p>
        </div></template
      ><template v-else-if="permissions.length"
        ><FormShell
          v-if="section !== 'audit'"
          class="toolbar-row"
          @submit.prevent="
            offset = 0;
            load();
          "
        >
          <input
            v-model="search"
            :aria-label="
              section === 'products'
                ? 'جست‌وجوی محصول و یادداشت'
                : 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت'
            "
            :placeholder="
              section === 'products'
                ? 'نام محصول، شناسه یا یادداشت'
                : 'شناسهٔ دستگاه، شمارهٔ کامل همراه، شناسه یا یادداشت'
            "
            class="search-input"
            maxlength="128"
          /><button class="button secondary">جست‌وجو</button
          ><button type="button" class="button secondary" @click="load">تازه‌سازی</button>
          <div
            v-if="section === 'devices'"
            class="segmented"
            role="group"
            aria-label="نمایش دستگاه‌ها"
          >
            <button
              v-for="[mode, label] in [
                ['active', 'فعال'],
                ['archived', 'بایگانی‌شده'],
                ['all', 'همه'],
              ] as const"
              :key="mode"
              type="button"
              :aria-pressed="archived === mode"
              @click="filterArchived(mode)"
            >
              {{ label }}
            </button>
          </div>
        </FormShell>
        <DataTable
          :columns="columns"
          :rows="rows"
          :caption="title"
          :loading="busy"
          :total="total"
          :offset="offset"
          :limit="limit"
          :has-next="next !== null"
          :row-key="
            (row, index) => String(row.id ?? row.sku ?? index) + ':' + String(row.generation ?? '')
          "
          @page="page"
          @limit="pageSize"
        >
          <template #cell-title_fa="{ row }"
            ><b>{{ row.title_fa }}</b
            ><small dir="ltr">{{ persianDigits(row.sku) }}</small></template
          >
          <template #cell-price_irr="{ row }">{{ toman(Number(row.price_irr)) }} تومان</template>
          <template #cell-publication_status="{ row }"
            ><span class="pill" :data-tone="tone(row.publication_status)">{{
              state(row.publication_status)
            }}</span></template
          >
          <template #cell-switches="{ row }"
            ><small
              >فروش {{ row.sale_enabled ? 'فعال' : 'خاموش' }} · آزمایش
              {{ row.trial_enabled ? 'فعال' : 'خاموش' }} · فعال‌سازی
              {{ row.activation_enabled ? 'فعال' : 'خاموش' }}</small
            ></template
          >
          <template #cell-promotion="{ row }"
            ><span
              v-if="row.promotion"
              :data-testid="'row-promotion-' + String((row.promotion as Row).status).toLowerCase()"
              :title="promotionStatus[String((row.promotion as Row).status)]"
              >{{ toman(Number((row.promotion as Row).promo_price_irr)) }} تومان ({{
                persianDigits((row.promotion as Row).discount_percent)
              }}٪)<small>{{ promotionStatus[String((row.promotion as Row).status)] }}</small></span
            ><span v-else class="muted">ندارد</span></template
          >
          <template #cell-username="{ row }"
            ><b dir="ltr">{{ row.username ?? '—' }}</b
            ><small v-if="row.archived_at"
              >بایگانی‌شده در {{ date(row.archived_at) }}</small
            ></template
          >
          <template #cell-mobile_masked="{ row }"
            ><span dir="ltr">{{
              row.mobile_masked ? persianDigits(row.mobile_masked) : '—'
            }}</span></template
          >
          <template #cell-state="{ row }"
            ><span class="pill" :data-tone="tone(row.state)">{{ state(row.state) }}</span></template
          >
          <template #cell-status="{ row }"
            ><span class="pill" :data-tone="tone(row.status)">{{
              state(row.status)
            }}</span></template
          >
          <template #cell-claimed_at="{ row }">{{ date(row.claimed_at) }}</template>
          <template #cell-created_at="{ row }">{{
            section === 'audit' ? dateTime(row.created_at) : date(row.created_at)
          }}</template>
          <template #cell-issued_at="{ row }">{{ date(row.issued_at) }}</template>
          <template #cell-expires_at="{ row }">{{ dateTime(row.expires_at) }}</template>
          <template #cell-customer_state="{ row }"
            ><span class="pill" :data-tone="row.customer_state ? 'ok' : 'warn'">{{
              row.customer_state ? 'متصل' : 'بدون حساب'
            }}</span
            ><small v-if="row.mobile_masked" dir="ltr">{{
              persianDigits(row.mobile_masked)
            }}</small></template
          >
          <template #cell-profiles="{ row }">{{ fa.format(Number(row.profiles ?? 0)) }}</template>
          <template #cell-active_licenses="{ row }">{{
            fa.format(Number(row.active_licenses ?? 0))
          }}</template>
          <template #cell-restrictions="{ row }">{{
            (row.restrictions as { blocked: boolean }[])?.some((r) => r.blocked)
              ? fa.format(
                  (row.restrictions as { blocked: boolean }[]).filter((r) => r.blocked).length,
                ) + ' پایه'
              : 'ندارد'
          }}</template>
          <template #cell-sku="{ row }">{{ grade(row.sku) }}</template>
          <template #cell-used="{ row }"
            >{{ fa.format(2 - Number(row.used)) }} از {{ fa.format(2) }}</template
          >
          <template #cell-allocation_epoch="{ row }">{{
            fa.format(Number(row.allocation_epoch))
          }}</template>
          <template #cell-id="{ row }"
            ><span dir="ltr">{{ row.id }}</span></template
          >
          <template #cell-note="{ row }">{{ String(row.note ?? '') || '—' }}</template>
          <template #cell-action="{ row }"
            ><span dir="ltr">{{ row.action }}</span></template
          >
          <template #cell-entity_id="{ row }"
            ><span dir="ltr">{{ row.entity_id }}</span></template
          >
          <template #cell-actions="{ row }"
            ><div class="row-actions">
              <button type="button" class="button secondary" @click="showDetail(row)">
                مدیریت
              </button>
            </div></template
          >
        </DataTable></template
      >
    </div>
    <BaseDialog v-model="detailOpen" :title="detailTitles[section] ?? 'جزئیات'" class="dialog-wide">
      <template v-if="detailOpen">
        <p class="device-username" dir="ltr">
          {{ detail.username ?? detail.title_fa ?? detail.sku ?? detail.id }}
        </p>
        <dl class="detail-grid">
          <div v-if="detail.id">
            <dt>شناسه</dt>
            <dd dir="ltr">{{ detail.id }}</dd>
          </div>
          <div v-if="detail.sku">
            <dt>پایه</dt>
            <dd>{{ grade(detail.sku) }}</dd>
          </div>
          <div v-if="detail.state ?? detail.status">
            <dt>وضعیت</dt>
            <dd>{{ state(detail.state ?? detail.status) }}</dd>
          </div>
          <div v-if="detail.mobile_masked">
            <dt>شمارهٔ همراه</dt>
            <dd dir="ltr">{{ persianDigits(detail.mobile_masked) }}</dd>
          </div>
          <div v-if="detail.generation">
            <dt>نسل حساب</dt>
            <dd>{{ fa.format(Number(detail.generation)) }}</dd>
          </div>
          <div v-if="detail.decision_version">
            <dt>نسخهٔ تصمیم مجوز</dt>
            <dd>{{ persianDigits(detail.decision_version) }}</dd>
          </div>
          <div v-if="detail.customer_id">
            <dt>شناسهٔ حساب</dt>
            <dd dir="ltr">{{ detail.customer_id }}</dd>
          </div>
          <div v-if="detail.device_id">
            <dt>شناسهٔ داخلی دستگاه</dt>
            <dd dir="ltr">{{ detail.device_id }}</dd>
          </div>
          <div v-if="detail.created_at ?? detail.claimed_at ?? detail.issued_at">
            <dt>تاریخ</dt>
            <dd>{{ dateTime(detail.created_at ?? detail.claimed_at ?? detail.issued_at) }}</dd>
          </div>
          <div v-if="detail.expires_at">
            <dt>پایان اعتبار</dt>
            <dd>{{ dateTime(detail.expires_at) }}</dd>
          </div>
          <div v-if="section === 'products'">
            <dt>قیمت فهرست</dt>
            <dd>{{ toman(Number(detail.price_irr)) }} تومان</dd>
          </div>
          <div v-if="section === 'products'">
            <dt>فروش، آزمایش و فعال‌سازی</dt>
            <dd>
              {{ detail.sale_enabled ? 'فروش فعال' : 'فروش خاموش' }} ·
              {{ detail.trial_enabled ? 'آزمایش فعال' : 'آزمایش خاموش' }} ·
              {{ detail.activation_enabled ? 'فعال‌سازی فعال' : 'فعال‌سازی خاموش' }}
            </dd>
          </div>
        </dl>
        <section v-if="section === 'devices'" class="detail-section">
          <h3>پروفایل‌های ویندوز این دستگاه</h3>
          <p class="muted">
            هر کاربر ویندوز روی این رایانه یک پروفایل جدا دارد. خرید و فرصت آزمایشی میان پروفایل‌های
            فعال یک دستگاه مشترک است.
          </p>
          <table v-if="(detail.profile_details as Row[])?.length" class="mini-table">
            <thead>
              <tr>
                <th style="width: 52%">شناسهٔ پروفایل</th>
                <th>وضعیت</th>
                <th>تاریخ تأیید</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="profile in detail.profile_details as Row[]" :key="String(profile.id)">
                <td dir="ltr" :title="String(profile.id)">{{ profile.id }}</td>
                <td>
                  <span class="pill" :data-tone="tone(profile.status)">{{
                    state(profile.status)
                  }}</span>
                </td>
                <td>{{ date(profile.created_at) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted">هنوز پروفایلی برای این دستگاه تأیید نشده است.</p>
          <h3>محدودیت پایه‌ها</h3>
          <p v-if="!(detail.restrictions as Row[])?.length" class="muted">
            هیچ پایه‌ای برای این دستگاه محدود نشده است.
          </p>
          <ul v-else class="record-list">
            <li v-for="r in detail.restrictions as Row[]" :key="String(r.sku)">
              <span>{{ grade(r.sku) }}</span
              ><span class="pill" :data-tone="r.blocked ? 'bad' : 'ok'">{{
                r.blocked ? 'محدود' : 'آزاد'
              }}</span>
            </li>
          </ul>
        </section>
        <section class="detail-section">
          <h3>یادداشت داخلی</h3>
          <p class="note-preview">{{ String(detail.note ?? '') || 'یادداشتی ثبت نشده است.' }}</p>
        </section>
        <section class="detail-section">
          <h3>عملیات</h3>
          <div class="action-grid">
            <button type="button" class="button secondary" @click="note(detail)">
              {{ allowed('notes.manage') ? 'مشاهده و ویرایش یادداشت' : 'مشاهدهٔ یادداشت' }}</button
            ><template v-if="section === 'products' && allowed('products.manage')"
              ><button class="button secondary" @click="act('product', detail)">ویرایش محصول</button
              ><button
                class="button secondary"
                data-testid="open-promotions"
                @click="
                  detailOpen = false;
                  openPromotions(detail);
                "
              >
                قیمت ویژه و تخفیف محصول
              </button></template
            ><template v-if="section === 'customers' && detail.state === 'ACTIVE'"
              ><button
                v-if="allowed('customers.reset')"
                class="button secondary"
                @click="act('reset', detail)"
              >
                بازنشانی حساب</button
              ><button
                v-if="allowed('support.password_reset')"
                class="button secondary"
                @click="act('password-reset', detail)"
              >
                بازیابی رمز عبور
              </button></template
            ><template v-if="section === 'devices'"
              ><button
                v-if="allowed('device_products.block')"
                class="button secondary"
                @click="act('block', detail)"
              >
                محدود کردن پایه</button
              ><button
                v-if="allowed('device_products.unblock')"
                class="button secondary"
                @click="act('unblock', detail)"
              >
                رفع محدودیت</button
              ><button
                v-if="allowed('licenses.issue') && detail.customer_id"
                class="button secondary"
                @click="act('issue', detail)"
              >
                ثبت مجوز خرید</button
              ><button
                v-if="allowed('activation_codes.issue') && detail.customer_id"
                class="button secondary"
                @click="act('code', detail)"
              >
                ساخت کد فعال‌سازی</button
              ><button
                v-if="allowed('devices.manage') && !detail.archived_at"
                class="button destructive"
                @click="act('remove', detail)"
              >
                حذف دستگاه</button
              ><button
                v-if="allowed('devices.manage') && detail.archived_at"
                class="button secondary"
                @click="act('restore', detail)"
              >
                بازگرداندن از بایگانی
              </button></template
            ><template v-if="section === 'licenses'"
              ><button
                v-if="allowed('licenses.revoke') && detail.state === 'ACTIVE'"
                class="button secondary"
                @click="act('revoke', detail)"
              >
                لغو اعتبار مجوز</button
              ><button
                v-if="allowed('licenses.reissue')"
                class="button secondary"
                @click="act('reissue', detail)"
              >
                بازیابی مجوز خرید
              </button></template
            ><button
              v-if="section === 'trials' && allowed('trials.reset')"
              class="button secondary"
              @click="act('trial', detail)"
            >
              دو فرصت تازه</button
            ><button
              v-if="
                section === 'activation-codes' &&
                allowed('activation_codes.cancel') &&
                detail.status === 'ISSUED'
              "
              class="button secondary"
              @click="act('cancel', detail)"
            >
              لغو کد
            </button>
          </div>
        </section>
      </template>
    </BaseDialog>
    <BaseDialog v-model="promoOpen" title="قیمت ویژه و تخفیف محصول"
      ><PromotionEditor
        v-if="promoOpen"
        :key="String(promoRow.sku)"
        :sku="String(promoRow.sku)"
        :title="String(promoRow.title_fa)"
        :grade="Number(promoRow.grade)"
        :list-price-irr="Number(promoRow.price_irr)"
        :product-revision="Number(promoRow.revision)"
        :published="promoRow.publication_status === 'published'"
        @changed="load" /></BaseDialog
    ><BaseDialog v-model="notesOpen" title="یادداشت داخلی"
      ><FormShell @submit="saveNote"
        ><p class="mono" dir="ltr">{{ noteId(noteRow) }}</p>
        <p class="muted">
          برای پیگیری داخلی همکاران است. رمز عبور، کد پیامک و کد فعال‌سازی را در یادداشت ننویسید.
        </p>
        <label
          >یادداشت داخلی<textarea
            v-model="noteText"
            class="note-editor"
            maxlength="2000"
            :readonly="!allowed('notes.manage')"
          /></label
        ><ApiNotice :message="noteMessage" /><button
          v-if="allowed('notes.manage')"
          class="button primary"
          :disabled="noteBusy"
        >
          {{ noteBusy ? 'در حال ذخیره…' : 'ذخیرهٔ یادداشت' }}
        </button></FormShell
      ></BaseDialog
    >
    <BaseDialog v-model="dialog" :title="operationTitles[kind] ?? 'تأیید عملیات'"
      ><FormShell v-if="!submitted" @submit.prevent="commit">
        <p class="device-username" dir="ltr">
          {{ selected.username ?? selected.sku ?? selected.id }}
        </p>
        <p v-if="kind === 'reset'" class="danger-copy">
          حساب فعلی، شمارهٔ همراه و رمز عبور آن غیرفعال می‌شوند و نشست‌ها و دسترسی‌های آنلاین بسته
          می‌شوند. اتصال دوباره حساب تازه‌ای ایجاد می‌کند. محدودیت‌های هر پایه و تاریخچه حفظ
          می‌شوند. مجوز معتبرِ دستگاهی که همیشه آفلاین است فوراً از کار نمی‌افتد.
        </p>
        <p v-else-if="kind === 'trial'" class="notice">
          فقط همین پایه دو فرصت تازه می‌گیرد. درخواست‌های تخصیص قبلی بازگردانده نمی‌شوند؛ تاریخچه
          باقی می‌ماند.
        </p>
        <p v-else-if="kind === 'unblock'" class="notice">
          رفع محدودیت، مالکیت حذف‌شده یا فرصت آزمایشی تازه ایجاد نمی‌کند.
        </p>
        <p v-else-if="kind === 'remove'" class="danger-copy">
          دستگاهی که هیچ سابقه‌ای ندارد کامل حذف می‌شود. دستگاهی با سابقه (حساب، سفارش، فرصت آزمایشی
          یا مجوز) فقط بایگانی و از فهرست اصلی پنهان می‌شود؛ سوابق مالی و تاریخچه هرگز پاک نمی‌شوند.
          دستگاه دارای پروفایل یا مجوز فعال حذف نمی‌شود.
        </p>
        <p v-else-if="kind === 'reissue'" class="notice">
          فقط بازیابی مجوز همان شناسه با نسخهٔ تصمیم تازه ممکن است. جایگزینی میان شناسه‌های متفاوت
          پشتیبانی نمی‌شود.
        </p>
        <template v-if="kind === 'product'"
          ><NumberStepper
            v-model="product.price"
            min="0"
            step="0.1"
            required
            label="قیمت به تومان"
          /><AppSelect
            v-model="product.publication_status"
            label="وضعیت عرضه"
            :options="[
              { value: 'published', label: 'عرضه‌شده' },
              { value: 'coming_soon', label: 'به‌زودی' },
              { value: 'hidden', label: 'پنهان' },
            ]"
          /><label class="check-label"
            ><input
              v-model="product.sale_enabled"
              type="checkbox"
              :disabled="product.publication_status !== 'published'"
            />فروش فعال</label
          ><label class="check-label"
            ><input
              v-model="product.trial_enabled"
              type="checkbox"
              :disabled="product.publication_status !== 'published'"
            />آزمایش فعال</label
          ><label class="check-label"
            ><input
              v-model="product.activation_enabled"
              type="checkbox"
              :disabled="product.publication_status !== 'published'"
            />فعال‌سازی فعال</label
          ></template
        ><AppSelect
          v-if="['block', 'unblock', 'issue', 'code'].includes(kind)"
          v-model="targetSku"
          label="پایهٔ موردنظر"
          :options="
            gradeNames.map((name, i) => ({ value: 'YARIZAN-G' + (i + 1), label: 'پایهٔ ' + name }))
          "
        /><label
          >دلیل عملیات<textarea v-model="reason" minlength="8" maxlength="512" required /></label
        ><label v-if="needsEvidence"
          >مرجع تأیید مستقل مالکیت<input
            v-model="evidence"
            minlength="8"
            maxlength="256"
            required
          /><small class="muted"
            >نام کاربری و شناسهٔ سخت‌افزار به‌تنهایی مدرک مالکیت نیستند.</small
          ></label
        >
        <p class="muted">این عملیات ثبت می‌شود. تعارض نسخه بدون تأیید دوباره تکرار نخواهد شد.</p>
        <button
          class="button"
          :class="
            ['reset', 'block', 'revoke', 'cancel', 'remove'].includes(kind)
              ? 'destructive'
              : 'primary'
          "
          :disabled="saving"
        >
          {{ saving ? 'در حال ثبت…' : 'تأیید و ثبت عملیات' }}
        </button>
      </FormShell>
      <div v-else>
        <span class="success-mark" aria-hidden="true">✓</span
        ><template v-if="secret"
          ><p class="danger-copy">
            این مقدار فقط همین یک بار نمایش داده می‌شود. پس از بستن پنجره قابل بازیابی نیست.
          </p>
          <p class="secret-once" dir="ltr" data-testid="one-time-secret">{{ secret }}</p>
          <button class="button primary" @click="copy">کپی مقدار یک‌بارمصرف</button></template
        >
      </div>
      <p v-if="feedback" class="notice" role="status">{{ feedback }}</p></BaseDialog
    >
  </section>
</template>
