<script setup lang="ts">
import { errorMessage, toman } from '#shared/domain';
import type { ApiResult } from '#shared/api';
const api = useApi(),
  id = String(useRoute().query.order ?? ''),
  busy = ref(false),
  message = ref(''),
  order = ref<ApiResult<'/api/v2/orders/{id}', 'get'>>();
if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404 });
onMounted(async () => {
  try {
    order.value = await api.get('/api/v2/orders/{id}', { id });
  } catch (e) {
    message.value = errorMessage(e);
  }
});
async function complete(outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'UNKNOWN') {
  busy.value = true;
  try {
    await api.post('/api/v2/orders/{id}/simulate', { outcome }, { id });
    await navigateTo('/payment/result?order=' + id);
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="wrap section narrow">
    <div class="panel">
      <p class="eyebrow">فقط برای آزمون محلی</p>
      <h1>شبیه‌ساز پرداخت</h1>
      <ApiNotice
        kind="info"
        message="این صفحه درگاه بانکی نیست. شمارهٔ کارت، رمز یا اطلاعات بانکی وارد نکنید. پولی جابه‌جا نمی‌شود."
      />
      <p v-if="order">مبلغ آزمایشی: {{ toman(order.total_irr) }} تومان</p>
      <ApiNotice :message="message" />
      <div v-if="order" class="actions">
        <button class="button primary" :disabled="busy" @click="complete('SUCCESS')">
          تأیید پرداخت آزمایشی</button
        ><button class="button secondary" :disabled="busy" @click="complete('UNKNOWN')">
          شبیه‌سازی نتیجهٔ نامشخص</button
        ><button class="button secondary" :disabled="busy" @click="complete('FAILED')">
          شبیه‌سازی پرداخت ناموفق</button
        ><button class="button secondary" :disabled="busy" @click="complete('CANCELLED')">
          لغو پرداخت آزمایشی
        </button>
      </div>
    </div>
  </section>
</template>
