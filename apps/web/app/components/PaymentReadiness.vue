<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { errorMessage } from '#shared/domain';
import { financialToman } from '#shared/commerce';
import type { ApiResult } from '#shared/api';
// Read-only. This page has no control that changes any setting; only navigation and refresh.
const api = useApi(true),
  report = ref<ApiResult<'/api/v2/admin/payment-readiness', 'get'>>(),
  busy = ref(false),
  message = ref('');
const items: Record<string, string> = {
  merchant_activation: 'تأیید و فعال‌سازی پذیرنده در زرین‌پال',
  custom_payment_domain: 'دامنهٔ اختصاصی پرداخت',
  callback_domain: 'سازگاری دامنهٔ بازگشت از درگاه',
  outbound_ip_allowlist: 'نشانی IP خروجی سرور در فهرست مجاز',
  sandbox_acceptance: 'پذیرش در سندباکس رسمی زرین‌پال',
  payment_reconciliation_tests: 'آزمون‌های پرداخت و تطبیق',
  refund_readiness: 'آمادگی بازپرداخت',
  legal_merchant_documentation: 'مستندات حقوقی و پذیرنده',
};
const statuses: Record<string, [string, string]> = {
  verified: ['تأییدشده با شواهد', 'VERIFIED'],
  owner_confirmed: ['تأیید مالک', 'OWNER'],
  partial: ['ناقص', 'UNKNOWN'],
  blocked: ['مسدود', 'REVIEW'],
  not_started: ['آغاز نشده', 'REVIEW'],
};
const gates: Record<string, string> = {
  G1_FIRST_CLAIM_ASSURANCE: 'اطمینان از نخستین ادعای مالکیت',
  G1_SIGNING_CUSTODY: 'نگهداری کلید امضای تجاری',
  G4_DESKTOP_CREDENTIALS: 'ریشه‌ها و اعتبارنامه‌های تولیدی ویندوز',
  G6_ADMIN_SMS_MFA: 'پیامک مدیریت با خروجی کنترل‌شده',
  G5_TRUSTED_RATE_LIMITS: 'محدودیت نرخ پشت پراکسی مطمئن',
  G8_SECRET_CUSTODY: 'نگهداری و بازیابی کلیدهای محرمانه',
};
const n = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : persianDigits(String(value));
const age = (seconds: number | null) =>
  seconds === null ? 'ندارد' : persianDigits(String(Math.round(seconds / 60))) + ' دقیقه';
