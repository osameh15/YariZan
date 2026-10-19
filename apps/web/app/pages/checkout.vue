<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { errorMessage, toman } from '#shared/domain';
import { endsLabel } from '#shared/promotion';
import type { ApiResult } from '#shared/api';
const api = useApi(),
  route = useRoute(),
  coupon = ref(''),
  quoted = ref(''),
  productTitle = ref('خلاصهٔ سفارش'),
  loading = ref(false),
  creating = ref(false),
  busy = computed(() => loading.value || creating.value),
  message = ref('');
const quote = ref<ApiResult<'/api/v2/discounts/quote', 'post'>>();
const sku = String(route.query.sku ?? 'YARIZAN-G1');
if (!/^YARIZAN-G[1-6]$/.test(sku)) throw createError({ statusCode: 404 });
const requestId = ref('');
let quoteGeneration = 0;
const canCreate = computed(
  () => !busy.value && !!quote.value && coupon.value.trim() === quoted.value,
);
// Editing invalidates even an A -> B -> A request; only a fresh quote can authorize checkout.
watch(
  coupon,
  () => {
    quoteGeneration++;
    quote.value = undefined;
    message.value = '';
    loading.value = false;
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => {
  quoteGeneration++;
});
async function load() {
  if (creating.value) return;
  const generation = ++quoteGeneration;
  const submittedCoupon = coupon.value.trim();
  const current = () => generation === quoteGeneration && coupon.value.trim() === submittedCoupon;
  loading.value = true;
  quote.value = undefined;
  message.value = '';
  try {
    const result = await api.post('/api/v2/discounts/quote', {
      sku,
      coupon: submittedCoupon || undefined,
    });
    if (!current()) return;
    quote.value = result;
    productTitle.value = result.title_fa;
    quoted.value = submittedCoupon;
  } catch (e) {
    if (!current()) return;
    quote.value = undefined;
    message.value = errorMessage(e);
    if ((e as { status?: number }).status === 401)
      await navigateTo('/login?return=' + encodeURIComponent('/checkout?sku=' + sku));
  } finally {
    if (current()) loading.value = false;
  }
}
async function create() {
  if (!canCreate.value) return;
  const acceptedCoupon = quoted.value;
  creating.value = true;
  message.value = '';
  try {
    requestId.value ||= crypto.randomUUID();
    const o = await api.post('/api/v2/orders', {
      request_id: requestId.value,
      sku,
      coupon: acceptedCoupon || undefined,
    });
    await navigateTo('/account/orders/' + o.id);
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    creating.value = false;
  }
}
onMounted(load);
useSeoMeta({ title: 'بررسی سفارش | یاریزان' });
</script>
<template>
  <section class="wrap section checkout-page">
    <NuxtLink class="text-link" to="/products">بازگشت به پایه‌ها ←</NuxtLink>
    <header class="checkout-heading">
      <p class="eyebrow">یک قدم تا دنیای بازی و یادگیری</p>
      <h1>یک پایه، یک دنیای تازه</h1>
      <p>سفارش را بررسی کنید؛ مجوز این پایه برای دستگاه شما ثبت می‌شود.</p>
    </header>
    <div class="commerce-layout checkout-grid">
      <div class="checkout-main">
        <article class="checkout-product">
          <div class="checkout-cover" aria-hidden="true">
            <img src="/brand/symbol.webp" width="56" height="56" alt="" />
            <strong>{{ new Intl.NumberFormat('fa-IR').format(Number(sku.slice(-1))) }}</strong>
            <span>بازی و یادگیری</span>
          </div>
          <div>
            <span class="badge available">مجوز دائمی · ویژهٔ یک دستگاه</span>
            <h2>{{ productTitle }}</h2>
            <p>پس از دریافت و فعال‌سازی مجوز معتبر، همین پایه همیشه آفلاین در دسترس است.</p>
            <span class="muted"
              >نسخهٔ ویندوز <bdi>{{ persianDigits(sku) }}</bdi></span
            >
          </div>
        </article>
        <section class="coupon-panel" aria-labelledby="coupon-title">
          <header>
            <h2 id="coupon-title">کد تخفیف دارید؟</h2>
            <span class="muted">اختیاری</span>
          </header>
          <p v-if="quote?.promotion" class="notice" role="status" data-testid="promotion-no-coupon">
            این پایه با قیمت ویژه عرضه می‌شود؛ کد تخفیف روی قیمت ویژه قابل استفاده نیست.
          </p>
          <FormShell class="coupon-form" @submit="load">
            <label
              >کد تخفیف<input
                v-model="coupon"
                :disabled="creating || !!quote?.promotion"
                dir="ltr"
                maxlength="64"
                pattern="[A-Za-z0-9_-]*"
                data-format-message="کد تخفیف را با حروف و اعداد انگلیسی وارد کنید."
                autocomplete="off"
                placeholder="YARIZAN"
            /></label>
            <button class="button secondary" :disabled="busy || !!quote?.promotion">
              {{ busy ? 'در حال بررسی…' : 'بررسی کد تخفیف' }}
            </button>
          </FormShell>
          <ApiNotice :message="message" />
          <template v-if="quote && quote.discount_irr > 0">
            <ApiNotice
              kind="success"
              message="کد تخفیف قابل استفاده است؛ سهمیه هنگام ثبت سفارش رزرو می‌شود."
            />
          </template>
          <button
            v-if="coupon.trim()"
            class="text-link"
            type="button"
            :disabled="busy"
            @click="
              coupon = '';
              load();
            "
          >
            حذف کد تخفیف
          </button>
        </section>
        <div class="purchase-principles">
          <div>
            <span aria-hidden="true">۱</span>
            <div>
              <h3>برای همین پایه و دستگاه</h3>
              <p>هر پایه مجوز مستقل دارد. مجوز به دستگاه تأییدشدهٔ حساب شما متصل است.</p>
            </div>
          </div>
          <div>
            <span aria-hidden="true">۲</span>
            <div>
              <h3>یک‌بار فعال‌سازی، بازی آفلاین</h3>
              <p>اینترنت برای دریافت نخستین مجوز لازم است؛ اجرای بعدی با مجوز معتبر، آفلاین است.</p>
            </div>
          </div>
        </div>
        <NuxtLink class="text-link" to="/support"
          >راهنمای خرید و شرایط درخواست بازپرداخت ↗</NuxtLink
        >
      </div>
      <aside class="order-summary" aria-labelledby="summary-title" :aria-busy="busy">
        <p class="eyebrow">شفاف، پیش از ادامه</p>
        <h2 id="summary-title">خلاصهٔ سفارش</h2>
        <template v-if="quote">
          <dl class="commerce-totals">
            <div>
              <dt>{{ quote.promotion ? 'قیمت اصلی' : 'قیمت پایه' }}</dt>
              <dd>
                <s v-if="quote.promotion">{{ toman(quote.subtotal_irr) }} تومان</s
                ><template v-else>{{ toman(quote.subtotal_irr) }} تومان</template>
              </dd>
            </div>
            <div
              :class="{ 'discount-applied': quote.discount_irr > 0 }"
              :data-testid="quote.promotion ? 'promotion-discount' : undefined"
            >
              <dt>
                {{
                  quote.promotion
                    ? 'تخفیف قیمت ویژه (' + persianDigits(quote.promotion.discount_percent) + '٪)'
                    : 'تخفیف'
                }}
              </dt>
              <dd>{{ toman(quote.discount_irr) }} تومان</dd>
            </div>
            <div v-if="quote.promotion" class="promo-ends-row">
              <dt>پایان قیمت ویژه</dt>
              <dd>{{ endsLabel(quote.promotion.ends_at) }}</dd>
            </div>
            <div class="payable-total">
              <dt>مبلغ قابل پرداخت</dt>
              <dd>{{ toman(quote.total_irr) }} <small>تومان</small></dd>
            </div>
          </dl>
          <div class="simulation-note">
            <span class="badge">پرداخت آزمایشی</span>
            <p>محیط آزمایشی: پرداخت کاملاً شبیه‌سازی می‌شود و هیچ پولی جابه‌جا نخواهد شد.</p>
            <small>درگاه: شبیه‌ساز زرین‌پال · پول واقعی دریافت نمی‌شود.</small>
          </div>
          <button class="button primary checkout-submit" :disabled="!canCreate" @click="create">
            ثبت سفارش و بررسی پرداخت <span aria-hidden="true">←</span>
          </button>
          <p v-if="coupon.trim() !== quoted" class="muted" role="status">
            برای ادامه، تغییر کد تخفیف را بررسی کنید.
          </p>
          <p class="summary-footnote">
            قیمت و تخفیف را سرور محاسبه می‌کند. مبلغ نهایی را پیش از شروع پرداخت دوباره خواهید دید.
          </p>
        </template>
        <template v-else
          ><p class="muted">برای ادامه، مبلغ سفارش باید از سرور دریافت شود.</p>
          <button class="button secondary" :disabled="busy" @click="load">
            تلاش دوباره
          </button></template
        >
      </aside>
    </div>
  </section>
</template>
