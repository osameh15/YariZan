<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { errorMessage, toman } from '#shared/domain';
import { percentOff, minimumChargeIrr } from '#shared/promotion';

// Admin pricing editor: per-product promotions. The list price is read-only here (a list price
// revision is a separate audited action on the product, refused while a promotion is scheduled or
// active). The percentage shown while typing is only a preview; the Backend derives and stores the
// authoritative percentage from the two integer IRR prices, and decides activation and expiry on
// database time.
type Promotion = {
  id: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  state: 'ENABLED' | 'DISABLED';
  revision: number;
  original_price_irr: number;
  promo_price_irr: number;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  reason: string;
};
type HistoryRow = {
  promotion_id: string;
  revision: number;
  action: string;
  reason: string;
  admin_username: string;
  created_at: string;
};
const props = defineProps<{
  sku: string;
  title: string;
  grade: number;
  listPriceIrr: number;
  productRevision: number;
  published: boolean;
}>();
const emit = defineEmits<{ changed: [] }>();
const api = useApi(true);
const promotions = ref<Promotion[]>([]),
  history = ref<HistoryRow[]>([]),
  loading = ref(true),
  saving = ref(false),
  feedback = ref(''),
  ok = ref(false),
  mode = ref<'create' | 'edit' | 'end'>('create'),
  editing = ref<Promotion | null>(null),
  price = ref(0), // Toman
  startNow = ref(true),
  startsAt = ref(''),
  endsAt = ref(''),
  reason = ref(''),
  confirm = ref(false),
  requestId = ref(crypto.randomUUID()),
  formKey = ref(0),
  currentRevision = ref(props.productRevision);
