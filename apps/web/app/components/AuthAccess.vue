<script setup lang="ts">
import { errorMessage, safeReturn } from '#shared/domain';
const props = withDefaults(defineProps<{ mode?: 'customer' | 'admin' | 'reset' }>(), {
  mode: 'customer',
});
const username = ref(''),
  password = ref(''),
  confirm = ref(''),
  mobile = ref(''),
  code = ref(''),
  challenge = ref(''),
  method = ref<'password' | 'otp'>('otp'),
  busy = ref(false),
  message = ref(''),
  done = ref(false),
  cooldown = ref(0),
  api = useApi(props.mode === 'admin'),
  route = useRoute();
const digits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
let clock: ReturnType<typeof setInterval>;
onMounted(() => {
  clock = setInterval(() => {
    if (cooldown.value > 0) cooldown.value--;
  }, 1000);
});
onBeforeUnmount(() => {
  clearInterval(clock);
  password.value = '';
  code.value = '';
  confirm.value = '';
});
async function submit() {
  busy.value = true;
  message.value = '';
  try {
    if (props.mode === 'customer' && method.value === 'password') {
      await api.post('/api/v2/auth/login', {
        username: username.value.trim(),
        password: password.value,
      });
      await navigateTo(safeReturn(route.query.return));
      return;
    }
    if (!challenge.value) {
      const r =
        props.mode === 'admin'
          ? await api.post('/api/v2/admin/auth/login', {
              username: username.value.trim(),
              password: password.value,
            })
          : await api.post('/api/v2/auth/otp/request', {
              username: username.value.trim(),
              mobile: digits(mobile.value),
              purpose: props.mode === 'reset' ? 'RESET' : 'LOGIN',
            });
      challenge.value = r.challenge_id;
      cooldown.value = r.retry_after;
      password.value = '';
      return;
    }
    const proof = { challenge_id: challenge.value, code: digits(code.value) };
    if (props.mode === 'admin') {
      await api.post('/api/v2/admin/auth/sms/verify', proof);
      await navigateTo('/zanyari');
    } else if (props.mode === 'reset') {
      await api.post('/api/v2/auth/password-reset/otp', { ...proof, password: password.value });
      api.clear();
      done.value = true;
    } else {
      await api.post('/api/v2/auth/otp/verify', proof);
      await navigateTo(safeReturn(route.query.return));
    }
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
    code.value = '';
  }
}
function restart() {
  challenge.value = '';
  message.value = '';
  code.value = '';
  password.value = '';
}
</script>
<template>
  <section class="wrap auth-section">
    <div class="auth-intro">
      <p class="eyebrow">{{ mode === 'admin' ? 'مدیریت یاریزان' : 'حساب یاریزان شما' }}</p>
      <h1>
        {{
          mode === 'admin'
            ? 'ورود امن به مدیریت'
            : mode === 'reset'
              ? 'بازیابی رمز عبور'
              : 'خوش آمدید'
        }}
      </h1>
      <p v-if="mode !== 'admin'">
        نام کاربری همان شناسه‌ای است که در برنامهٔ ویندوز می‌بینید. شمارهٔ همراه باید قبلاً برای
        همین حساب تأیید شده باشد.
      </p>
      <p v-else>
        پس از بررسی نام کاربری و رمز عبور، کد یک‌بارمصرف به شمارهٔ تأییدشدهٔ مدیر فرستاده می‌شود.
      </p>
      <NuxtLink v-if="mode === 'customer'" class="text-link" to="/connect"
        >حساب ندارید؟ برنامه را متصل کنید</NuxtLink
      >
    </div>
    <div v-if="done" class="panel auth-card">
      <h2>رمز عبور تغییر کرد</h2>
      <ApiNotice
        message="نشست‌های قبلی بسته شدند. با رمز عبور تازه وارد شوید."
        kind="success"
      /><NuxtLink class="button primary" to="/login">ورود به حساب</NuxtLink>
    </div>
    <FormShell v-else :key="method + '-' + !!challenge" class="panel auth-card" @submit="submit"
      ><h2>
        {{
          challenge
            ? 'کد پیامک را وارد کنید'
            : mode === 'admin'
              ? 'ورود مدیریت'
              : mode === 'reset'
                ? 'تأیید شمارهٔ همراه'
                : 'ورود به حساب'
        }}
      </h2>
      <div
        v-if="mode === 'customer' && !challenge"
        class="auth-tabs"
        role="group"
        aria-label="روش ورود"
      >
        <button
          type="button"
          class="button"
          :class="method === 'otp' ? 'primary' : 'secondary'"
          :aria-pressed="method === 'otp'"
          @click="
            method = 'otp';
            restart();
          "
        >
          ورود با کد یک‌بارمصرف
        </button>
        <button
          type="button"
          class="button"
          :class="method === 'password' ? 'primary' : 'secondary'"
          :aria-pressed="method === 'password'"
          @click="
            method = 'password';
            restart();
          "
        >
          ورود با رمز عبور
        </button>
      </div>
      <template v-if="!challenge"
        ><label
          >نام کاربری{{ mode === 'admin' ? ' مدیریت' : ' دستگاه'
          }}<input
            v-model="username"
            dir="ltr"
            autocomplete="username"
            :placeholder="mode === 'admin' ? undefined : 'YZ-...'"
            maxlength="64"
            required
            data-label="نام کاربری"
        /></label>
        <label v-if="mode === 'admin' || (mode === 'customer' && method === 'password')"
          >رمز عبور<input
            v-model="password"
            type="password"
            autocomplete="current-password"
            maxlength="128"
            required
            data-label="رمز عبور"
        /></label>
        <label v-else
          >شمارهٔ همراه<PersianNumberInput
            v-model="mobile"
            type="tel"
            dir="ltr"
            autocomplete="tel"
            maxlength="20"
            required
            data-kind="mobile"
            data-label="شمارهٔ همراه"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹" /></label
      ></template>
      <template v-else
        ><p class="otp-help">
          اگر اطلاعات با حساب مطابقت داشته باشد، کد پیامک می‌شود. کد سه دقیقه اعتبار دارد و فقط یک
          بار قابل استفاده است. کد را به دیگران ندهید.
        </p>
        <label
          >کد تأیید پیامکی<PersianNumberInput
            v-model="code"
            dir="ltr"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            minlength="6"
            maxlength="6"
            required
            data-label="کد تأیید"
            data-format-message="کد شش‌رقمی پیامک را وارد کنید."
        /></label>
        <template v-if="mode === 'reset'"
          ><label
            >رمز عبور جدید<input
              v-model="password"
              name="password"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required /></label
          ><label
            >تکرار رمز عبور<input
              v-model="confirm"
              type="password"
              autocomplete="new-password"
              data-match="password"
              minlength="12"
              maxlength="128"
              required /></label></template
      ></template>
      <ApiNotice :message="message" />
      <button class="button primary" :disabled="busy">
        {{
          busy
            ? 'در حال بررسی…'
            : challenge
              ? mode === 'reset'
                ? 'ثبت رمز عبور جدید'
                : 'تأیید کد و ورود'
              : mode === 'admin' || method === 'otp' || mode === 'reset'
                ? 'ارسال کد تأیید'
                : 'ورود به حساب'
        }}
      </button>
      <button
        v-if="challenge"
        type="button"
        class="button secondary"
        :disabled="busy || cooldown > 0"
        @click="restart"
      >
        {{
          cooldown > 0
            ? 'درخواست دوباره پس از ' + new Intl.NumberFormat('fa-IR').format(cooldown) + ' ثانیه'
            : 'درخواست کد تازه'
        }}
      </button>
      <NuxtLink v-if="mode === 'customer'" class="text-link" to="/reset-password"
        >رمز عبور را فراموش کرده‌ام</NuxtLink
      ><NuxtLink v-if="mode === 'reset'" class="text-link" to="/support"
        >به شمارهٔ قبلی دسترسی ندارم؛ راهنمای پشتیبانی</NuxtLink
      ></FormShell
    >
  </section>
</template>
