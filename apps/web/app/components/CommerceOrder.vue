<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { errorMessage, toman } from '#shared/domain';
import { commerceState, paymentNotice } from '#shared/commerce';
import type { ApiResult } from '#shared/api';
import { startPayPattern } from '#shared/payment-return';
const props = defineProps<{ id: string }>(),
  api = useApi(),
  order = ref<ApiResult<'/api/v2/orders/{id}', 'get'>>(),
  busy = ref(false),
  message = ref(''),
  requestId = ref(''),
  refund = ref(''),
  noticeSuccess = ref(false),
  copied = ref(false),
  capabilities = ref<ApiResult<'/api/v2/commerce/capabilities', 'get'> | null>(null);
const sandbox = computed(() => !!capabilities.value?.sandbox);
const simulated = computed(() => capabilities.value?.mode === 'fake');
const live = computed(() => capabilities.value?.real_payments_enabled === true);
// A payment page we may open: the official ZarinPal StartPay for this deployment's mode only
// (production in live mode, sandbox in sandbox mode). Anything else is never followed.
const startPay = computed(() => startPayPattern(capabilities.value));
const gatewayUrl = computed(
  () =>
    order.value?.payments.find(
      (p) => p.state === 'PENDING' && !!startPay.value?.test(p.redirect_url ?? ''),
    )?.redirect_url ?? '',
);
const testPrice = computed(
  () => (order.value?.snapshot as { test_price?: boolean } | undefined)?.test_price === true,
);
const statusTone = computed(() => {
  if (!order.value) return 'pending';
  if (order.value.exception_code) return 'review';
  if (order.value.license_id) return 'ready';
  if (order.value.payments.some((p) => p.state === 'UNKNOWN')) return 'unknown';
  if (['FAILED', 'CANCELLED'].includes(order.value.state)) return 'failed';
  return order.value.paid_at ? 'confirmed' : 'pending';
});
async function copyOrderId() {
  if (!order.value) return;
  try {
    await navigator.clipboard.writeText(order.value.id);
    copied.value = true;
  } catch {
    noticeSuccess.value = false;
    message.value = 'کپی خودکار ممکن نشد؛ شمارهٔ سفارش را انتخاب کنید.';
  }
}
let timer: ReturnType<typeof setTimeout> | undefined,
  remaining = 30,
  alive = true;
