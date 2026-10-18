<script setup lang="ts">
defineProps<{ title: string; intro: string }>();
</script>
<template>
  <section class="wrap section legal-document">
    <div class="page-intro">
      <p class="eyebrow">قوانین و اطلاعات</p>
      <h1>{{ title }}</h1>
      <p>{{ intro }}</p>
    </div>
    <p class="legal-draft" role="note">
      پیش‌نویس: این متن هنوز توسط مالک و مشاور حقوقی تأیید نشده است. بخش‌های نشان‌دار هنوز تکمیل
      نشده‌اند.
    </p>
    <article class="panel legal-body"><slot /></article>
    <p><NuxtLink class="text-link" to="/legal">همهٔ متن‌های رسمی</NuxtLink></p>
  </section>
</template>
