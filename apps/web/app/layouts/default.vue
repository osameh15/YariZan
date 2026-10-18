<script setup lang="ts">
const open = ref(false);
const { brochure } = useSiteMode();
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
        ><NuxtLink v-if="!brochure" to="/connect">اتصال برنامه</NuxtLink
        ><NuxtLink to="/support">همراه شما</NuxtLink>
      </nav>
      <NuxtLink v-if="!brochure" class="button secondary desktop-login" to="/account"
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
        ><template v-if="!brochure"
          ><NuxtLink to="/connect">اتصال برنامه</NuxtLink
          ><NuxtLink to="/account">حساب من</NuxtLink></template
        ><NuxtLink to="/support">پشتیبانی</NuxtLink>
      </nav></BaseDialog
    >
    <div v-if="brochure" class="wrap brochure-notice" role="note">
      <span aria-hidden="true">✦</span>
      <p>
        یاریزان در مرحلهٔ معرفی است. ثبت‌نام، ورود به حساب، خرید، فعال‌سازی و شروع آزمایش برنامه
        هنوز در دسترس نیست. برای راهنمایی با پشتیبانی تماس بگیرید.
      </p>
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
          ><NuxtLink v-if="!brochure" to="/connect">اتصال امن برنامه</NuxtLink
          ><NuxtLink to="/support">پرسش‌ها و پشتیبانی</NuxtLink
          ><NuxtLink v-if="!brochure" to="/login">ورود به حساب</NuxtLink>
        </nav>
        <nav aria-label="پیوندهای مرتبط">
          <span>پیوندهای مرتبط</span>
          <a href="https://oarnova.games">اوآر نوا</a>
          <a href="https://osameh.dev">نمونه‌کارهای توسعه‌دهنده</a>
        </nav>
        <div>
          <p>کنار شما هستیم</p>
          <div class="footer-phones">
            <a class="phone" href="tel:09188764024" dir="ltr">۰۹۱۸-۸۷۶-۴۰۲۴</a>
            <a class="phone" href="tel:09369642754" dir="ltr">۰۹۳۶-۹۶۴-۲۷۵۴</a>
          </div>
          <p class="muted">فروش اینترنتی در مرحلهٔ آماده‌سازی است.</p>
        </div>
      </div>
      <div class="footer-credits">
        <div class="wrap footer-bottom">
          <a class="studio-credit" href="https://oarnova.games" dir="ltr">
            <img src="/brand/oar-nova-games.png" width="64" height="64" alt="" />
            <span>OAR Nova Games Studio</span>
          </a>
          <p class="footer-copyright">حق مالکیت سایت برای یاریزان محفوظ است.</p>
        </div>
      </div>
    </footer>
  </div>
</template>
