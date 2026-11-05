<script setup lang="ts">
const open = ref(false);
const { publicOnly, storefront, desktop } = useSiteMode();
const route = useRoute();
watch(
  () => route.path,
  () => {
    open.value = false;
  },
);
</script>
<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <header class="site-header wrap">
      <NuxtLink class="brand" to="/" aria-label="یاریزان، خانه"
        ><img src="/brand/logo.webp" alt="یاریزان" width="118" height="78"
      /></NuxtLink>
      <nav class="desktop-nav" aria-label="منوی اصلی">
        <NuxtLink to="/">خانه</NuxtLink><NuxtLink to="/products">دنیای پایه‌ها</NuxtLink
        ><NuxtLink to="/special-products">محصولات ویژه</NuxtLink
        ><NuxtLink to="/blog">وبلاگ</NuxtLink
        ><NuxtLink v-if="desktop" to="/connect">اتصال برنامه</NuxtLink
        ><NuxtLink to="/download">دانلود برنامه</NuxtLink
        ><NuxtLink to="/support">همراه شما</NuxtLink>
      </nav>
      <NuxtLink v-if="!publicOnly" class="button secondary desktop-login" to="/account"
        >حساب من <span aria-hidden="true">↗</span></NuxtLink
      ><NuxtLink v-else class="button secondary desktop-login" to="/support"
        >پشتیبانی <span aria-hidden="true">↗</span></NuxtLink
      >
      <button
        class="menu-toggle button secondary"
        aria-label="باز کردن منو"
        :aria-expanded="open"
        @click="open = true"
      >
        ☰
      </button>
    </header>
    <BaseDialog v-model="open" title="به یاریزان خوش آمدید"
      ><nav class="mobile-nav" aria-label="منوی همراه">
        <NuxtLink to="/">خانه</NuxtLink><NuxtLink to="/products">دنیای پایه‌ها</NuxtLink
        ><NuxtLink to="/special-products">محصولات ویژه</NuxtLink
        ><NuxtLink to="/blog">وبلاگ یاریزان</NuxtLink
        ><NuxtLink v-if="desktop" to="/connect">اتصال برنامه</NuxtLink
        ><NuxtLink v-if="!publicOnly" to="/account">حساب من</NuxtLink
        ><NuxtLink to="/download">دانلود برنامه</NuxtLink
        ><NuxtLink to="/support">پشتیبانی</NuxtLink>
      </nav></BaseDialog
    >
    <div v-if="publicOnly" class="wrap brochure-notice" role="note">
      <span aria-hidden="true">✦</span>
      <p v-if="storefront">
        قیمت‌ها رسمی و به تومان است. برای تهیه و فعال‌سازی برنامه با پشتیبانی تماس بگیرید.
      </p>
      <p v-else>برای تهیه و فعال‌سازی برنامه با پشتیبانی یاریزان تماس بگیرید.</p>
    </div>
    <main id="main"><slot /></main>
    <SiteFooter />
  </div>
</template>
