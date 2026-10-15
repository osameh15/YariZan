<script setup lang="ts">
import { errorMessage } from '#shared/domain';
const api = useApi(),
  info = ref<{ has_password: boolean; mobile_masked: string | null; mobile_verified: boolean }>(),
  action = ref<'password' | 'mobile'>('password'),
  stage = ref<'idle' | 'old' | 'new'>('idle'),
  challenge = ref(''),
  oldChallenge = ref(''),
  oldCode = ref(''),
  code = ref(''),
  password = ref(''),
  confirm = ref(''),
  mobile = ref(''),
  currentPassword = ref(''),
  message = ref(''),
  busy = ref(false);
onMounted(async () => {
  try {
    info.value = await api.get('/api/v2/account/security');
  } catch (e) {
    message.value = errorMessage(e);
  }
});
async function send() {
  busy.value = true;
  message.value = '';
  try {
    const purpose =
      action.value === 'password'
        ? 'PASSWORD'
        : info.value?.mobile_verified
          ? 'MOBILE_OLD'
          : 'MOBILE_NEW';
    const r = await api.post('/api/v2/account/security/otp', {
      purpose,
      ...(purpose === 'MOBILE_NEW'
        ? { mobile: mobile.value, current_password: currentPassword.value }
        : {}),
    });
    challenge.value = r.challenge_id;
    stage.value = purpose === 'MOBILE_OLD' ? 'old' : 'new';
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
    currentPassword.value = '';
  }
}
async function save() {
  busy.value = true;
  message.value = '';
  try {
    if (stage.value === 'old') {
      const r = await api.post('/api/v2/account/security/otp', {
        purpose: 'MOBILE_NEW',
        mobile: mobile.value,
        current: { challenge_id: challenge.value, code: code.value },
      });
      oldChallenge.value = challenge.value;
      oldCode.value = code.value;
      challenge.value = r.challenge_id;
      stage.value = 'new';
      code.value = '';
      return;
    }
    if (action.value === 'password')
      await api.post('/api/v2/account/security/password', {
        challenge_id: challenge.value,
        code: code.value,
        password: password.value,
      });
    else
      await api.post('/api/v2/account/security/mobile', {
        challenge_id: challenge.value,
        code: code.value,
        ...(oldChallenge.value
          ? { current: { challenge_id: oldChallenge.value, code: oldCode.value } }
          : {}),
      });
    api.clear();
    await navigateTo('/login');
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
function choose(a: 'password' | 'mobile') {
  action.value = a;
  stage.value = 'idle';
  code.value = '';
  oldCode.value = '';
  password.value = '';
  confirm.value = '';
  message.value = '';
  oldChallenge.value = '';
}
onBeforeUnmount(() => {
  code.value = '';
  oldCode.value = '';
  password.value = '';
  confirm.value = '';
  currentPassword.value = '';
});
</script>
<template>
  <div class="security-cards">
    <div class="panel">
      <h2>امنیت حساب</h2>
      <p>
        شمارهٔ همراه تأییدشده: <b dir="ltr">{{ info?.mobile_masked ?? 'ثبت نشده' }}</b>
      </p>
      <p>
        {{
          info?.has_password
            ? 'رمز عبور برای این حساب فعال است.'
            : 'هنوز رمز عبور ندارید؛ ورود با کد پیامک برای شما فعال است.'
        }}
      </p>
      <p class="muted">
        برای تغییر شماره، ابتدا شمارهٔ فعلی و سپس شمارهٔ جدید تأیید می‌شود. پس از تغییر رمز یا
        شماره، همهٔ نشست‌ها بسته می‌شوند.
      </p>
      <div class="actions">
        <button class="button secondary" @click="choose('password')">
          {{ info?.has_password ? 'تغییر رمز عبور' : 'انتخاب رمز عبور' }}</button
        ><button class="button secondary" @click="choose('mobile')">تغییر شمارهٔ همراه</button>
      </div>
    </div>
    <FormShell
      :key="action + '-' + stage"
      class="panel"
      @submit="stage === 'idle' ? send() : save()"
      ><h3>
        {{
          action === 'password'
            ? info?.has_password
              ? 'تغییر رمز عبور'
              : 'انتخاب رمز عبور'
            : 'تغییر شمارهٔ همراه'
        }}
      </h3>
      <template v-if="stage === 'idle'"
        ><p v-if="info?.mobile_verified">کد تأیید به شمارهٔ همراه فعلی حساب فرستاده می‌شود.</p>
        <template v-else-if="action === 'mobile'"
          ><label
            >شمارهٔ همراه جدید<input
              v-model="mobile"
              type="tel"
              dir="ltr"
              data-kind="mobile"
              required
              maxlength="20" /></label
          ><label
            >رمز عبور فعلی<input
              v-model="currentPassword"
              type="password"
              autocomplete="current-password"
              minlength="12"
              maxlength="128"
              required /></label
        ></template>
        <p v-else>اگر شماره‌ای ثبت نشده است، ابتدا شمارهٔ همراه را تأیید کنید.</p>
        <button
          class="button primary"
          :disabled="busy || (!info?.mobile_verified && action === 'password')"
        >
          ارسال کد تأیید
        </button></template
      >
      <template v-else
        ><p>
          {{
            stage === 'old'
              ? 'کد ارسال‌شده به شمارهٔ فعلی را وارد کنید.'
              : 'کد تأیید پیامکی را وارد کنید.'
          }}
        </p>
        <label
          >کد تأیید پیامکی<input
            v-model="code"
            dir="ltr"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            minlength="6"
            maxlength="6"
            required /></label
        ><label v-if="stage === 'old'"
          >شمارهٔ همراه جدید<input
            v-model="mobile"
            type="tel"
            dir="ltr"
            data-kind="mobile"
            maxlength="20"
            required /></label
        ><template v-if="action === 'password'"
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
        ><button class="button primary" :disabled="busy">
          {{
            busy
              ? 'در حال بررسی…'
              : stage === 'old'
                ? 'تأیید شمارهٔ فعلی و ارسال به شمارهٔ جدید'
                : 'ثبت تغییر و بستن نشست‌ها'
          }}
        </button></template
      ><button
        v-if="stage !== 'idle'"
        type="button"
        class="button secondary"
        :disabled="busy"
        @click="choose(action)"
      >
        بازگشت و درخواست کد تازه</button
      ><ApiNotice :message="message" /></FormShell
    ><NuxtLink to="/reset-password" class="text-link">بازیابی رمز عبور با پیامک</NuxtLink>
  </div>
</template>
