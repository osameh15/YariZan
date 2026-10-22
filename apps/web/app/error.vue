<script setup lang="ts">
import { PRIMARY_SUPPORT_PHONE } from '#shared/contact';
const props = defineProps<{ error: { statusCode: number } }>();
useHead({ htmlAttrs: { lang: 'fa', dir: 'rtl' }, title: 'صفحه در دسترس نیست | یاریزان' });
const unavailable = computed(() => props.error.statusCode === 503);
</script>
<template>
  <div class="wrap section narrow">
    <img src="/brand/logo.webp" alt="یاریزان" width="130" height="90" />
    <div class="panel">
      <p class="eyebrow">راه را دوباره پیدا می‌کنیم</p>
      <h1 v-if="error.statusCode === 404">این صفحه پیدا نشد.</h1>
      <h1 v-else-if="unavailable">این بخش هنوز فعال نشده است.</h1>
      <h1 v-else>صفحه فعلاً در دسترس نیست.</h1>
      <p v-if="unavailable">
        یاریزان در مرحلهٔ معرفی است. ورود به حساب، ثبت‌نام، اتصال دستگاه، خرید، فعال‌سازی و بخش
        مدیریت هنوز در دسترس نیست. برای راهنمایی با پشتیبانی تماس بگیرید.
      </p>
      <p v-else>
        نشانی را بررسی کنید یا به صفحهٔ اصلی برگردید. اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید.
      </p>
      <a class="button primary" href="/">بازگشت به خانه</a
      ><a :href="'tel:' + PRIMARY_SUPPORT_PHONE.tel" class="text-link" dir="ltr">{{
        PRIMARY_SUPPORT_PHONE.display
      }}</a>
    </div>
  </div>
</template>