const statusLabel: Record<string, string> = {
  SCHEDULED: 'زمان‌بندی‌شده',
  ACTIVE: 'فعال',
  EXPIRED: 'پایان‌یافته',
  DISABLED: 'غیرفعال',
};
const irr = computed(() => Math.round(Number(price.value) * 10));
const validPrice = computed(
  () =>
    Number.isSafeInteger(irr.value) &&
    irr.value >= minimumChargeIrr &&
    irr.value < props.listPriceIrr,
);
const percent = computed(() =>
  validPrice.value ? percentOff(props.listPriceIrr, irr.value) : null,
);
const iso = (local: string) => new Date(local).toISOString();
const ended = computed(() => !!endsAt.value && !Number.isNaN(new Date(endsAt.value).getTime()));
const windowError = computed(() => {
  if (!ended.value) return '';
  const end = new Date(endsAt.value).getTime();
  const start = startNow.value || !startsAt.value ? Date.now() : new Date(startsAt.value).getTime();
  if (end <= start) return 'پایان باید بعد از شروع باشد.';
  if (end - start > 366 * 86400000) return 'بازهٔ قیمت ویژه از یک سال بیشتر نیست.';
  return '';
});
const preview = computed(() =>
  validPrice.value && ended.value && !windowError.value
    ? {
        price_irr: irr.value,
        original_price_irr: props.listPriceIrr,
        discount_percent: percent.value!,
        starts_at: new Date().toISOString(),
        ends_at: iso(endsAt.value),
      }
    : null,
);
const previewProduct = computed(() => ({
  sku: props.sku,
  grade: props.grade,
  title_fa: props.title,
  price_irr: props.listPriceIrr,
  publication_status: (props.published ? 'published' : 'coming_soon') as
    'published' | 'coming_soon',
  sale_enabled: false,
  trial_enabled: false,
  activation_enabled: false,
  revision: 1,
  promotion: props.published ? preview.value : null,
}));
const canSubmit = computed(
  () =>
    !saving.value &&
    reason.value.trim().length >= 8 &&
    confirm.value &&
    (mode.value === 'end'
      ? ended.value && !windowError.value
      : validPrice.value && ended.value && !windowError.value),
);
async function load() {
  loading.value = true;
  try {
    const r = (await api.get('/api/v2/admin/products/{sku}/promotions', {
      sku: props.sku,
    })) as unknown as {
      promotions: Promotion[];
      history: HistoryRow[];
    };
    promotions.value = r.promotions;
    history.value = r.history;
  } catch (e) {
    feedback.value = errorMessage(e);
    ok.value = false;
  } finally {
    loading.value = false;
  }
}
function reset(next: 'create' | 'edit' | 'end' = 'create', row: Promotion | null = null) {
  mode.value = next;
  editing.value = row;
  price.value = row ? row.promo_price_irr / 10 : 0;
  startNow.value = !row || next === 'end';
  startsAt.value = '';
  endsAt.value = '';
  reason.value = '';
  confirm.value = false;
  requestId.value = crypto.randomUUID();
  // A fresh form: no leftover validation messages after a successful save.
  formKey.value++;
}
async function refreshRevision() {
  // A list price or product change moves the product revision; reload before the next save.
  const r = (await api.get('/api/v2/admin/products', undefined, { limit: 50 })) as {
    items: Record<string, unknown>[];
  };
  const row = r.items.find((p) => p.sku === props.sku);
  if (row) currentRevision.value = Number(row.revision);
}
async function submit() {
  if (!canSubmit.value) return;
  saving.value = true;
  feedback.value = '';
  const base = { request_id: requestId.value, reason: reason.value.trim() };
  try {
    if (mode.value === 'create')
      await api.post(
        '/api/v2/admin/products/{sku}/promotions',
        {
          ...base,
          expected_revision: currentRevision.value,
          promo_price_irr: irr.value,
          ...(startNow.value || !startsAt.value ? {} : { starts_at: iso(startsAt.value) }),
          ends_at: iso(endsAt.value),
        },
        { sku: props.sku },
      );
    else
      await api.patch(
        '/api/v2/admin/promotions/{id}',
        {
          ...base,
          expected_revision: editing.value!.revision,
          ...(mode.value === 'edit'
            ? {
                promo_price_irr: irr.value,
                ...(startNow.value || !startsAt.value ? {} : { starts_at: iso(startsAt.value) }),
              }
            : {}),
          ends_at: iso(endsAt.value),
        },
        { id: editing.value!.id },
      );
    feedback.value = 'قیمت ویژه ثبت شد و در گزارش فعالیت نگهداری می‌شود.';
    ok.value = true;
    reset();
    await load();
    emit('changed');
  } catch (e) {
    feedback.value = errorMessage(e);
    ok.value = false;
    if ((e as { data?: { error?: { code?: string } } })?.data?.error?.code === 'STALE_REVISION') {
      await refreshRevision();
      await load();
    }
  } finally {
    saving.value = false;
  }
}
async function decide(row: Promotion, action: 'deactivate' | 'restore') {
  if (saving.value) return;
  if (reason.value.trim().length < 8) {
    feedback.value = 'دلیل تغییر را بنویسید (دست‌کم ۸ نویسه).';
    ok.value = false;
    return;
  }
  saving.value = true;
  feedback.value = '';
  try {
    await api.post(
      action === 'deactivate'
        ? '/api/v2/admin/promotions/{id}/deactivate'
        : '/api/v2/admin/promotions/{id}/restore',
      {
        request_id: crypto.randomUUID(),
        reason: reason.value.trim(),
        expected_revision: row.revision,
      },
      { id: row.id },
    );
    feedback.value =
      action === 'deactivate'
        ? 'قیمت ویژه غیرفعال شد؛ سفارش‌های تازه با قیمت اصلی محاسبه می‌شوند. سفارش‌های ثبت‌شده تغییر نمی‌کنند.'
        : 'قیمت ویژه بازگردانده شد.';
    ok.value = true;
    reason.value = '';
    await load();
    emit('changed');
  } catch (e) {
    feedback.value = errorMessage(e);
    ok.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
const date = (value: string) =>
  persianDigits(
    new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Tehran',
    }).format(new Date(value)),
  );
