<script setup lang="ts">
defineProps<{ error: { statusCode: number } }>();
useHead({ htmlAttrs: { lang: 'fa', dir: 'rtl' }, title: 'صفحه در دسترس نیست | یاریزان' });
</script>
<template>
  <div class="wrap section narrow">
    <img src="/brand/logo.webp" alt="یاریزان" width="130" height="90" />
    <div class="panel">
      <p class="eyebrow">راه را دوباره پیدا می‌کنیم</p>
      <h1>{{ error.statusCode === 404 ? 'این صفحه پیدا نشد.' : 'صفحه فعلاً در دسترس نیست.' }}</h1>
      <p>
        نشانی را بررسی کنید یا به صفحهٔ اصلی برگردید. اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید.
      </p>
      <button class="button primary" @click="clearError({ redirect: '/' })">بازگشت به خانه</button
      ><a href="tel:09188764024" class="text-link" dir="ltr">۰۹۱۸-۸۷۶-۴۰۲۴</a>
    </div>
  </div>
</template>
