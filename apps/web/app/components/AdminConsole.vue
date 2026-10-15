<script setup lang="ts">
import { errorMessage, toman, gradeNames } from '#shared/domain';
import type { ApiPath } from '#shared/api';
type Row = Record<string, unknown>;
let alive = true;
const noticeSuccess = ref(false);
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
  message = ref(''),
  permissions = ref<string[]>([]),
  rows = ref<Row[]>([]),
  reports = ref<Row>({}),
  offset = ref(0),
  next = ref<number | null>(null),
  search = ref('');
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
];
const allowed = (permission: string) => permissions.value.includes(permission);
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
    if (section.value === 'dashboard') {
      if (allowed('audit.read')) reports.value = (await api.get('/api/v2/admin/reports')) as Row;
    } else if (!allowed(sections.find((s) => s[0] === section.value)?.[2] ?? '')) {
      message.value = 'اجازهٔ مشاهدهٔ این بخش را ندارید.';
      rows.value = [];
    } else if (section.value === 'audit') {
      rows.value = (await api.get('/api/v2/admin/audit', undefined, { limit: 30 })) as Row[];
      next.value = null;
    } else {
      const result = (await api.get(('/api/v2/admin/' + section.value) as ApiPath, undefined, {
        limit: 20,
        offset: offset.value,
        search: search.value,
      })) as { items: Row[]; next_offset: number | null };
      rows.value = result.items;
      next.value = result.next_offset;
    }
  } catch (e) {
    message.value = errorMessage(e);
    rows.value = [];
    if ((e as { status?: number }).status === 401) await navigateTo('/zanyari/login');
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
    }
    if (!alive || !dialog.value || requestId.value !== viewId) return;
    submitted.value = true;
    secret.value = String(result.activation_code ?? result.code ?? result.reset_grant ?? '');
    feedback.value = result.secret_already_delivered
      ? 'مجوز محرمانه قبلاً تحویل شده و دوباره نمایش داده نمی‌شود.'
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
</script>
<template>
  <section class="wrap section portal admin-portal">
    <aside class="portal-sidebar">
      <p class="eyebrow">مدیریت یاریزان</p>
      <h2>میز کار شما</h2>
      <nav aria-label="بخش‌های مدیریت">
        <NuxtLink
          v-for="[id, label] in sections.filter((s) => allowed(s[2]!))"
          :key="id"
          :to="id === 'dashboard' ? '/zanyari' : `/zanyari/${id}`"
          :aria-current="section === id ? 'page' : undefined"
          >{{ label }}</NuxtLink
        >
      </nav>
      <button class="button secondary" @click="logout">خروج از مدیریت</button>
    </aside>
    <div class="portal-main">
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
        ><div v-if="allowed('audit.read')" class="stat-grid">
          <article class="panel">
            <span>{{ new Intl.NumberFormat('fa-IR').format(Number(reports.customers ?? 0)) }}</span>
            <p>حساب فعال</p>
          </article>
          <article class="panel">
            <span>{{ new Intl.NumberFormat('fa-IR').format(Number(reports.trials ?? 0)) }}</span>
            <p>شروع آزمایش ثبت‌شده</p>
          </article>
          <article class="panel">
            <span>{{
              new Intl.NumberFormat('fa-IR').format(Number(reports.outbox_pending ?? 0))
            }}</span>
            <p>رویداد در انتظار پردازش</p>
          </article>
        </div>
        <div class="panel">
          <h2>هر عملیات، با دلیل روشن.</h2>
          <p>
            دسترسی بخش‌ها بر اساس نقش شماست. عملیات حساس به ورود دومرحله‌ای در پنج دقیقهٔ اخیر نیاز
            دارد.
          </p>
          <p class="danger-copy">
            بازنشانی حساب، محدودیت پایه و بازیابی مجوز سه کار مستقل‌اند. حذف حساب محدودیت دستگاه را
            برنمی‌دارد. لغو اعتبار مجوز نمی‌تواند فوراً نسخهٔ همیشه‌آفلاین را متوقف کند.
          </p>
        </div></template
      ><template v-else-if="permissions.length"
        ><FormShell
          v-if="section !== 'audit'"
          class="data-toolbar"
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
                : 'شناسه، نام کاربری، شمارهٔ کامل همراه یا یادداشت'
            "
            dir="ltr"
            maxlength="128"
          /><button class="button secondary">جست‌وجو</button
          ><button type="button" class="button secondary" @click="load">تازه‌سازی</button>
        </FormShell>
        <div v-if="!rows.length && !busy" class="panel empty">موردی برای نمایش پیدا نشد.</div>
        <div
          v-else-if="rows.length && !busy"
          class="table-scroll"
          tabindex="0"
          aria-label="جدول مدیریت"
        >
          <table>
            <caption class="sr-only">
              {{
                title
              }}
            </caption>
            <thead>
              <tr>
                <th>{{ section === 'products' ? 'محصول' : 'دستگاه / شناسه' }}</th>
                <th v-if="section === 'products'">قیمت و عرضه</th>
                <th v-else-if="section === 'audit'">فعالیت</th>
                <th v-else>وضعیت</th>
                <th>جزئیات</th>
                <th v-if="section !== 'audit'">یادداشت داخلی</th>
                <th v-if="section !== 'audit'">عملیات</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="String(row.id ?? index)">
                <td>
                  <template v-if="section === 'products'"
                    ><b>{{ row.title_fa }}</b
                    ><small dir="ltr">{{ row.sku }}</small></template
                  ><template v-else
                    ><b dir="ltr">{{ row.username ?? row.entity_id ?? row.device_id }}</b
                    ><small dir="ltr">{{ row.id }}</small></template
                  >
                </td>
                <td>
                  <template v-if="section === 'products'"
                    ><b>{{ toman(Number(row.price_irr)) }} تومان</b
                    ><small>{{ state(row.publication_status) }}</small></template
                  ><template v-else-if="section === 'audit'"
                    ><b dir="ltr">{{ row.action }}</b
                    ><small>{{ row.actor_type }}</small></template
                  ><template v-else-if="section === 'trials'"
                    ><b
                      >{{ new Intl.NumberFormat('fa-IR').format(2 - Number(row.used)) }} فرصت
                      باقی‌مانده</b
                    ><small
                      >دورهٔ آزمایشی
                      {{
                        new Intl.NumberFormat('fa-IR').format(Number(row.allocation_epoch))
                      }}</small
                    ></template
                  ><template v-else-if="section === 'devices'"
                    ><b
                      >{{ new Intl.NumberFormat('fa-IR').format(Number(row.profiles)) }} پروفایل
                      فعال</b
                    ><small>{{
                      row.customer_state ? 'حساب متصل' : 'بدون حساب متصل'
                    }}</small></template
                  ><span v-else class="badge">{{ state(row.state ?? row.status) }}</span>
                </td>
                <td>
                  <template v-if="section === 'products'"
                    ><small>فروش: {{ row.sale_enabled ? 'فعال' : 'غیرفعال' }}</small
                    ><small>آزمایش: {{ row.trial_enabled ? 'فعال' : 'غیرفعال' }}</small
                    ><small
                      >فعال‌سازی: {{ row.activation_enabled ? 'فعال' : 'غیرفعال' }}</small
                    ></template
                  ><template v-else-if="section === 'devices'"
                    ><small
                      v-for="restriction in row.restrictions as { sku: string; blocked: boolean }[]"
                      :key="restriction.sku"
                      ><span dir="ltr">{{ restriction.sku }}</span
                      >: {{ restriction.blocked ? 'مسدود' : 'آزاد' }}</small
                    >
                    <details v-if="(row.profile_details as Row[])?.length">
                      <summary>پروفایل‌های ویندوز</summary>
                      <small
                        v-for="profile in row.profile_details as Row[]"
                        :key="String(profile.id)"
                        dir="ltr"
                        >{{ profile.id }} · {{ state(profile.status) }}</small
                      >
                    </details></template
                  ><template v-else
                    ><span v-if="row.sku" dir="ltr">{{ row.sku }}</span
                    ><small v-if="row.generation"
                      >نسل حساب:
                      {{ new Intl.NumberFormat('fa-IR').format(Number(row.generation)) }}</small
                    ><small v-if="row.decision_version"
                      >نسخهٔ تصمیم: {{ row.decision_version }}</small
                    ><small v-if="row.created_at">{{
                      new Date(String(row.created_at)).toLocaleDateString('fa-IR')
                    }}</small></template
                  >
                </td>
                <td v-if="section !== 'audit'">
                  <p class="note-preview">
                    {{ String(row.note ?? '').slice(0, 100) || 'یادداشتی ثبت نشده' }}
                  </p>
                  <button type="button" class="button secondary" @click="editNote(row)">
                    {{
                      allowed('notes.manage') ? 'مشاهده و ویرایش یادداشت' : 'مشاهدهٔ یادداشت'
                    }}</button
                  ><small v-if="row.mobile_masked" dir="ltr">{{ row.mobile_masked }}</small>
                </td>
                <td v-if="section !== 'audit'">
                  <div class="table-actions">
                    <button
                      v-if="section === 'products' && allowed('products.manage')"
                      class="button secondary"
                      @click="open('product', row)"
                    >
                      ویرایش محصول</button
                    ><template v-if="section === 'customers' && row.state === 'ACTIVE'"
                      ><button
                        v-if="allowed('customers.reset')"
                        class="button secondary"
                        @click="open('reset', row)"
                      >
                        بازنشانی حساب</button
                      ><button
                        v-if="allowed('support.password_reset')"
                        class="button secondary"
                        @click="open('password-reset', row)"
                      >
                        بازیابی رمز عبور
                      </button></template
                    ><template v-if="section === 'devices'"
                      ><button
                        v-if="allowed('device_products.block')"
                        class="button secondary"
                        @click="open('block', row)"
                      >
                        محدود کردن پایه</button
                      ><button
                        v-if="allowed('device_products.unblock')"
                        class="button secondary"
                        @click="open('unblock', row)"
                      >
                        رفع محدودیت</button
                      ><button
                        v-if="allowed('licenses.issue') && row.customer_id"
                        class="button secondary"
                        @click="open('issue', row)"
                      >
                        ثبت مجوز خرید</button
                      ><button
                        v-if="allowed('activation_codes.issue') && row.customer_id"
                        class="button secondary"
                        @click="open('code', row)"
                      >
                        ساخت کد فعال‌سازی
                      </button></template
                    ><template v-if="section === 'licenses'"
                      ><button
                        v-if="allowed('licenses.revoke') && row.state === 'ACTIVE'"
                        class="button secondary"
                        @click="open('revoke', row)"
                      >
                        لغو اعتبار مجوز</button
                      ><button
                        v-if="allowed('licenses.reissue')"
                        class="button secondary"
                        @click="open('reissue', row)"
                      >
                        بازیابی مجوز خرید
                      </button></template
                    ><button
                      v-if="section === 'trials' && allowed('trials.reset')"
                      class="button secondary"
                      @click="open('trial', row)"
                    >
                      دو فرصت تازه</button
                    ><button
                      v-if="
                        section === 'activation-codes' &&
                        allowed('activation_codes.cancel') &&
                        row.status === 'ISSUED'
                      "
                      class="button secondary"
                      @click="open('cancel', row)"
                    >
                      لغو کد
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="section !== 'audit'" class="pagination">
          <button
            :disabled="offset === 0"
            class="button secondary"
            @click="
              offset = Math.max(0, offset - 20);
              load();
            "
          >
            صفحهٔ قبل</button
          ><button
            :disabled="next === null"
            class="button secondary"
            @click="
              offset = next ?? offset;
              load();
            "
          >
            صفحهٔ بعد
          </button>
        </div></template
      >
    </div>
    <BaseDialog v-model="notesOpen" title="یادداشت داخلی"
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
        <p v-else-if="kind === 'reissue'" class="notice">
          فقط بازیابی مجوز همان شناسه با نسخهٔ تصمیم تازه ممکن است. جایگزینی میان شناسه‌های متفاوت
          پشتیبانی نمی‌شود.
        </p>
        <template v-if="kind === 'product'"
          ><label
            >قیمت به تومان<input
              v-model.number="product.price"
              type="number"
              min="0"
              step="0.1"
              required /></label
          ><label
            >وضعیت عرضه<select v-model="product.publication_status">
              <option value="published">عرضه‌شده</option>
              <option value="coming_soon">به‌زودی</option>
              <option value="hidden">پنهان</option>
            </select></label
          ><label class="check-label"
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
        ><label v-if="['block', 'unblock', 'issue', 'code'].includes(kind)"
          >پایهٔ موردنظر<select v-model="targetSku">
            <option v-for="(name, i) in gradeNames" :key="i" :value="`YARIZAN-G${i + 1}`">
              پایهٔ {{ name }}
            </option>
          </select></label
        ><label
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
          :class="['reset', 'block', 'revoke', 'cancel'].includes(kind) ? 'destructive' : 'primary'"
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
