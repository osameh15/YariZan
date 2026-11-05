<script setup lang="ts">
import { productTitle } from '#shared/products';
import { errorMessage } from '#shared/domain';
type Device = { username: string; label: string | null; current: boolean; created_at: string };
type Movable = { id: string; sku: string; customer_can_move: boolean };
const route = useRoute(),
  api = useApi(),
  busy = ref(true),
  message = ref('');
const account = ref<{
    username: string;
    label: string | null;
    generation: number;
    device_id: string;
  }>(),
  devices = ref<Record<string, unknown>[]>([]),
  licenses = ref<Record<string, unknown>[]>([]),
  owned = ref<Record<string, unknown>[]>([]),
  deviceList = ref<Device[]>([]),
  movable = ref<Movable[]>([]);
const section = computed(() => String(route.params.section ?? 'overview'));
const nav = [
  ['overview', 'نمای کلی', '/account'],
  ['devices', 'دستگاه‌های من', '/account/devices'],
  ['licenses', 'محصولات و مجوزها', '/account/licenses'],
  ['security', 'امنیت حساب', '/account/security'],
  ['orders', 'سفارش‌های من', '/account/orders'],
];
const otherDevices = computed(() => deviceList.value.filter((d) => !d.current));
const deviceName = (d: { label: string | null }) => d.label || 'دستگاه بدون نام';
const date = (value: unknown) => new Date(String(value)).toLocaleDateString('fa-IR');

async function load() {
  busy.value = true;
  message.value = '';
  try {
    account.value = await api.get('/api/v2/account');
    const d = await Promise.all([
      api.get('/api/v2/account/devices'),
      api.get('/api/v2/account/licenses'),
      api.get('/api/v2/account/entitlements'),
      api.get('/api/v2/account/device-list'),
      api.get('/api/v2/account/movable-licenses'),
    ]);
    devices.value = d[0] as Record<string, unknown>[];
    licenses.value = d[1] as Record<string, unknown>[];
    owned.value = d[2] as Record<string, unknown>[];
    deviceList.value = d[3] as Device[];
    movable.value = d[4] as Movable[];
    labelDraft.value = account.value?.label ?? '';
  } catch (e) {
    account.value = undefined;
    // Signed out: go straight to the login page and keep the loading state, so no portal shows first.
    if ((e as { status?: number }).status === 401) {
      await navigateTo('/login?return=' + encodeURIComponent(route.path), { replace: true });
      return;
    }
    message.value = errorMessage(e);
  }
  busy.value = false;
}

// Device name: shown wherever a device is chosen, instead of only the YZ-… identifier.
const labelDraft = ref(''),
  savingLabel = ref(false),
  labelMessage = ref('');
async function saveLabel() {
  savingLabel.value = true;
  labelMessage.value = '';
  try {
    const r = await api.post('/api/v2/account/device-label', { label: labelDraft.value.trim() });
    if (account.value) account.value.label = r.label;
    const self = deviceList.value.find((d) => d.current);
    if (self) self.label = r.label;
    labelMessage.value = r.label ? 'نام دستگاه ذخیره شد.' : 'نام دستگاه پاک شد.';
  } catch (e) {
    labelMessage.value = errorMessage(e);
  } finally {
    savingLabel.value = false;
  }
}

// Moving a purchase: once by the customer, to another device of the same verified mobile.
const moving = ref<Movable>(),
  moveTarget = ref(''),
  moveOpen = ref(false),
  moveBusy = ref(false),
  moveMessage = ref('');
const canMove = (sku: unknown) =>
  movable.value.find((m) => m.sku === sku && m.customer_can_move) && otherDevices.value.length > 0;