async function load() {
  busy.value = true;
  message.value = '';
  noticeSuccess.value = false;
  try {
    order.value = await api.get('/api/v2/orders/{id}', { id: props.id });
    if (
      alive &&
      remaining-- > 0 &&
      !['FULFILLED', 'FAILED', 'CANCELLED'].includes(order.value.state) &&
      !order.value.exception_code
    ) {
      clearTimeout(timer);
      timer = setTimeout(load, 3000);
    }
  } catch (e) {
    message.value = errorMessage(e);
    if ((e as { status?: number }).status === 401) await navigateTo('/login');
  } finally {
    busy.value = false;
  }
}
async function pay() {
  busy.value = true;
  message.value = '';
  noticeSuccess.value = false;
  try {
    requestId.value ||= crypto.randomUUID();
    const p = await api.post(
      '/api/v2/orders/{id}/payments',
      { request_id: requestId.value },
      { id: props.id },
    );
    if (p.redirect_url === '/payment/simulate?order=' + props.id) await navigateTo(p.redirect_url);
    else if (startPay.value?.test(p.redirect_url ?? ''))
      await navigateTo(p.redirect_url!, { external: true });
    else await load();
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function requestRefund() {
  busy.value = true;
  try {
    await api.post(
      '/api/v2/orders/{id}/refund-request',
      { reason: refund.value },
      { id: props.id },
    );
    message.value = 'درخواست ثبت شد؛ ثبت یا تأیید درخواست به معنی بازگشت وجه نیست.';
    noticeSuccess.value = true;
    refund.value = '';
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  try {
    capabilities.value = await api.get('/api/v2/commerce/capabilities');
  } catch {
    capabilities.value = null;
  }
  await load();
});
onBeforeUnmount(() => {
  alive = false;
  clearTimeout(timer);
});
</script>
<template>
  <section class="wrap section order-page">
    <NuxtLink class="text-link" to="/account/orders">بازگشت به سفارش‌ها</NuxtLink>
    <h1>وضعیت سفارش شما</h1>
    <ApiNotice
      v-if="sandbox"
      kind="info"
      message="محیط آزمایشی رسمی زرین‌پال (سندباکس)؛ هیچ مبلغ واقعی دریافت نمی‌شود."
    /><ApiNotice
      v-else-if="simulated"
      kind="info"
      message="پرداخت آزمایشی است؛ هیچ مبلغ واقعی از شما دریافت نمی‌شود."
    />
    <p v-if="testPrice" class="notice" data-testid="order-test-price">
      این سفارش با قیمت آزمایشی محلی ثبت شده است و قیمت رسمی نیست.
    </p>
    <ApiNotice :message="message" :kind="noticeSuccess ? 'success' : 'error'" />
    <div v-if="order" class="panel order-receipt" :data-tone="statusTone">
      <div class="order-status-symbol" aria-hidden="true">
        {{
          statusTone === 'ready'
            ? '✓'
            : statusTone === 'failed'
              ? '×'
              : statusTone === 'review'
                ? '!'
                : '…'
        }}
      </div>
      <h2 class="order-state" aria-live="polite">{{ commerceState(order) }}</h2>
      <p>{{ order.snapshot.title_fa }}</p>
      <p class="device-username" dir="ltr">{{ order.snapshot.username }}</p>
      <dl class="commerce-totals">
        <div>
          <dt>شمارهٔ سفارش</dt>
          <dd class="order-id">
            <bdi>{{ persianDigits(order.id) }}</bdi
            ><button type="button" class="copy-button" @click="copyOrderId">
              {{ copied ? 'کپی شد' : 'کپی شماره' }}</button
            ><span class="sr-only" role="status">{{ copied ? 'شمارهٔ سفارش کپی شد.' : '' }}</span>
          </dd>
        </div>
        <div>
          <dt>قیمت پایه</dt>
          <dd>{{ toman(order.subtotal_irr) }} تومان</dd>
        </div>
        <div>
          <dt>{{ order.promotion_discount_irr > 0 ? 'تخفیف قیمت ویژه' : 'تخفیف' }}</dt>
          <dd>{{ toman(order.discount_irr) }} تومان</dd>
        </div>
        <div>
          <dt>مبلغ نهایی</dt>
          <dd>{{ toman(order.total_irr) }} تومان</dd>
        </div>
      </dl>
      <p v-if="paymentNotice(order.payments)" class="notice" data-testid="payment-notice">
        {{ paymentNotice(order.payments) }}
      </p>
      <p v-if="order.license_id">
        مجوز این پایه آمادهٔ دریافت در برنامهٔ ویندوز است. اتصال اینترنت فقط برای دریافت نخستین مجوز
        لازم است.
      </p>
      <p v-if="order.exception_code">
        اطلاعات مالی محفوظ است. برای بررسی وضعیت با پشتیبانی تماس بگیرید و شمارهٔ سفارش را اعلام
        کنید.
      </p>
      <div class="actions">
        <button
          v-if="order.state === 'PENDING' && !order.payments.length"
          class="button primary"
          :disabled="busy"
          @click="pay"
        >
          {{
            live
              ? 'پرداخت در درگاه زرین‌پال'
              : sandbox
                ? 'ادامه در درگاه آزمایشی زرین‌پال'
                : 'ادامه در شبیه‌ساز پرداخت'
          }}</button
        ><a
          v-if="gatewayUrl"
          class="button primary"
          :href="gatewayUrl"
          data-testid="gateway-link"
          >{{ live ? 'ادامهٔ پرداخت در درگاه زرین‌پال' : 'ادامهٔ پرداخت در درگاه آزمایشی' }}</a
        ><NuxtLink
          v-if="
            order.payments.some(
              (p) =>
                p.state === 'PENDING' && p.redirect_url === '/payment/simulate?order=' + props.id,
            )
          "
          class="button primary"
          :to="'/payment/simulate?order=' + order.id"
          >ادامهٔ پرداخت آزمایشی</NuxtLink
        ><button class="button secondary" :disabled="busy" @click="load">تازه‌سازی وضعیت</button
        ><NuxtLink v-if="order.license_id" to="/account/licenses" class="text-link"
          >مشاهدهٔ مجوزهای خرید</NuxtLink
        >
      </div>
      <FormShell v-if="order.paid_at" @submit="requestRefund"
        ><h3>درخواست بررسی بازپرداخت</h3>
        <p>
          درخواست شما بررسی و نتیجه به شما اعلام می‌شود. ثبت یا تأیید درخواست به معنی بازگشت وجه
          نیست؛ بازگشت وجه جداگانه اعلام می‌شود.
        </p>
        <label
          >دلیل درخواست<textarea v-model="refund" required minlength="10" maxlength="1000" /></label
        ><button class="button secondary" :disabled="busy">ثبت درخواست بررسی</button></FormShell
      >
    </div>
    <button v-else class="button secondary" :disabled="busy" @click="load">
      دریافت وضعیت سفارش
    </button>
  </section>
</template>
