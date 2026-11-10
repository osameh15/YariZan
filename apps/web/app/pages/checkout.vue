<script setup lang="ts">
import { productSkuPattern, standaloneProduct } from '#shared/products';
import { persianDigits } from '#shared/digits';
import { errorMessage, toman } from '#shared/domain';
import { endsLabel } from '#shared/promotion';
import type { ApiResult } from '#shared/api';
import { MERCHANT } from '#shared/contact';
import { productDownloadPath } from '#shared/product-download';
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
if (!productSkuPattern.test(sku)) throw createError({ statusCode: 404 });
const special = standaloneProduct(sku);
// Independent games have no grade: the wording and the cover follow the product type.
const unit = special ? 'بازی' : 'پایه';
const requestId = ref('');
// The license binds to the device this browser session belongs to; say which one, before payment.
const device = ref<{ username: string; label: string | null }>();
async function loadDevice() {
  try {
    device.value = await api.get('/api/v2/account');
  } catch (error) {
    message.value = errorMessage(error);
    if ((error as { status?: number }).status === 401)
      await navigateTo('/login?return=' + encodeURIComponent('/checkout?sku=' + sku));
  }
}
let quoteGeneration = 0;
// The order always uses the last server-validated coupon (`quoted`), which is exactly the price
// shown. Typing in the coupon box changes nothing until the customer asks for a check; a rejected
// code leaves the validated price and the payment button as they were.
const canCreate = computed(() => !busy.value && !!quote.value && !quote.value.already_owned);
// Editing makes any in-flight check obsolete, so a late answer for older text is ignored.
watch(
  coupon,
  () => {
    quoteGeneration++;
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
  message.value = '';
  try {
    if (!device.value) {
      await loadDevice();
      if (!device.value) return;
    }
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
    if (
      quote.value &&
      (e as { data?: { error?: { code?: string } } }).data?.error?.code === 'ALREADY_OWNED'
    ) {
      quote.value = { ...quote.value, already_owned: true };
      return;
    }
    // An unpaid invoice for this grade that never went to the bank: continue with it instead.
    if ((e as { data?: { error?: { code?: string } } }).data?.error?.code === 'ORDER_ALREADY_OPEN')
      try {
        const mine = await api.get('/api/v2/account/orders', undefined, { limit: 50 });
        const open = mine.items.find((r) => r.sku === sku && r.state === 'PENDING');
        if (open) {
          await navigateTo('/account/orders/' + String(open.id) + '?existing=1');
          return;
        }
      } catch {
        /* Fall through to the message. */
      }
    message.value = errorMessage(e);
  } finally {
    creating.value = false;
  }
}
// Payment wording follows the real mode: live, local sandbox or local simulator.
const { test, sandbox } = useCommerceMode();
const PAYMENT_PROVIDER = MERCHANT.paymentProviderFa;
onMounted(() => {
  void load();
});
useSeoMeta({ title: 'بررسی سفارش | یاریزان' });
</script>
<template>
  <section class="wrap section checkout-page">
    <NuxtLink class="text-link" :to="special ? '/special-products' : '/products'"
      >{{ special ? 'بازگشت به محصولات ویژه' : 'بازگشت به پایه‌ها' }} <AppIcon name="back"
    /></NuxtLink>
    <header class="checkout-heading">
      <p class="eyebrow">یک قدم تا دنیای بازی و یادگیری</p>
      <h1>یک {{ unit }}، یک دنیای تازه</h1>
      <p>سفارش را بررسی کنید؛ مجوز این {{ unit }} برای دستگاه شما ثبت می‌شود.</p>
    </header>
    <div class="commerce-layout checkout-grid">
      <div class="checkout-main">
        <article class="checkout-product">
          <div class="checkout-cover" aria-hidden="true">
            <img src="/brand/symbol.webp" width="56" height="56" alt="" />
            <strong>{{
              special?.symbol ?? new Intl.NumberFormat('fa-IR').format(Number(sku.slice(-1)))
            }}</strong>
            <span>بازی و یادگیری</span>
          </div>
          <div>
            <span class="badge available">مجوز دائمی · ویژهٔ یک دستگاه</span>
            <h2>{{ productTitle }}</h2>
            <p>پس از دریافت و فعال‌سازی مجوز معتبر، همین {{ unit }} همیشه آفلاین در دسترس است.</p>
            <span class="muted"
              >نسخهٔ ویندوز <bdi>{{ persianDigits(sku) }}</bdi></span
            >
          </div>
        </article>
        <section v-if="device" class="checkout-device" data-testid="checkout-device">
          <div>
            <p class="eyebrow">مجوز برای این دستگاه ثبت می‌شود</p>
            <strong>{{ device.label || 'دستگاه بدون نام' }}</strong>
            <span class="device-username" dir="ltr">{{ device.username }}</span>
          </div>
          <DeviceSwitcher label="خرید برای دستگاه دیگر" :disabled="busy" />
          <p class="muted">
            اگر بازی را برای رایانهٔ دیگری می‌خواهید، همان دستگاه را بدون خروج از حساب انتخاب کنید.
            نام دستگاه‌ها را در «حساب من ← دستگاه‌های من» می‌توانید تغییر دهید.
          </p>
        </section>
        <section class="coupon-panel" aria-labelledby="coupon-title">
          <header>
            <h2 id="coupon-title">کد تخفیف دارید؟</h2>
            <span class="muted">اختیاری</span>
          </header>
          <p v-if="quote?.promotion" class="notice" role="status" data-testid="promotion-no-coupon">
            این {{ unit }} با قیمت ویژه عرضه می‌شود؛ کد تخفیف روی قیمت ویژه قابل استفاده نیست.
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
          <template v-if="quote && quote.discount_irr > 0 && !message">
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
            <AppIcon name="trash" />
            حذف کد تخفیف
          </button>
        </section>
        <div class="purchase-principles">
          <div>
            <span aria-hidden="true">۱</span>
            <div>
              <h3>برای همین {{ unit }} و دستگاه</h3>
              <p>هر {{ unit }} مجوز مستقل دارد. مجوز به دستگاه تأییدشدهٔ حساب شما متصل است.</p>
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
          >راهنمای خرید و شرایط درخواست بازپرداخت <AppIcon name="external"
        /></NuxtLink>
      </div>
      <aside class="order-summary" aria-labelledby="summary-title" :aria-busy="busy">
        <p class="eyebrow">شفاف، پیش از ادامه</p>
        <h2 id="summary-title">خلاصهٔ سفارش</h2>
        <template v-if="quote">
          <p v-if="quote.test_price" class="notice" role="status" data-testid="test-price-notice">
            قیمت آزمایشی محلی: این مبلغ فقط برای آزمون این محیط است و قیمت رسمی نیست.
          </p>
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
          <div v-if="!quote.already_owned && !test" class="simulation-note">
            <span class="badge">پرداخت امن</span>
            <p>پرداخت در صفحهٔ امن درگاه {{ PAYMENT_PROVIDER }} انجام می‌شود.</p>
          </div>
          <div v-else-if="!quote.already_owned" class="simulation-note">
            <span class="badge">پرداخت آزمایشی</span>
            <template v-if="sandbox">
              <p>
                محیط آزمایشی رسمی زرین‌پال (سندباکس): پرداخت در درگاه آزمایشی انجام می‌شود و هیچ
                پولی جابه‌جا نخواهد شد.
              </p>
              <small>درگاه: سندباکس زرین‌پال · پول واقعی دریافت نمی‌شود.</small>
            </template>
            <template v-else>
              <p>محیط آزمایشی: پرداخت کاملاً شبیه‌سازی می‌شود و هیچ پولی جابه‌جا نخواهد شد.</p>
              <small>درگاه: شبیه‌ساز زرین‌پال · پول واقعی دریافت نمی‌شود.</small>
            </template>
          </div>
          <p
            v-if="quote.already_owned"
            id="checkout-owned"
            class="notice"
            role="status"
            data-testid="checkout-owned"
          >
            این نسخه از بازی {{ special ? productTitle : 'یاریزان' }} بر روی دستگاه شما فعال شده
            است. خرید دوباره برای این دستگاه لازم نیست.
          </p>
          <button
            class="button primary checkout-submit"
            :disabled="!canCreate"
            :aria-describedby="quote.already_owned ? 'checkout-owned' : undefined"
            @click="create"
          >
            ثبت سفارش و بررسی پرداخت <span aria-hidden="true"><AppIcon name="arrow-left" /></span>
          </button>
          <div v-if="quote.already_owned" class="checkout-owned-actions">
            <NuxtLink
              v-if="productDownloadPath(sku)"
              class="button primary"
              :to="productDownloadPath(sku)!"
              >دریافت برنامهٔ ویندوز</NuxtLink
            >
            <NuxtLink class="button secondary" to="/account/licenses">مجوزهای من</NuxtLink>
          </div>
          <p v-if="coupon.trim() && coupon.trim() !== quoted" class="muted" role="status">
            برای اعمال این کد، «بررسی کد تخفیف» را بزنید؛ مبلغ بالا با کد بررسی‌شدهٔ قبلی است.
          </p>
          <p v-if="!quote.already_owned" class="summary-footnote">
            قیمت و تخفیف را سرور محاسبه می‌کند. مبلغ نهایی را پیش از شروع پرداخت دوباره خواهید دید.
          </p>
        </template>
        <template v-else
          ><ApiNotice v-if="message" :message="message" />
          <p v-else class="muted">برای ادامه، مبلغ سفارش باید از سرور دریافت شود.</p>
          <button class="button secondary" :disabled="busy" @click="load">
            تلاش دوباره
          </button></template
        >
      </aside>
    </div>
  </section>
</template>
<style scoped>
.checkout-owned-actions {
  display: grid;
  gap: 12px;
  margin-block-start: 20px;
}
.checkout-owned-actions .button {
  width: 100%;
  margin: 0;
}
</style>
