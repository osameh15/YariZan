<script setup lang="ts">
import { errorMessage, toman } from '#shared/domain';
import { commerceState } from '#shared/commerce';
const api = useApi(),
  rows = ref<Record<string, unknown>[]>([]),
  offset = ref(0),
  next = ref<number | null>(null),
  busy = ref(false),
  message = ref('');
async function load() {
  busy.value = true;
  message.value = '';
  try {
    const r = await api.get('/api/v2/account/orders', undefined, { offset: offset.value });
    rows.value = r.items;
    next.value = r.items.length === 20 ? r.next_offset : null;
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <h2>سفارش‌های من</h2>
    <ApiNotice :message="message" />
    <p v-if="!busy && !rows.length">هنوز سفارشی ثبت نکرده‌اید.</p>
    <article v-for="row in rows" :key="String(row.id)" class="panel">
      <h3>{{ row.sku }}</h3>
      <p>
        {{
          commerceState({
            state: String(row.state),
            paid_at: row.paid_at,
            exception_code: row.exception_code,
          })
        }}
      </p>
      <p>{{ toman(Number(row.total_irr)) }} تومان</p>
      <NuxtLink class="text-link" :to="'/account/orders/' + row.id">جزئیات سفارش و مجوز</NuxtLink>
    </article>
    <div class="actions">
      <button
        v-if="offset"
        class="button secondary"
        @click="
          offset -= 20;
          load();
        "
      >
        صفحهٔ قبل</button
      ><button
        v-if="next !== null"
        class="button secondary"
        @click="
          offset = next!;
          load();
        "
      >
        صفحهٔ بعد
      </button>
    </div>
  </div>
</template>
