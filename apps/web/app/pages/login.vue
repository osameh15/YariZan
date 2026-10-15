<script setup lang="ts">
import { errorMessage, safeReturn } from '#shared/domain';
const username = ref(''),
  password = ref(''),
  busy = ref(false),
  message = ref('');
const api = useApi(),
  route = useRoute();
useSeoMeta({ title: 'ورود به حساب | یاریزان' });
async function submit() {
  busy.value = true;
  message.value = '';
  try {
    await api.post('/api/v2/auth/login', {
      username: username.value.trim(),
      password: password.value,
    });
    password.value = '';
    await navigateTo(safeReturn(route.query.return));
  } catch (e) {
    message.value = errorMessage(e);
    password.value = '';
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  password.value = '';
});
</script>
<template>
  <section class="wrap auth-section">
    <div class="auth-intro">
      <p class="eyebrow">خوش آمدید</p>
      <h1>ادامهٔ ماجرای<br />یادگیری شما.</h1>
      <p>
        با نام کاربری نمایش‌داده‌شده در برنامه وارد شوید. این نام برای همهٔ پایه‌های همین دستگاه
        یکسان است.
      </p>
      <NuxtLink class="text-link" to="/connect">اولین بار است؟ برنامه را متصل کنید ←</NuxtLink>
    </div>
    <form class="panel auth-card" @submit.prevent="submit">
      <h2>ورود به حساب</h2>
      <label
        >نام کاربری دستگاه<input
          v-model="username"
          dir="ltr"
          autocomplete="username"
          maxlength="64"
          required
          placeholder="YZ-…" /></label
      ><label
        >گذرواژه<input
          v-model="password"
          type="password"
          autocomplete="current-password"
          maxlength="128"
          required
      /></label>
      <p v-if="message" class="notice error" role="alert">{{ message }}</p>
      <button class="button primary" :disabled="busy">
        {{ busy ? 'در حال ورود…' : 'ورود به حساب' }}</button
      ><NuxtLink to="/support" class="text-link">گذرواژه را فراموش کرده‌ام</NuxtLink>
    </form>
  </section>
</template>