function openMove(sku: unknown) {
  moving.value = movable.value.find((m) => m.sku === sku);
  moveTarget.value = otherDevices.value[0]?.username ?? '';
  moveMessage.value = '';
  moveOpen.value = true;
}
async function confirmMove() {
  if (!moving.value || !moveTarget.value) return;
  moveBusy.value = true;
  moveMessage.value = '';
  try {
    await api.post('/api/v2/account/licenses/move', {
      entitlement_id: moving.value.id,
      target_username: moveTarget.value,
    });
    const target = deviceList.value.find((d) => d.username === moveTarget.value);
    moveOpen.value = false;
    await load();
    message.value = `مجوز ${productTitle(moving.value.sku)} به «${target ? deviceName(target) : moveTarget.value}» منتقل شد. برنامه را روی آن دستگاه باز کنید تا مجوز دریافت شود.`;
  } catch (e) {
    moveMessage.value = errorMessage(e);
  } finally {
    moveBusy.value = false;
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
  <section v-if="busy" class="wrap section portal-loader" role="status">
    <img src="/brand/logo.webp" alt="" width="118" height="78" />
    <span>در حال دریافت حساب…</span>
  </section>
  <section v-else class="wrap section portal">
    <aside v-if="account" class="portal-sidebar">
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
    <div class="portal-main">
      <div v-if="message" class="notice" role="status">{{ message }}</div>
      <template v-if="account"
        ><header class="portal-heading">
          <div>
            <p class="eyebrow">خوش آمدید</p>
            <h1>{{ nav.find((n) => n[0] === section)?.[1] ?? 'حساب من' }}</h1>
          </div>
          <span class="badge available">دستگاه متصل</span>
        </header>
        <div class="current-device">
          <span class="current-device-name">{{ deviceName(account) }}</span>
          <span class="device-username" dir="ltr">{{ account.username }}</span>
        </div>
        <template v-if="section === 'overview'"
          ><div class="stat-grid">
            <article class="panel">
              <span>{{
                new Intl.NumberFormat('fa-IR').format(
                  owned.filter((o) => o.state === 'ACTIVE').length,
                )
              }}</span>
              <p>محصول خریداری‌شده</p>
            </article>
            <article class="panel">
              <span>{{ new Intl.NumberFormat('fa-IR').format(deviceList.length) }}</span>
              <p>دستگاه با همین شمارهٔ موبایل</p>
            </article>
            <article class="panel">
              <span>∞</span>
              <p>مجوز خریداری‌شده، بدون انقضا</p>
            </article>
          </div>
          <div class="panel">
            <h2>پایهٔ مناسب فرزندتان را انتخاب کنید.</h2>
            <p>هر پایه و هر بازی ویژه مستقل است. قیمت و وضعیت عرضه را در صفحهٔ محصولات ببینید.</p>
            <NuxtLink class="button primary" to="/products">دیدن محصولات ←</NuxtLink>
          </div></template
        ><template v-else-if="section === 'devices'"
          ><article class="panel device-name-card">
            <h2>نام این دستگاه</h2>
            <p>
              یک نام آشنا انتخاب کنید، مثلاً «لپ‌تاپ مدرسه» یا «رایانهٔ خانه». این نام هنگام ورود،
              خرید و انتقال مجوز به جای شناسهٔ دستگاه نمایش داده می‌شود.
            </p>
            <form class="device-name-form" @submit.prevent="saveLabel">
              <label
                >نام دستگاه<input
                  v-model="labelDraft"
                  maxlength="40"
                  autocomplete="off"
                  placeholder="مثلاً رایانهٔ خانه"
              /></label>
              <button class="button primary" :disabled="savingLabel">
                {{ savingLabel ? 'در حال ذخیره…' : 'ذخیرهٔ نام' }}
              </button>
            </form>
            <p v-if="labelMessage" class="muted" role="status">{{ labelMessage }}</p>
          </article>
          <article class="panel">
            <h2>دستگاه‌های این شمارهٔ موبایل</h2>
            <p class="muted">
              هر دستگاه مجوزهای خودش را دارد. برای خرید برای دستگاهی دیگر، با کد پیامکی وارد شوید و
              همان دستگاه را انتخاب کنید.
            </p>
            <ul class="device-list" role="list">
              <li v-for="d in deviceList" :key="d.username" :class="{ 'is-current': d.current }">
                <span class="device-list-icon" aria-hidden="true">🖥</span>
                <div>
                  <strong>{{ deviceName(d) }}</strong>
                  <span class="device-username" dir="ltr">{{ d.username }}</span>
                </div>
                <span v-if="d.current" class="pill" data-tone="ok">همین دستگاه</span>
                <small class="muted">اتصال: {{ date(d.created_at) }}</small>
              </li>
            </ul>
          </article>
          <article class="panel">
            <h2>پروفایل‌های ویندوز این دستگاه</h2>
            <p class="muted">
              هر کاربر ویندوز روی این رایانه یک پروفایل جدا دارد. خریدها و فرصت‌های آزمایشی میان
              پروفایل‌های تأییدشدهٔ همین دستگاه مشترک‌اند.
            </p>
            <div class="table-scroll">
              <table class="mini-table">
                <thead>
                  <tr>
                    <th style="width: 52%">شناسهٔ پروفایل</th>
                    <th>وضعیت</th>
                    <th>تاریخ تأیید</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in devices" :key="String(d.id)">
                    <td dir="ltr" :title="String(d.id)">{{ d.id }}</td>
                    <td>
                      <span class="pill" :data-tone="d.status === 'ACTIVE' ? 'ok' : 'bad'">{{
                        d.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'
                      }}</span>
                    </td>
                    <td>{{ date(d.created_at) }}</td>
                  </tr>
                  <tr v-if="!devices.length">
                    <td colspan="3">هنوز پروفایلی تأیید نشده است.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <NuxtLink to="/connect" class="button secondary">تأیید پروفایل جدید</NuxtLink>
          </article></template
        ><template v-else-if="section === 'licenses'"
          ><p class="notice">
            مجوز معتبرِ ذخیره‌شده در برنامه، برای همان دستگاه و محصول آفلاین است. خطای شبکه به معنی
            لغو مجوز نیست.
          </p>
          <div v-if="!owned.length" class="panel">
            <h2>هنوز محصولی به این دستگاه اضافه نشده است.</h2>
            <NuxtLink class="text-link" to="/products">آشنایی با محصولات ←</NuxtLink>
          </div>
          <article v-for="o in owned" :key="String(o.id)" class="panel owned-card">
            <header class="owned-card-head">
              <h2>{{ productTitle(o.sku) }}</h2>
              <span class="pill" :data-tone="o.state === 'ACTIVE' ? 'ok' : 'bad'">{{
                o.state === 'ACTIVE' ? 'مالکیت فعال' : 'مالکیت غیرفعال'
              }}</span>
            </header>
            <div class="table-scroll">
              <table class="mini-table">
                <thead>
                  <tr>
                    <th style="width: 60%">شناسهٔ مجوز</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="l in licenses.filter((l) => l.sku === o.sku)" :key="String(l.id)">
                    <td dir="ltr" :title="String(l.id)">{{ l.id }}</td>
                    <td>
                      <span class="pill" :data-tone="l.state === 'ACTIVE' ? 'ok' : 'bad'">{{
                        l.state === 'ACTIVE' ? 'مجوز فعال' : 'مجوز لغوشده'
                      }}</span>
                    </td>
                  </tr>
                  <tr v-if="!licenses.some((l) => l.sku === o.sku)">
                    <td colspan="2">مجوز هنگام باز کردن برنامه روی همین دستگاه دریافت می‌شود.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <footer class="owned-card-actions">
              <button
                v-if="o.state === 'ACTIVE' && canMove(o.sku)"
                class="button secondary"
                @click="openMove(o.sku)"
              >
                انتقال به دستگاه دیگر
              </button>
              <p
                v-else-if="o.state === 'ACTIVE' && movable.some((m) => m.sku === o.sku)"
                class="muted"
              >
                {{
                  otherDevices.length
                    ? 'این مجوز قبلاً منتقل شده یا از راه خرید نیست؛ برای انتقال دوباره با پشتیبانی تماس بگیرید.'
                    : 'برای انتقال، ابتدا دستگاه دیگر را با همین شمارهٔ موبایل به حساب متصل کنید.'
                }}
              </p>
            </footer>
          </article></template
        ><template v-else-if="section === 'security'"
          ><AccountSecurity /><button class="button secondary" @click="rotate">
            تازه‌سازی ورود در این مرورگر
          </button></template
        >
        <CommerceOrders v-else
      /></template>
      <div v-else class="panel">
        <NuxtLink to="/login" class="button primary">ورود به حساب</NuxtLink
        ><button class="button secondary" @click="load">تلاش دوباره</button>
      </div>
    </div>
    <BaseDialog v-model="moveOpen" title="انتقال مجوز به دستگاه دیگر">
      <div class="dialog-stack">
        <p>
          مجوز <strong>{{ moving ? productTitle(moving.sku) : '' }}</strong> از
          <strong>{{ account ? deviceName(account) : '' }}</strong> به دستگاه انتخاب‌شده منتقل
          می‌شود.
        </p>
        <fieldset class="device-picker">
          <legend>دستگاه مقصد</legend>
          <label v-for="d in otherDevices" :key="d.username" class="device-choice">
            <input v-model="moveTarget" type="radio" name="move-target" :value="d.username" />
            <span
              ><strong>{{ deviceName(d) }}</strong
              ><small dir="ltr">{{ d.username }}</small></span
            >
          </label>
        </fieldset>
        <p class="notice">
          این کار فقط یک بار برای هر خرید ممکن است. مجوز روی این دستگاه لغو می‌شود و در اولین بررسی
          برنامه، بازی روی این دستگاه دیگر باز نمی‌شود.
        </p>
        <p v-if="moveMessage" class="form-error" role="alert">{{ moveMessage }}</p>
        <div class="actions">
          <button class="button primary" :disabled="moveBusy || !moveTarget" @click="confirmMove">
            {{ moveBusy ? 'در حال انتقال…' : 'تأیید و انتقال' }}
          </button>
          <button class="button secondary" :disabled="moveBusy" @click="moveOpen = false">
            انصراف
          </button>
        </div>
      </div>
    </BaseDialog>
  </section>
</template>
