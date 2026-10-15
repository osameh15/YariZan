<script setup lang="ts">
const open = ref(false);
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
        ><NuxtLink to="/connect">اتصال برنامه</NuxtLink><NuxtLink to="/support">همراه شما</NuxtLink>
      </nav>
      <NuxtLink class="button secondary desktop-login" to="/account"
        >حساب من <span aria-hidden="true">↗</span></NuxtLink
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
        ><NuxtLink to="/connect">اتصال برنامه</NuxtLink><NuxtLink to="/account">حساب من</NuxtLink
        ><NuxtLink to="/support">پشتیبانی</NuxtLink>
      </nav></BaseDialog
    >
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
          ><NuxtLink to="/connect">اتصال امن برنامه</NuxtLink
          ><NuxtLink to="/support">پرسش‌ها و پشتیبانی</NuxtLink
          ><NuxtLink to="/login">ورود به حساب</NuxtLink>
        </nav>
        <div>
          <p>کنار شما هستیم</p>
          <div class="footer-phones">
            <a class="phone" href="tel:09188764024" dir="ltr">0918-876-4024</a>
            <a class="phone" href="tel:09369642754" dir="ltr">0936-964-2754</a>
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
          <span>طراحی و توسعه: <a href="https://osameh.dev" dir="ltr">osameh.dev</a></span>
        </div>
        <p class="wrap footer-copyright">حق مالکیت سایت برای یاریزان محفوظ است.</p>
      </div>
    </footer>
  </div>
</template>
