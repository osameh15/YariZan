<script setup lang="ts">
import { errorMessage } from '#shared/domain';
const api = useApi(),
  id = ref(''),
  secret = ref(''),
  mobile = ref(''),
  code = ref(''),
  challenge = ref(''),
  busy = ref(false),
  message = ref(''),
  noticeKind = ref<'error' | 'info'>('error'),
  cooldown = ref(0),
  done = ref(false),
  preview = ref<{ username: string; requires_owner: boolean; expires_at: string } | null>(null);
async function inspect() {
  busy.value = true;
  message.value = '';
  noticeKind.value = 'error';
  try {
    preview.value = await api.post(
      '/api/v2/device-pairings/{id}/preview',
      { pairing_secret: secret.value.trim() },
      { id: id.value.trim() },
    );
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function approve() {
  busy.value = true;
  message.value = '';
  noticeKind.value = 'error';
  try {
    if (!preview.value?.requires_owner && !challenge.value) {
      const r = await api.post('/api/v2/auth/claim/otp/request', {
        pairing_id: id.value.trim(),
        pairing_secret: secret.value.trim(),
        mobile: mobile.value,
      });
      challenge.value = r.challenge_id;
      cooldown.value = r.retry_after;
      return;
    }
    await api.post('/api/v2/auth/claim', {
      pairing_id: id.value.trim(),
      pairing_secret: secret.value.trim(),
      ...(!preview.value?.requires_owner
        ? {
            otp: {
              challenge_id: challenge.value,
              code: code.value.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)),
            },
          }
        : {}),
    });
    done.value = true;
    secret.value = '';
    code.value = '';
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
let retryClock: ReturnType<typeof setInterval>;
onMounted(() => {
  retryClock = setInterval(() => {
    if (cooldown.value > 0) cooldown.value--;
  }, 1000);
});
async function resend() {
  busy.value = true;
  message.value = '';
  noticeKind.value = 'error';
  try {
    const r = await api.post('/api/v2/auth/claim/otp/request', {
      pairing_id: id.value.trim(),
      pairing_secret: secret.value.trim(),
      mobile: mobile.value,
    });
    challenge.value = r.challenge_id;
    cooldown.value = r.retry_after;
    code.value = '';
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function cancel() {
  busy.value = true;
  try {
    await api.post(
      '/api/v2/device-pairings/{id}/cancel',
      { pairing_secret: secret.value.trim() },
      { id: id.value.trim() },
    );
    preview.value = null;
    secret.value = '';
    challenge.value = '';
    message.value = 'درخواست اتصال لغو شد.';
    noticeKind.value = 'info';
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  clearInterval(retryClock);
  secret.value = '';
  code.value = '';
});
useSeoMeta({ title: 'اتصال برنامه به حساب | یاریزان' });
</script>
<template>
  <section class="wrap section connect-grid">
    <div>
      <p class="eyebrow">اتصال برنامه به حساب</p>
      <h1>برنامهٔ خود را<br />به حساب متصل کنید</h1>
      <p class="hero-lead">
        شناسه و کد موقت را از برنامهٔ ویندوز بگیرید. این صفحه فقط اتصال را تأیید می‌کند؛ مجوز و
        اعتبارنامهٔ دستگاه فقط به خود برنامه تحویل داده می‌شوند.
      </p>
      <ol class="steps">
        <li>
          <span>۱</span>
          <div>
            <strong>درخواست اتصال در ویندوز</strong>
            <p>از دکمهٔ «اتصال به حساب» در برنامه استفاده کنید.</p>
          </div>
        </li>
        <li>
          <span>۲</span>
          <div>
            <strong>بررسی نام کاربری و شمارهٔ همراه</strong>
            <p>برای حساب تازه، شمارهٔ همراه را با پیامک تأیید کنید. انتخاب رمز عبور الزامی نیست.</p>
          </div>
        </li>
        <li>
          <span>۳</span>
          <div>
            <strong>بازگشت به برنامه</strong>
            <p>پس از تأیید، ادامهٔ اتصال امن در برنامه انجام می‌شود.</p>
          </div>
        </li>
      </ol>
    </div>
    <div class="panel connect-card">
      <template v-if="done"
        ><span class="success-mark" aria-hidden="true">✓</span>
        <h2>اتصال در مرورگر تأیید شد</h2>
        <p role="status">
          حساب شما در این مرورگر باز است. می‌توانید وارد پیشخوان شوید؛ برای تکمیل اتصال دستگاه، به
          برنامهٔ ویندوز برگردید.
        </p>
        <NuxtLink class="button primary" to="/account">رفتن به پیشخوان حساب</NuxtLink></template
      >
      <FormShell v-else-if="!preview" @submit="inspect"
        ><h2>درخواست اتصال شما</h2>
        <label
          >شناسهٔ درخواست<input
            v-model="id"
            dir="ltr"
            maxlength="36"
            required
            autocomplete="off"
            pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
            data-label="شناسهٔ درخواست"
            data-format-message="شناسهٔ درخواست را کامل از برنامه کپی کنید." /></label
        ><label
          >کد موقت اتصال<input
            v-model="secret"
            dir="ltr"
            minlength="43"
            maxlength="43"
            pattern="[A-Za-z0-9_-]{43}"
            required
            autocomplete="off"
            spellcheck="false"
            data-label="کد موقت اتصال"
        /></label>
        <p class="muted">
          درخواست پنج دقیقه اعتبار دارد. کد را فقط از برنامهٔ خودتان بگیرید و با دیگران به اشتراک
          نگذارید.
        </p>
        <button class="button primary" :disabled="busy">
          {{ busy ? 'در حال بررسی…' : 'بررسی درخواست' }}
        </button></FormShell
      >
      <FormShell v-else :key="String(!!challenge)" @submit="approve"
        ><h2>
          {{
            preview.requires_owner
              ? 'تأیید پروفایل جدید ویندوز'
              : challenge
                ? 'تأیید شمارهٔ همراه'
                : 'راه‌اندازی حساب برای اولین بار'
          }}
        </h2>
        <p class="device-username" dir="ltr">{{ preview.username }}</p>
        <template v-if="preview.requires_owner"
          ><p>
            این دستگاه حساب دارد. فقط صاحب فعلی حساب می‌تواند پروفایل جدید ویندوز را تأیید کند.
            خریدها و فرصت‌های آزمایشی دستگاه مشترک می‌مانند.
          </p>
          <NuxtLink class="text-link" to="/login">ورود صاحب حساب</NuxtLink></template
        ><template v-else-if="!challenge"
          ><label
            >شمارهٔ همراه<input
              v-model="mobile"
              type="tel"
              dir="ltr"
              autocomplete="tel"
              data-kind="mobile"
              data-label="شمارهٔ همراه"
              maxlength="20"
              required
          /></label>
          <p class="muted">
            با کد پیامک حساب را راه‌اندازی می‌کنید. بعداً می‌توانید در بخش امنیت حساب رمز عبور هم
            انتخاب کنید.
          </p></template
        ><template v-else
          ><p>
            کد شش‌رقمی را فقط در همین صفحه وارد کنید. کد یک‌بارمصرف است و پنج دقیقه اعتبار دارد.
          </p>
          <label
            >کد تأیید پیامکی<input
              v-model="code"
              dir="ltr"
              inputmode="numeric"
              autocomplete="one-time-code"
              minlength="6"
              maxlength="6"
              pattern="[0-9]{6}"
              required
              data-label="کد تأیید" /></label
        ></template>
        <div class="actions">
          <button class="button primary" :disabled="busy">
            {{
              busy
                ? 'در حال بررسی…'
                : preview.requires_owner
                  ? 'این دستگاه را تأیید می‌کنم'
                  : challenge
                    ? 'تأیید شماره و اتصال'
                    : 'ارسال کد تأیید'
            }}</button
          ><button type="button" class="button secondary" :disabled="busy" @click="cancel">
            لغو درخواست
          </button>
        </div></FormShell
      ><button
        v-if="challenge && !done"
        type="button"
        class="button secondary"
        :disabled="busy || cooldown > 0"
        @click="resend"
      >
        {{
          cooldown > 0
            ? 'ارسال دوباره پس از ' + new Intl.NumberFormat('fa-IR').format(cooldown) + ' ثانیه'
            : 'ارسال دوبارهٔ کد تأیید'
        }}</button
      ><ApiNotice :message="message" :kind="noticeKind" />
    </div>
  </section>
</template>
