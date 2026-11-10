<script setup lang="ts">
import { errorMessage } from '#shared/domain';
import type { ApiResult } from '#shared/api';
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), {
  label: 'تغییر دستگاه',
  disabled: false,
});
const api = useApi();
const choiceId = useId();
const open = ref(false),
  loading = ref(false),
  switching = ref(false),
  message = ref(''),
  selected = ref('');
const devices = ref<ApiResult<'/api/v2/account/device-list', 'get'>>([]);
async function show() {
  open.value = true;
  loading.value = true;
  message.value = '';
  selected.value = '';
  devices.value = [];
  try {
    devices.value = await api.get('/api/v2/account/device-list');
  } catch (error) {
    message.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}
async function select() {
  if (!selected.value || switching.value) return;
  switching.value = true;
  message.value = '';
  try {
    await api.post('/api/v2/account/switch-device', { username: selected.value });
    // No account or device identifiers are stored in browser storage.
    try {
      localStorage.setItem('yarizan-device-context', crypto.randomUUID());
    } catch {
      /* Storage may be blocked; server checks the expected device on mutations. */
    }
    window.location.reload();
  } catch (error) {
    message.value = errorMessage(error);
    switching.value = false;
  }
}
</script>
<template>
  <button class="button secondary" type="button" :disabled="disabled" @click="show">
    <AppIcon name="device" />{{ label }}
  </button>
  <BaseDialog v-model="open" title="انتخاب دستگاه" :locked="switching">
    <p class="muted">
      دستگاه موردنظر از همین شمارهٔ موبایل را انتخاب کنید؛ به ورود دوباره نیاز نیست.
    </p>
    <p v-if="loading" role="status">در حال دریافت دستگاه‌ها…</p>
    <ApiNotice :message="message" />
    <fieldset v-if="!loading && devices.length" class="device-switch-options" :disabled="switching">
      <legend class="sr-only">دستگاه‌های حساب شما</legend>
      <label
        v-for="device in devices"
        :key="device.username"
        class="device-choice"
        :class="{ 'is-current': device.current }"
      >
        <input
          v-model="selected"
          type="radio"
          :name="'device-switch-' + choiceId"
          :value="device.username"
          :disabled="device.current"
        />
        <span
          ><strong>{{ device.label || 'دستگاه بدون نام' }}</strong
          ><small dir="ltr">{{ device.username }}</small></span
        >
        <span v-if="device.current" class="pill" data-tone="ok">دستگاه انتخاب‌شده</span>
      </label>
    </fieldset>
    <p v-if="!loading && !message && !devices.some((device) => !device.current)" class="notice">
      دستگاه دیگری به این شمارهٔ موبایل متصل نیست. ابتدا برنامه را روی رایانهٔ دیگر به همین شماره
      متصل کنید.
    </p>
    <p class="muted">
      پس از تغییر، سفارش‌ها و مجوزهای دستگاه انتخاب‌شده نمایش داده می‌شوند. تغییر دستگاه، مجوزهای
      بازی را منتقل نمی‌کند.
    </p>
    <div class="dialog-action-footer">
      <button
        class="button primary"
        type="button"
        :disabled="loading || switching || !selected"
        @click="select"
      >
        {{ switching ? 'در حال تغییر دستگاه…' : 'انتخاب این دستگاه' }}
      </button>
      <button class="button secondary" type="button" :disabled="switching" @click="open = false">
        انصراف
      </button>
    </div>
  </BaseDialog>
</template>
<style scoped>
.device-switch-options {
  display: grid;
  gap: 12px;
  border: 0;
  padding: 0;
  margin-block: 20px;
}
.device-choice {
  align-items: center;
}
.device-choice.is-current {
  background: var(--surface-soft);
}
.device-choice > span:nth-child(2) {
  min-width: 0;
}
.device-choice small {
  display: block;
  overflow-wrap: anywhere;
}
.device-choice .pill {
  grid-column: 2;
  justify-self: start;
  display: inline-flex;
}
.dialog-action-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
</style>
