<script setup lang="ts">
import { errorMessage, gradeNames } from '#shared/domain';
const route = useRoute(),
  api = useApi(),
  busy = ref(true),
  message = ref('');
const account = ref<{ username: string; generation: number; device_id: string }>(),
  devices = ref<Record<string, unknown>[]>([]),
  licenses = ref<Record<string, unknown>[]>([]),
  owned = ref<Record<string, unknown>[]>([]);
const section = computed(() => String(route.params.section ?? 'overview'));
const nav = [
  ['overview', 'نمای کلی', '/account'],
  ['devices', 'دستگاه و پروفایل‌ها', '/account/devices'],
  ['licenses', 'محصولات و مجوزها', '/account/licenses'],
  ['security', 'امنیت حساب', '/account/security'],
  ['orders', 'سفارش‌ها', '/account/orders'],
];
async function load() {
  busy.value = true;
  message.value = '';
  try {
    account.value = await api.get('/api/v2/account');
    const d = await Promise.all([
      api.get('/api/v2/account/devices'),
      api.get('/api/v2/account/licenses'),
      api.get('/api/v2/account/entitlements'),
    ]);
    devices.value = d[0] as Record<string, unknown>[];
    licenses.value = d[1] as Record<string, unknown>[];
    owned.value = d[2] as Record<string, unknown>[];
  } catch (e) {
    message.value = errorMessage(e);
    account.value = undefined;
    if ((e as { status?: number }).status === 401)
      await navigateTo('/login?return=' + encodeURIComponent(route.path));
  } finally {
    busy.value = false;
  }
}
async function logout() {
  try {
    await api.post('/api/v2/auth/logout', undefined as never);
    api.clear();
    account.value = undefined;
    await navigateTo('/login');
  } catch (e) {
    message.value = errorMessage(e);
  }
}
async function rotate() {
  try {
    await api.post('/api/v2/auth/session/rotate', undefined as never);
    message.value = 'ورود در این مرورگر تازه شد.';
  } catch (e) {
    message.value = errorMessage(e);
  }
}
onMounted(load);
</script>
<template>
  <section class="wrap section portal">
    <aside class="portal-sidebar">
      <p class="eyebrow">خانهٔ یادگیری شما</p>
      <h2>حساب من</h2>
      <nav aria-label="حساب مشتری">
        <NuxtLink
          v-for="[id, title, to] in nav"
          :key="id"
          :to="to!"
          :aria-current="section === id ? 'page' : undefined"
          >{{ title }}</NuxtLink
        ><NuxtLink to="/support">پشتیبانی</NuxtLink>
      </nav>
      <button class="button secondary" @click="logout">خروج از حساب</button>
    </aside>
    <div class="portal-main" :aria-busy="busy">
      <div v-if="busy" role="status" class="notice">در حال دریافت حساب…</div>
      <div v-if="message" class="notice" role="status">{{ message }}</div>
      <template v-if="account && !busy"
        ><header class="portal-heading">
          <div>
            <p class="eyebrow">خوش آمدید</p>
            <h1>{{ nav.find((n) => n[0] === section)?.[1] ?? 'حساب من' }}</h1>
          </div>
          <span class="badge available">دستگاه متصل</span>
        </header>
        <p class="device-username" dir="ltr">{{ account.username }}</p>
        <template v-if="section === 'overview'"
          ><div class="stat-grid">
            <article class="panel">
              <span>{{
                new Intl.NumberFormat('fa-IR').format(
                  owned.filter((o) => o.state === 'ACTIVE').length,
                )
              }}</span>
              <p>پایهٔ خریداری‌شده</p>
            </article>
            <article class="panel">
              <span>{{
                new Intl.NumberFormat('fa-IR').format(
                  devices.filter((d) => d.status === 'ACTIVE').length,
                )
              }}</span>
              <p>پروفایل ویندوز تأییدشده</p>
            </article>
            <article class="panel">
              <span>∞</span>
              <p>مجوز خریداری‌شده، بدون انقضا</p>
            </article>
          </div>
          <div class="panel">
            <h2>پایهٔ مناسب فرزندتان را انتخاب کنید.</h2>
            <p>هر پایه مستقل است. برای آشنایی با قیمت و وضعیت عرضه، دنیای پایه‌ها را ببینید.</p>
            <NuxtLink class="button primary" to="/products">دیدن محصولات ←</NuxtLink>
          </div></template
        ><template v-else-if="section === 'devices'"
          ><div class="panel">
            <h2>یک دستگاه، چند پروفایلِ تأییدشده</h2>
            <p>خریدها و فرصت‌های آزمایشی میان پروفایل‌های تأییدشدهٔ همین دستگاه مشترک‌اند.</p>
            <p class="mono" dir="ltr">{{ account.device_id }}</p>
            <ul class="record-list">
              <li v-for="d in devices" :key="String(d.id)">
                <span>پروفایل ویندوز</span
                ><span class="badge">{{ d.status === 'ACTIVE' ? 'فعال' : 'غیرفعال' }}</span
                ><small dir="ltr">{{ d.id }}</small>
              </li>
            </ul>
            <NuxtLink to="/connect" class="button secondary">تأیید پروفایل جدید</NuxtLink>
          </div></template
        ><template v-else-if="section === 'licenses'"
          ><p class="notice">
            مجوز معتبرِ ذخیره‌شده در برنامه، برای همان دستگاه و پایه آفلاین است. خطای شبکه به معنی
            لغو مجوز نیست.
          </p>
          <div v-if="!owned.length" class="panel">
            <h2>هنوز محصولی به این حساب اضافه نشده است.</h2>
            <NuxtLink class="text-link" to="/products">آشنایی با پایه‌ها ←</NuxtLink>
          </div>
          <article v-for="o in owned" :key="String(o.id)" class="panel owned-card">
            <h2>یاریزان پایهٔ {{ gradeNames[Number(String(o.sku).slice(-1)) - 1] }}</h2>
            <span class="badge">{{ o.state === 'ACTIVE' ? 'مالکیت فعال' : 'مالکیت غیرفعال' }}</span>
            <p>مجوزهای این پایه</p>
            <ul class="record-list">
              <li v-for="l in licenses.filter((l) => l.sku === o.sku)" :key="String(l.id)">
                <b>{{ l.state === 'ACTIVE' ? 'مجوز فعال' : 'مجوز لغوشده' }}</b
                ><small dir="ltr">{{ l.id }}</small>
              </li>
            </ul>
            <p class="muted">
              مجوز از خود برنامه دریافت می‌شود؛ این صفحه فقط وضعیت حساب را نمایش می‌دهد.
            </p>
          </article></template
        ><template v-else-if="section === 'security'"
          ><AccountSecurity /><button class="button secondary" @click="rotate">
            تازه‌سازی ورود در این مرورگر
          </button></template
        >
        <CommerceOrders v-else
      /></template>
      <div v-else-if="!busy" class="panel">
        <NuxtLink to="/login" class="button primary">ورود به حساب</NuxtLink
        ><button class="button secondary" @click="load">تلاش دوباره</button>
      </div>
    </div>
  </section>
</template>
