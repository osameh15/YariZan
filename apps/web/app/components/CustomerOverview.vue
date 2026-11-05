<script setup lang="ts">
import { productTitle } from '#shared/products';
import { commerceState, commerceTone, financialToman } from '#shared/commerce';
import { errorMessage } from '#shared/domain';
const props = defineProps<{
  owned: Record<string, unknown>[];
  licenses: Record<string, unknown>[];
  deviceCount: number;
  profileCount: number;
}>();
const active = computed(() => props.owned.filter((p) => p.state === 'ACTIVE'));
const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
const api = useApi(),
  orders = ref<Record<string, unknown>[]>([]),
  loading = ref(true),
  message = ref('');
async function loadOrders() {
  loading.value = true;
  message.value = '';
  try {
    orders.value = (
      await api.get('/api/v2/account/orders', undefined, { offset: 0, limit: 3 })
    ).items;
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(loadOrders);
const orderState = (order: Record<string, unknown>) => ({
  state: String(order.state),
  paid_at: order.paid_at,
  exception_code: order.exception_code,
  closed_reason: order.closed_reason,
});
</script>
<template>
  <div class="customer-overview">
    <section class="dashboard-welcome">
      <div>
        <p class="eyebrow">یک قدم تا کشف بعدی</p>
        <h2>
          {{
            active.length
              ? 'بازی‌های شما، آمادهٔ یک شروع تازه.'
              : 'خانهٔ یادگیری شما از اینجا شروع می‌شود.'
          }}
        </h2>
        <p>
          {{
            active.length
              ? 'محصولات، دستگاه‌ها و خریدها را از همین‌جا همراهی کنید. برای دریافت مجوز، برنامه را روی دستگاه متصل باز کنید.'
              : 'پایه یا بازی مناسب فرزندتان را پیدا کنید، برنامه را دریافت کنید و همراه او بازی را تجربه کنید.'
          }}
        </p>
        <div class="actions">
          <NuxtLink class="button primary" :to="active.length ? '/download' : '/products'"
            >{{ active.length ? 'دریافت برنامه' : 'پیدا کردن بازی مناسب' }}
            <span aria-hidden="true">←</span></NuxtLink
          ><NuxtLink class="text-link" :to="active.length ? '/account/licenses' : '/download'"
            >{{ active.length ? 'محصولات و مجوزهای من' : 'برنامه را دریافت کنید' }} ↗</NuxtLink
          >
        </div>
      </div>
      <span class="dashboard-welcome-mark" aria-hidden="true">✦</span>
    </section>
    <dl class="customer-metrics">
      <div>
        <dt>محصول خریداری‌شده<small>برای همین دستگاه</small></dt>
        <dd>{{ number(active.length) }}</dd>
      </div>
      <div>
        <dt>دستگاه متصل<small>با شمارهٔ موبایل شما</small></dt>
        <dd>{{ number(deviceCount) }}</dd>
      </div>
      <div>
        <dt>پروفایل تأییدشده<small>روی این دستگاه</small></dt>
        <dd>{{ number(profileCount) }}</dd>
      </div>
    </dl>
    <nav class="customer-shortcuts" aria-label="دسترسی سریع حساب">
      <NuxtLink to="/account/devices"
        ><span class="shortcut-symbol" aria-hidden="true">▣</span>
        <div><strong>دستگاه‌های من</strong><small>نام‌گذاری و بررسی اتصال</small></div>
        <span aria-hidden="true">←</span></NuxtLink
      ><NuxtLink to="/account/orders"
        ><span class="shortcut-symbol" aria-hidden="true">≡</span>
        <div><strong>سفارش‌های من</strong><small>پیگیری پرداخت و خرید</small></div>
        <span aria-hidden="true">←</span></NuxtLink
      ><NuxtLink to="/account/security"
        ><span class="shortcut-symbol" aria-hidden="true">◇</span>
        <div><strong>امنیت حساب</strong><small>رمز عبور و شمارهٔ همراه</small></div>
        <span aria-hidden="true">←</span></NuxtLink
      >
    </nav>
    <section class="panel customer-library">
      <header class="section-heading">
        <div>
          <p class="eyebrow">دنیای بازی‌های شما</p>
          <h2>محصولات من</h2>
        </div>
        <NuxtLink class="text-link" to="/account/licenses">بررسی همهٔ مجوزها ←</NuxtLink>
      </header>
      <div v-if="active.length" class="customer-library-grid">
        <article v-for="item in active" :key="String(item.id)">
          <span class="library-product-symbol" aria-hidden="true">✦</span>
          <h3>{{ productTitle(item.sku) }}</h3>
          <span class="pill" data-tone="ok">خریداری‌شده</span>
          <p>
            {{
              licenses.some((l) => l.sku === item.sku && l.state === 'ACTIVE')
                ? 'مجوز فعال برای این دستگاه ثبت شده است.'
                : 'برنامه را روی این دستگاه باز کنید تا مجوز محصول دریافت شود.'
            }}
          </p>
          <NuxtLink class="text-link" to="/account/licenses">دیدن جزئیات مجوز ←</NuxtLink>
        </article>
      </div>
      <div v-else class="customer-library-empty">
        <span aria-hidden="true">✦</span>
        <div>
          <h3>جای اولین بازی شما اینجاست.</h3>
          <p>پس از خرید، محصول و وضعیت مجوز آن را همین‌جا خواهید دید.</p>
          <NuxtLink class="text-link" to="/products">آشنایی با بازی‌ها ←</NuxtLink>
        </div>
      </div>
    </section>
    <section class="panel customer-recent-orders">
      <header class="section-heading">
        <h2>سفارش‌های اخیر</h2>
        <NuxtLink class="text-link" to="/account/orders">همهٔ سفارش‌ها ←</NuxtLink>
      </header>
      <p v-if="loading" role="status">در حال دریافت سفارش‌ها…</p>
      <p v-else-if="message" role="status">
        {{ message }}
        <button type="button" class="button secondary" @click="loadOrders">تلاش دوباره</button>
      </p>
      <ul v-else-if="orders.length">
        <li v-for="order in orders" :key="String(order.id)">
          <div>
            <strong>{{ productTitle(order.sku) }}</strong
            ><small>{{ new Date(String(order.created_at)).toLocaleDateString('fa-IR') }}</small>
          </div>
          <span class="pill" :data-tone="commerceTone(orderState(order))">{{
            commerceState(orderState(order))
          }}</span
          ><span class="order-summary-amount"
            >{{ financialToman(order.total_irr) }} <small>تومان</small></span
          ><NuxtLink class="text-link" :to="'/account/orders/' + order.id">جزئیات ←</NuxtLink>
        </li>
      </ul>
      <p v-else class="muted">
        هنوز سفارشی ثبت نکرده‌اید. خریدهای بعدی‌تان را از اینجا پیگیری کنید.
      </p>
    </section>
    <BlogHighlights :compact="true" :limit="2" />
    <aside class="customer-help">
      <div>
        <h2>برای ادامهٔ مسیر کمکی می‌خواهید؟</h2>
        <p>راهنمای دریافت برنامه، اتصال دستگاه و مجوزها در دسترس شماست.</p>
      </div>
      <NuxtLink class="button secondary" to="/support">راهنما و پشتیبانی ↗</NuxtLink>
    </aside>
  </div>
</template>
