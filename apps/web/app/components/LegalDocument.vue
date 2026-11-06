<script setup lang="ts">
import { LEGAL_APPROVAL, legalStatusText } from '#shared/legal';
import { LEGAL_PAGES, LEGAL_CONTENT_UPDATED_ON } from '#shared/legal-navigation';
defineProps<{ title: string; intro: string; index?: boolean }>();
const route = useRoute();
const current = computed(() =>
  LEGAL_PAGES.find((page) => page.path === route.path.replace(/\/$/, '')),
);
const updated = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'long',
  timeZone: 'Asia/Tehran',
}).format(new Date(LEGAL_CONTENT_UPDATED_ON + 'T12:00:00Z'));
const status = legalStatusText();
const approved = LEGAL_APPROVAL.approved;
useHead({ meta: approved ? [] : [{ name: 'robots', content: 'noindex, nofollow' }] });
</script>
<template>
  <section class="wrap section legal-document legal-center">
    <nav class="legal-breadcrumb" aria-label="مسیر صفحه">
      <NuxtLink to="/">خانه</NuxtLink><span aria-hidden="true">/</span>
      <NuxtLink v-if="!index" to="/legal">قوانین و حریم خصوصی</NuxtLink>
      <span v-else aria-current="page">قوانین و حریم خصوصی</span>
      <template v-if="!index"
        ><span aria-hidden="true">/</span><span aria-current="page">{{ title }}</span></template
      >
    </nav>
    <header class="legal-hero">
      <div>
        <p class="eyebrow">روشن بخوانید، با آگاهی انتخاب کنید</p>
        <h1>{{ title }}</h1>
        <p class="legal-intro">{{ intro }}</p>
      </div>
      <NuxtLink v-if="!index" class="legal-back" to="/legal"
        ><span aria-hidden="true"><AppIcon name="back" /></span> بازگشت</NuxtLink
      >
    </header>
    <div class="legal-meta" role="note">
      <span :class="{ proposed: !approved }">{{ status }}</span
      ><span
        >به‌روزرسانی اطلاعات خدمات:
        <time :datetime="LEGAL_CONTENT_UPDATED_ON">{{ updated }}</time></span
      >
    </div>
    <div v-if="index" class="legal-directory"><slot /></div>
    <div v-else class="legal-layout">
      <aside class="legal-sidebar">
        <nav aria-label="صفحه‌های قوانین">
          <p class="legal-nav-label">راهنمای شما</p>
          <NuxtLink
            v-for="(page, i) in LEGAL_PAGES"
            :key="page.path"
            :to="page.path"
            :aria-current="current?.path === page.path ? 'page' : undefined"
            ><span aria-hidden="true">{{
              (i + 1).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })
            }}</span
            >{{ page.title }}</NuxtLink
          >
        </nav>
        <div class="legal-sidebar-help">
          <strong>پرسشی باقی مانده؟</strong>
          <p>شمارهٔ سفارش را نگه دارید و موضوع را با ما مطرح کنید.</p>
          <NuxtLink to="/support" class="text-link"
            >راهنما و تماس با پشتیبانی <AppIcon name="arrow-left"
          /></NuxtLink>
        </div>
      </aside>
      <div class="legal-reading">
        <div v-if="current" class="legal-takeaway">
          <span class="legal-takeaway-mark"><AppIcon name="info" :size="24" /></span>
          <div>
            <strong>پیش از خواندن</strong>
            <p>{{ current.summary }}</p>
          </div>
        </div>
        <details v-if="current" class="legal-contents">
          <summary>
            در این صفحه <span>{{ current.sections.length.toLocaleString('fa-IR') }} بخش</span>
          </summary>
          <nav aria-label="فهرست همین صفحه">
            <a v-for="section in current.sections" :key="section.id" :href="'#' + section.id">{{
              section.title
            }}</a>
          </nav>
        </details>
        <article class="legal-body" :aria-label="title"><slot /></article>
        <div class="legal-reading-end">
          <NuxtLink to="/legal">همهٔ قوانین و راهنماها <AppIcon name="arrow-left" /></NuxtLink
          ><a href="#main">بازگشت به بالای صفحه <AppIcon name="arrow-up" /></a>
        </div>
      </div>
    </div>
  </section>
</template>
