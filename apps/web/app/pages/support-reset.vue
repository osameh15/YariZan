<script setup lang="ts">
import { errorMessage } from '#shared/domain';
const grant = ref(''),
  password = ref(''),
  confirm = ref(''),
  busy = ref(false),
  message = ref(''),
  done = ref(false),
  api = useApi();
useSeoMeta({ title: 'بازیابی رمز عبور | یاریزان' });
async function submit() {
  if (password.value !== confirm.value) {
    message.value = 'رمز عبور و تکرار آن یکسان نیستند.';
    return;
  }
  busy.value = true;
  try {
    await api.post('/api/v2/auth/password-reset/complete', {
      reset_grant: grant.value.trim(),
      password: password.value,
    });
    done.value = true;
    api.clear();
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
    grant.value = '';
    password.value = '';
    confirm.value = '';
  }
}
onBeforeUnmount(() => {
  grant.value = '';
  password.value = '';
  confirm.value = '';
});
</script>
<template>
  <section class="wrap section narrow">
    <FormShell v-if="!done" class="panel" @submit.prevent="submit">
      <p class="eyebrow">با تأیید مستقل پشتیبانی</p>
      <h1>رمز عبور تازه</h1>
      <p>
        مجوز یک‌بارمصرف را فقط از پشتیبانیِ تأییدشده بگیرید. نشانی این صفحه نباید حاوی مجوز باشد.
      </p>
      <label
        >مجوز بازیابی<input
          v-model="grant"
          dir="ltr"
          minlength="43"
          maxlength="43"
          autocomplete="off"
          required /></label
      ><label
        >رمز عبور جدید<input
          v-model="password"
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
          minlength="12"
          maxlength="128"
          required
      /></label>
      <ApiNotice :message="message" />
      <button class="button primary" :disabled="busy">ثبت رمز عبور تازه</button
      ><NuxtLink to="/support" class="text-link">مجوز ندارم؛ تماس با پشتیبانی</NuxtLink>
    </FormShell>
    <div v-else class="panel">
      <h1>رمز عبور تغییر کرد.</h1>
      <p role="status">نشست‌های قبلی بسته شدند. با رمز عبور تازه وارد شوید.</p>
      <NuxtLink class="button primary" to="/login">ورود به حساب</NuxtLink>
    </div>
  </section>
</template>
