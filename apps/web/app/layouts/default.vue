<script setup lang="ts">
import { ENAMAD, SUPPORT_EMAIL, SUPPORT_PHONES } from '#shared/contact';
const open = ref(false);
const { publicOnly, storefront, desktop } = useSiteMode();
const route = useRoute();
// The eNamad seal is third-party: request it only after the page has loaded, so a slow or
// unreachable host never delays the load event, and show it only if the image really loads.
const sealUrl = ENAMAD.url.replace('/?id=', '/logo.aspx?id=');
const sealSrc = ref<string | undefined>(undefined);
const sealLoaded = ref(false);
onMounted(() => {
  const start = () => {
    sealSrc.value = sealUrl;
  };
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', () => setTimeout(start, 0), { once: true });
});
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
    <footer class="site-footer">
      <div class="wrap footer-grid">
        <div>
          <img src="/brand/symbol.webp" width="52" height="52" alt="" />
          <h2>هر بازی، یک قدم به یادگیری.</h2>
          <p>برای بچه‌های کنجکاو و خانواده‌های همراه.</p>
        </div>
        <nav aria-label="پیوندهای پایانی">
          <NuxtLink to="/products">محصولات</NuxtLink
          ><NuxtLink v-if="desktop" to="/connect">اتصال امن برنامه</NuxtLink
          ><NuxtLink to="/download">دریافت برای ویندوز</NuxtLink
          ><NuxtLink to="/support">پرسش‌ها و پشتیبانی</NuxtLink
          ><NuxtLink to="/legal">قوانین و حریم خصوصی</NuxtLink
          ><NuxtLink v-if="!publicOnly" to="/login">ورود به حساب</NuxtLink>
        </nav>
        <nav class="footer-related" aria-label="پیوندهای مرتبط">
          <strong class="footer-related-title">پیوندهای مرتبط</strong>
          <ul>
            <li><a href="https://oarnova.games">اوآر نوآ</a></li>
            <li><a href="https://osameh.dev">پورتفولیوی توسعه‌دهنده</a></li>
          </ul>
        </nav>
        <div>
          <p>کنار شما هستیم</p>
          <div class="footer-phones">
            <a
              v-for="phone in SUPPORT_PHONES"
              :key="phone.tel"
              class="phone"
              :href="'tel:' + phone.tel"
              dir="ltr"
              >{{ phone.display }}</a
            >
          </div>
          <a class="footer-email" :href="'mailto:' + SUPPORT_EMAIL" dir="ltr">{{
            SUPPORT_EMAIL
          }}</a>
        </div>
      </div>
      <div class="footer-credits">
        <div class="wrap footer-bottom">
          <a class="studio-credit" href="https://oarnova.games" dir="ltr">
            <img src="/brand/oar-nova-games.png" width="64" height="64" alt="" />
            <span>OAR Nova Games Studio</span>
          </a>
          <p class="footer-copyright">حق مالکیت سایت برای یاریزان محفوظ است.</p>
          <a
            class="enamad-seal"
            :class="{ 'is-loaded': sealLoaded }"
            :href="ENAMAD.url"
            target="_blank"
            rel="noopener"
            referrerpolicy="origin"
            ><img
              :src="sealSrc"
              alt="نماد اعتماد الکترونیکی (اینماد)"
              referrerpolicy="origin"
              width="90"
              @load="sealLoaded = true"
              @error="sealLoaded = false"
              height="100"
          /></a>
        </div>
      </div>
    </footer>
  </div>
</template>
