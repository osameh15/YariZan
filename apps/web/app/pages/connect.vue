<script setup lang="ts">
import { errorMessage } from '#shared/domain';
const id = ref(''),
  code = ref(''),
  password = ref(''),
  confirm = ref(''),
  busy = ref(false),
  message = ref(''),
  done = ref(false);
const preview = ref<{ username: string; requires_owner: boolean; expires_at: string } | null>(null),
  api = useApi();
useSeoMeta({ title: 'اتصال امن برنامه | یاریزان' });
async function inspect() {
  busy.value = true;
  message.value = '';
  try {
    preview.value = await api.post(
      '/api/v2/device-pairings/{id}/preview',
      { pairing_secret: code.value.trim() },
      { id: id.value.trim() },
    );
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function approve() {
  if (!preview.value) return;
  if (!preview.value.requires_owner && password.value !== confirm.value) {
    message.value = 'گذرواژه و تکرار آن یکسان نیستند.';
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    await api.post('/api/v2/auth/claim', {
      pairing_id: id.value.trim(),
      pairing_secret: code.value.trim(),
      ...(!preview.value.requires_owner ? { password: password.value } : {}),
    });
    done.value = true;
    code.value = '';
    password.value = '';
    confirm.value = '';
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
      { pairing_secret: code.value.trim() },
      { id: id.value.trim() },
    );
    preview.value = null;
    code.value = '';
    message.value = 'درخواست اتصال لغو شد.';
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  code.value = '';
  password.value = '';
  confirm.value = '';
});
</script>
<template>
  <section class="wrap section connect-grid">
    <div>
      <p class="eyebrow">از برنامه به حساب، امن و روشن</p>
      <h1>یک اتصال،<br />برای همهٔ پایه‌ها.</h1>
      <p class="hero-lead">
        اتصال را از برنامهٔ یاریزان شروع کنید؛ بعد همین‌جا دستگاه را تأیید کنید.
      </p>
      <ol class="steps">
        <li>
          <span>۱</span>
          <div>
            <strong>از برنامه درخواست بگیرید</strong>
            <p>دکمهٔ «اتصال به حساب» را در برنامهٔ ویندوز بزنید.</p>
          </div>
        </li>
        <li>
          <span>۲</span>
          <div>
            <strong>شناسه و کد را وارد کنید</strong>
            <p>کد موقت را فقط از برنامهٔ خودتان بگیرید؛ نه از فرد ناشناس.</p>
          </div>
        </li>
        <li>
          <span>۳</span>
          <div>
            <strong>دستگاه را تأیید کنید</strong>
            <p>نام کاربری را با برنامه مقایسه کنید. ادامهٔ اتصال در خود برنامه انجام می‌شود.</p>
          </div>
        </li>
      </ol>
    </div>
    <div class="panel connect-card">
      <template v-if="done"
        ><span class="success-mark" aria-hidden="true">✓</span>
        <h2>دستگاه تأیید شد.</h2>
        <p role="status">
          به برنامهٔ ویندوز برگردید تا اتصال امن کامل شود. این صفحه مجوز دستگاه را دریافت نمی‌کند.
        </p>
        <NuxtLink to="/login" class="button primary">ورود به حساب</NuxtLink></template
      >
      <form v-else-if="!preview" @submit.prevent="inspect">
        <h2>درخواست اتصال شما</h2>
        <label
          >شناسهٔ درخواست<input
            v-model="id"
            dir="ltr"
            maxlength="36"
            required
            autocomplete="off"
            pattern="[0-9a-f-]{36}" /></label
        ><label
          >کد موقت اتصال<input
            v-model="code"
            dir="ltr"
            minlength="43"
            maxlength="43"
            required
            autocomplete="off"
            spellcheck="false"
        /></label>
        <p class="muted">
          درخواست پنج دقیقه اعتبار دارد. کد را در نشانی صفحه یا پیام عمومی قرار ندهید.
        </p>
        <button class="button primary" :disabled="busy">
          {{ busy ? 'در حال بررسی…' : 'بررسی درخواست' }}
        </button>
      </form>
      <form v-else @submit.prevent="approve">
        <p class="eyebrow">نام را با برنامه مقایسه کنید</p>
        <h2>این دستگاهِ شماست؟</h2>
        <p class="device-username" dir="ltr">{{ preview.username }}</p>
        <template v-if="preview.requires_owner"
          ><p>این دستگاه حساب دارد. برای تأیید پروفایل جدید، با حساب صاحب دستگاه وارد شوید.</p>
          <NuxtLink to="/login?return=/account" class="text-link">ورود صاحب حساب ←</NuxtLink>
          <p class="muted">
            پس از ورود، به صفحهٔ اتصال برگردید و کد برنامه را دوباره وارد کنید.
          </p></template
        ><template v-else
          ><label
            >گذرواژهٔ جدید<input
              v-model="password"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required /></label
          ><label
            >تکرار گذرواژه<input
              v-model="confirm"
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
          /></label>
          <p class="muted">دست‌کم ۱۲ نویسه؛ نام کاربری عمومی، گذرواژه نیست.</p></template
        >
        <div class="actions">
          <button class="button primary" :disabled="busy">
            {{ busy ? 'در حال تأیید…' : 'این دستگاه را تأیید می‌کنم' }}</button
          ><button class="button secondary" type="button" :disabled="busy" @click="cancel">
            لغو درخواست
          </button>
        </div>
      </form>
      <p v-if="message" class="notice error" role="alert">{{ message }}</p>
    </div>
  </section>
</template>
