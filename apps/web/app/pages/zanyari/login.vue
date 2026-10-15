<script setup lang="ts">
import { errorMessage } from '#shared/domain';
const username = ref(''),
  password = ref(''),
  code = ref(''),
  message = ref(''),
  busy = ref(false),
  api = useApi(true);
useSeoMeta({ title: 'ورود مدیریت | یاریزان' });
async function submit() {
  busy.value = true;
  message.value = '';
  try {
    await api.post('/api/v2/admin/auth/login', {
      username: username.value,
      password: password.value,
      mfa_code: code.value,
    });
    await navigateTo('/zanyari');
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
    password.value = '';
    code.value = '';
  }
}
onBeforeUnmount(() => {
  password.value = '';
  code.value = '';
});
</script>
<template>
  <section class="wrap auth-section">
    <div class="auth-intro">
      <p class="eyebrow">فضای مدیریت یاریزان</p>
      <h1>دسترسی مسئولانه،<br />با تأیید دومرحله‌ای.</h1>
      <p>
        عملیات حساس به مجوز نقش، ورود تازه و ثبت دلیل نیاز دارد. دانستن نشانی صفحه، مجوز دسترسی
        نیست.
      </p>
    </div>
    <form class="panel auth-card" @submit.prevent="submit">
      <h2>ورود مدیریت</h2>
      <label
        >نام کاربری مدیریت<input
          v-model="username"
          autocomplete="username"
          dir="ltr"
          required
          maxlength="64" /></label
      ><label
        >گذرواژه<input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          maxlength="128" /></label
      ><label
        >کد تأیید دومرحله‌ای<input
          v-model="code"
          dir="ltr"
          autocomplete="one-time-code"
          inputmode="numeric"
          pattern="[0-9]{6}"
          minlength="6"
          maxlength="6"
          required
      /></label>
      <p v-if="message" class="notice error" role="alert">{{ message }}</p>
      <button class="button primary" :disabled="busy">
        {{ busy ? 'در حال بررسی…' : 'ورود امن' }}
      </button>
    </form>
  </section>
</template>