async function load() {
  busy.value = true;
  message.value = '';
  try {
    report.value = await api.get('/api/v2/admin/payment-readiness');
  } catch (e) {
    report.value = undefined;
    message.value = errorMessage(e);
    const status = (e as { status?: number }).status;
    if (status === 401) await navigateTo('/zanyari/login');
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="wrap section portal commerce-workspace payment-readiness">
    <aside class="portal-sidebar">
      <h2>آمادگی پرداخت</h2>
      <NuxtLink class="text-link" to="/zanyari">بازگشت به مدیریت</NuxtLink>
      <NuxtLink class="text-link" :to="{ path: '/zanyari/commerce', query: { section: 'finance' } }"
        >گزارش مالی</NuxtLink
      >
    </aside>
    <div class="portal-main" :aria-busy="busy">
      <p class="eyebrow">فقط خواندنی</p>
      <h1>آمادگی پرداخت واقعی</h1>
      <ApiNotice
        kind="info"
        message="این صفحه فقط گزارش می‌دهد و هیچ تنظیمی را تغییر نمی‌دهد. پرداخت واقعی تنها با تغییر بازبینی‌شدهٔ کد و تصمیم ثبت‌شدهٔ مالک فعال می‌شود."
      /><ApiNotice :message="message" kind="error" />
      <p v-if="busy" role="status" class="notice">در حال دریافت گزارش…</p>
      <template v-if="report">
        <p
          v-if="!report.real_payments_possible"
          class="notice"
          role="status"
          data-testid="real-payments-disabled"
        >
          <strong>پرداخت واقعی غیرفعال است.</strong> دروازهٔ پرداخت زنده و دروازه‌های امنیتی Backend
          بسته‌اند.
        </p>

        <h2>شواهد آمادگی</h2>
        <div class="table-scroll" tabindex="0" aria-label="جدول شواهد آمادگی پرداخت">
          <table>
            <caption class="sr-only">
              وضعیت هر پیش‌نیاز پرداخت واقعی
            </caption>
            <thead>
              <tr>
                <th scope="col">پیش‌نیاز</th>
                <th scope="col">وضعیت</th>
                <th scope="col">شواهد</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in report.evidence" :key="item.id">
                <th scope="row">{{ items[item.id] ?? item.id }}</th>
                <td>
                  <span class="status-chip" :data-state="statuses[item.status]?.[1]">{{
                    statuses[item.status]?.[0] ?? item.status
                  }}</span>
                </td>
                <td>
                  <span dir="ltr">{{ item.evidence }}</span>
                  <small class="muted" dir="ltr">{{ item.reference }}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>وضعیت زنده</h2>
        <div class="stat-grid finance-metrics">
          <article class="panel">
            <p>دروازهٔ پرداخت زنده</p>
            <h2>{{ report.production_payment_gate.open ? 'باز' : 'بسته' }}</h2>
          </article>
          <article class="panel">
            <p>حالت پرداخت در این محیط</p>
            <h2 dir="ltr">{{ report.runtime.commerce_mode }}</h2>
          </article>
          <article class="panel">
            <p>پیکربندی پذیرنده (فقط وجود، بدون مقدار)</p>
            <h2>
              {{ report.merchant_configuration.merchant_id_present ? 'ثبت شده' : 'ثبت نشده' }}
            </h2>
          </article>
          <article class="panel">
            <p>پرداخت‌های تأییدشده در سندباکس</p>
            <h2>{{ n(report.sandbox_evidence.verified_payments) }}</h2>
          </article>
          <article class="panel">
            <p>پرداخت‌های با نتیجهٔ نامشخص</p>
            <h2>{{ n(report.health.unknown_payments) }}</h2>
          </article>
          <article class="panel">
            <p>موارد نیازمند بررسی مالی</p>
            <h2>{{ n(report.health.open_exceptions) }}</h2>
          </article>
          <article class="panel">
            <p>کارهای در صف بازبینی / عقب‌افتاده</p>
            <h2>{{ n(report.health.jobs_in_review) }} / {{ n(report.health.overdue_jobs) }}</h2>
          </article>
          <article class="panel">
            <p>پرداخت‌شده بدون تحویل مجوز</p>
            <h2>{{ n(report.health.paid_unfulfilled) }}</h2>
          </article>
          <article class="panel">
            <p>قدیمی‌ترین پرداخت حل‌نشده</p>
            <h2>{{ age(report.health.oldest_unresolved_seconds) }}</h2>
          </article>
        </div>

        <h2>دروازه‌های تولید Backend</h2>
        <ul class="readiness-gates">
          <li v-for="gate in report.gates" :key="gate.id">
            <span class="status-chip" :data-state="gate.open ? 'VERIFIED' : 'REVIEW'">{{
              gate.open ? 'باز' : 'بسته'
            }}</span>
            {{ gates[gate.id] ?? gate.id }}
            <small class="muted" dir="ltr">{{ gate.id }}</small>
          </li>
        </ul>

        <h2>کاتالوگ و قیمت جاری</h2>
        <div class="table-scroll" tabindex="0" aria-label="جدول کاتالوگ و قیمت جاری">
          <table>
            <thead>
              <tr>
                <th scope="col">محصول</th>
                <th scope="col">انتشار</th>
                <th scope="col">فروش</th>
                <th scope="col">قیمت (تومان)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in report.catalog" :key="p.sku">
                <th scope="row" dir="ltr">{{ p.sku }}</th>
                <td>{{ p.publication_status === 'published' ? 'منتشرشده' : 'به‌زودی' }}</td>
                <td>{{ p.sale_enabled ? 'فعال' : 'غیرفعال' }}</td>
                <td>{{ financialToman(p.price_irr) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted">
          زمان گزارش:
          <bdi dir="ltr">{{ new Date(report.generated_at).toLocaleString('fa-IR') }}</bdi>
        </p>
      </template>
      <button class="button secondary" :disabled="busy" @click="load">تازه‌سازی گزارش</button>
    </div>
  </section>
</template>
