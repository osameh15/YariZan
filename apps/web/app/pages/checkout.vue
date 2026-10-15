<script setup lang="ts">
import { errorMessage, toman } from '#shared/domain';
import type { ApiResult } from '#shared/api';
const api = useApi(),
  route = useRoute(),
  coupon = ref(''),
  quoted = ref(''),
  busy = ref(false),
  message = ref('');
const quote = ref<ApiResult<'/api/v2/discounts/quote', 'post'>>();
const sku = String(route.query.sku ?? 'YARIZAN-G1');
if (!/^YARIZAN-G[1-6]$/.test(sku)) throw createError({ statusCode: 404 });
const requestId = ref('');
async function load() {
  busy.value = true;
  message.value = '';
  try {
    quote.value = await api.post('/api/v2/discounts/quote', {
      sku,
      coupon: coupon.value.trim() || undefined,
    });
    quoted.value = coupon.value.trim();
  } catch (e) {
    quote.value = undefined;
    message.value = errorMessage(e);
    if ((e as { status?: number }).status === 401)
      await navigateTo('/login?return=' + encodeURIComponent('/checkout?sku=' + sku));
  } finally {
    busy.value = false;
  }
}
async function create() {
  busy.value = true;
  message.value = '';
  try {
    requestId.value ||= crypto.randomUUID();
    const o = await api.post('/api/v2/orders', {
      request_id: requestId.value,
      sku,
      coupon: quoted.value || undefined,
    });
    await navigateTo('/account/orders/' + o.id);
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
useSeoMeta({ title: 'بررسی سفارش | یاریزان' });
</script>
<template>
  <section class="wrap section commerce-layout">
    <div>
      <p class="eyebrow">سفارش برای دستگاه شما</p>
      <h1>یک پایه، یک دنیای تازه</h1>
      <p class="hero-lead">
        مجوز خرید فقط برای همین دستگاه و پایه ثبت می‌شود. پس از فعال‌سازی، بازی با مجوز معتبر به
        اینترنت نیاز ندارد.
      </p>
      <ApiNotice
        kind="info"
        message="محیط آزمایشی: پرداخت کاملاً شبیه‌سازی می‌شود و هیچ پولی جابه‌جا نخواهد شد."
      />
      <p>
        قیمت و تخفیف را سرور محاسبه می‌کند. پیش از ادامه، مبلغ نهایی سفارش ثبت‌شده را دوباره خواهید
        دید.
      </p>
      <NuxtLink class="text-link" to="/support">راهنمای خرید و شرایط درخواست بازپرداخت</NuxtLink>
    </div>
    <div class="panel">
      <h2>{{ quote?.title_fa ?? 'خلاصهٔ سفارش' }}</h2>
      <FormShell @submit="load"
        ><label
          >کد تخفیف<input
            v-model="coupon"
            dir="ltr"
            maxlength="64"
            pattern="[A-Za-z0-9_-]*"
            data-format-message="کد تخفیف را با حروف و اعداد انگلیسی وارد کنید."
            autocomplete="off" /></label
        ><button class="button secondary" :disabled="busy">بررسی کد تخفیف</button></FormShell
      >
      <ApiNotice :message="message" /><template v-if="quote"
        ><dl class="commerce-totals">
          <div>
            <dt>قیمت پایه</dt>
            <dd>{{ toman(quote.subtotal_irr) }} تومان</dd>
          </div>
          <div>
            <dt>تخفیف</dt>
            <dd>{{ toman(quote.discount_irr) }} تومان</dd>
          </div>
          <div>
            <dt>مبلغ قابل پرداخت</dt>
            <dd>{{ toman(quote.total_irr) }} تومان</dd>
          </div>
        </dl>
        <ApiNotice
          v-if="quote.discount_irr > 0"
          kind="success"
          message="کد تخفیف قابل استفاده است؛ سهمیه هنگام ثبت سفارش رزرو می‌شود."
        />
        <p class="muted">درگاه: شبیه‌ساز زرین‌پال · پول واقعی دریافت نمی‌شود.</p>
        <button class="button primary" :disabled="busy || coupon.trim() !== quoted" @click="create">
          ثبت سفارش و بررسی پرداخت
        </button></template
      >
      <button v-else class="button secondary" :disabled="busy" @click="load">تلاش دوباره</button>
    </div>
  </section>
</template>
