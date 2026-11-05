<script setup lang="ts">
import { ENAMAD, SUPPORT_EMAIL, SUPPORT_PHONES } from '#shared/contact';
const { publicOnly, desktop } = useSiteMode();
const sealSrc = ref<string>(),
  sealLoaded = ref(false);
const sealUrl = ENAMAD.url.replace('/?id=', '/logo.aspx?id=');
onMounted(() => {
  const start = () => {
    sealSrc.value = sealUrl;
  };
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', () => setTimeout(start, 0), { once: true });
});
const { data } = await useBlogPosts();
</script>
<template>
  <footer class="site-footer footer-v2">
    <div class="wrap footer-masthead">
      <div class="footer-brand">
        <NuxtLink to="/" aria-label="یاریزان، بازگشت به خانه"
          ><img
            src="/brand/logo-horizontal.webp"
            alt="یاریزان؛ مجموعه بازی‌های آموزشی دبستان"
            width="512"
            height="194"
            loading="lazy"
            decoding="async"
        /></NuxtLink>
        <h2>هر بازی، یک قدم به یادگیری.</h2>
        <p>برای بچه‌های کنجکاو و خانواده‌های همراه.</p>
      </div>
      <div class="footer-contact-grid" aria-label="راه‌های ارتباط با پشتیبانی">
        <div class="footer-contact-card">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path
              d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z"
            />
          </svg>
          <div class="footer-contact-details">
            <span>تماس با پشتیبانی</span>
            <div class="footer-phone-links">
              <a
                v-for="phone in SUPPORT_PHONES"
                :key="phone.tel"
                :href="'tel:' + phone.tel"
                dir="ltr"
                >{{ phone.display }}</a
              >
            </div>
          </div>
        </div>
        <a class="footer-contact-card footer-contact-email" :href="'mailto:' + SUPPORT_EMAIL"
          ><svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m4 7 8 6 8-6" />
          </svg>
          <div class="footer-contact-details">
            <span>ایمیل پشتیبانی</span><strong dir="ltr">{{ SUPPORT_EMAIL }}</strong
            ><small>پرسش‌تان را برایمان بنویسید ↗</small>
          </div></a
        >
      </div>
    </div>
    <div class="wrap footer-content">
      <nav class="footer-link-group" aria-label="شروع با یاریزان">
        <h2>شروع با یاریزان</h2>
        <NuxtLink to="/products">دنیای پایه‌ها</NuxtLink
        ><NuxtLink to="/special-products">بازی‌های مستقل</NuxtLink
        ><NuxtLink to="/download">دریافت برای ویندوز</NuxtLink
        ><NuxtLink v-if="desktop" to="/connect">اتصال برنامه و دستگاه</NuxtLink>
      </nav>
      <nav class="footer-link-group" aria-label="همراه شما">
        <h2>همراه شما</h2>
        <NuxtLink to="/support">راهنما و پشتیبانی</NuxtLink
        ><NuxtLink v-if="!publicOnly" to="/account">حساب من</NuxtLink
        ><NuxtLink to="/legal">قوانین و حریم خصوصی</NuxtLink
        ><a href="https://oarnova.games">دربارهٔ استودیو اوآر نوآ ↗</a>
      </nav>
      <nav class="footer-reading" aria-label="نوشته‌های تازهٔ وبلاگ">
        <div class="footer-reading-heading">
          <h2>خواندنی‌های تازه</h2>
          <NuxtLink to="/blog">همهٔ نوشته‌ها ←</NuxtLink>
        </div>
        <ul v-if="data?.posts.length">
          <li v-for="post in data.posts.slice(0, 4)" :key="post.slug">
            <NuxtLink :to="'/blog/' + post.slug"
              ><small>{{ post.category }}</small
              ><strong>{{ post.title }}</strong></NuxtLink
            >
          </li>
        </ul>
        <p v-else>
          ایده‌های بازی، یادگیری در خانه و راهنمای یاریزان را در
          <NuxtLink to="/blog">وبلاگ</NuxtLink> بخوانید.
        </p>
      </nav>
    </div>
    <div class="footer-credits">
      <div class="wrap footer-bottom">
        <a class="studio-credit" href="https://oarnova.games" dir="ltr"
          ><img src="/brand/oar-nova-games.png" width="64" height="64" alt="" loading="lazy" /><span
            >OAR Nova Games Studio</span
          ></a
        >
        <div class="footer-fineprint">
          <p class="footer-copyright">حق مالکیت سایت برای یاریزان محفوظ است.</p>
          <a href="https://osameh.dev">پورتفولیوی توسعه‌دهنده ↗</a>
        </div>
        <a
          v-if="!sealLoaded"
          class="footer-trust-link"
          :href="ENAMAD.url"
          target="_blank"
          rel="noopener"
          referrerpolicy="origin"
          >استعلام نماد اعتماد ↗</a
        >
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
            height="100"
            @load="sealLoaded = true"
            @error="sealLoaded = false"
        /></a>
      </div>
    </div>
  </footer>
</template>