const actionLabel: Record<string, string> = {
  CREATED: 'ثبت',
  UPDATED: 'ویرایش',
  DEACTIVATED: 'غیرفعال‌سازی',
  RESTORED: 'بازگردانی',
};
onMounted(load);
</script>
<template>
  <div class="promotion-editor" data-testid="promotion-editor">
    <p class="muted">
      قیمت اصلی (فهرست):
      <b data-testid="promo-list-price">{{ toman(listPriceIrr) }} تومان</b>
      · قیمت ویژه روی قیمت‌های تازه اثر می‌گذارد و سفارش‌های قبلی را عوض نمی‌کند. سرور درصد، شروع و
      پایان را با زمان پایگاه داده تعیین می‌کند. قیمت ویژه با کد تخفیف جمع نمی‌شود. ثبت قیمت ویژه،
      فروش، آزمایش، فعال‌سازی یا پرداخت را فعال نمی‌کند.
    </p>

    <section aria-labelledby="promo-list-title">
      <h3 id="promo-list-title">قیمت‌های ویژهٔ {{ title }}</h3>
      <p v-if="loading" role="status">در حال دریافت…</p>
      <p v-else-if="!promotions.length" class="muted" data-testid="promo-empty">
        هنوز قیمت ویژه‌ای ثبت نشده است.
      </p>
      <ul v-else class="promotion-list">
        <li
          v-for="p in promotions"
          :key="p.id"
          :data-status="p.status"
          :data-testid="'promotion-' + p.status.toLowerCase()"
        >
          <span class="badge" :class="p.status === 'ACTIVE' ? 'available' : 'neutral'">{{
            statusLabel[p.status]
          }}</span>
          <b>{{ toman(p.promo_price_irr) }} تومان</b>
          <s class="muted">{{ toman(p.original_price_irr) }}</s>
          <span class="discount-badge">{{ persianDigits(p.discount_percent) }}٪</span>
          <small>{{ date(p.starts_at) }} تا {{ date(p.ends_at) }}</small>
          <span class="table-actions">
            <button
              v-if="p.status === 'SCHEDULED'"
              type="button"
              class="button secondary"
              @click="reset('edit', p)"
            >
              ویرایش
            </button>
            <button
              v-if="p.status === 'ACTIVE'"
              type="button"
              class="button secondary"
              @click="reset('end', p)"
            >
              تغییر زمان پایان
            </button>
            <button
              v-if="p.state === 'ENABLED' && p.status !== 'EXPIRED'"
              type="button"
              class="button secondary"
              :disabled="saving"
              @click="decide(p, 'deactivate')"
            >
              غیرفعال‌سازی
            </button>
            <button
              v-if="p.state === 'DISABLED' && p.status !== 'EXPIRED'"
              type="button"
              class="button secondary"
              :disabled="saving"
              @click="decide(p, 'restore')"
            >
              بازگردانی
            </button>
          </span>
        </li>
      </ul>
    </section>

    <FormShell :key="formKey" class="promotion-form" @submit.prevent="submit">
      <fieldset :disabled="saving">
        <legend>
          {{
            mode === 'create'
              ? 'ثبت یا زمان‌بندی قیمت ویژه'
              : mode === 'edit'
                ? 'ویرایش قیمت ویژهٔ زمان‌بندی‌شده'
                : 'تغییر زمان پایان قیمت ویژهٔ فعال'
          }}
        </legend>
        <template v-if="mode !== 'end'">
          <NumberStepper
            v-model="price"
            :min="minimumChargeIrr / 10"
            step="1"
            required
            label="قیمت ویژه به تومان"
          />
          <p class="field-hint" role="status" data-testid="promo-percent">
            <template v-if="percent !== null"
              >تخفیف: <b>{{ persianDigits(percent) }}٪</b> (پیش‌نمایش؛ سرور محاسبهٔ نهایی را ثبت
              می‌کند)</template
            ><template v-else
              >قیمت ویژه باید عددی صحیح، کمتر از قیمت اصلی و دست‌کم
              {{ toman(minimumChargeIrr) }} تومان باشد.</template
            >
          </p>
          <label class="check"
            ><input v-model="startNow" type="checkbox" /> شروع از همین لحظه (زمان سرور)</label
          >
          <PersianDatePicker v-if="!startNow" v-model="startsAt" label="شروع (زمان محلی)" time />
        </template>
        <PersianDatePicker v-model="endsAt" label="پایان (زمان محلی، الزامی)" time required />
        <p v-if="windowError" class="field-hint" role="alert">{{ windowError }}</p>
        <label
          >دلیل تغییر (برای گزارش فعالیت)
          <textarea v-model="reason" required minlength="8" maxlength="512" rows="2" />
        </label>
        <label class="check"
          ><input v-model="confirm" type="checkbox" required /> تأیید می‌کنم که این تغییر مبلغ
          پایه‌های تازه را عوض می‌کند و سفارش‌های ثبت‌شده را عوض نمی‌کند.</label
        >
        <div v-if="preview" class="promotion-preview" data-testid="promo-preview">
          <p class="eyebrow">پیش‌نمایش کارت محصول</p>
          <ProductCard :product="previewProduct" public-only />
        </div>
        <button class="button primary" :disabled="!canSubmit">
          {{ saving ? 'در حال ثبت…' : mode === 'create' ? 'ثبت قیمت ویژه' : 'ذخیرهٔ تغییر' }}
        </button>
        <button v-if="mode !== 'create'" type="button" class="button secondary" @click="reset()">
          انصراف از ویرایش
        </button>
      </fieldset>
    </FormShell>
    <p v-if="feedback" :class="ok ? 'notice' : 'notice error'" :role="ok ? 'status' : 'alert'">
      {{ feedback }}
    </p>

    <section v-if="history.length" aria-labelledby="promo-history-title">
      <h3 id="promo-history-title">سابقهٔ تغییرات و تأییدکننده</h3>
      <ul class="record-list">
        <li v-for="h in history" :key="h.promotion_id + h.revision">
          {{ actionLabel[h.action] ?? h.action }} · نسخهٔ {{ persianDigits(h.revision) }} ·
          <bdi dir="ltr">{{ h.admin_username }}</bdi> · {{ date(h.created_at) }} — {{ h.reason }}
        </li>
      </ul>
    </section>
  </div>
</template>
