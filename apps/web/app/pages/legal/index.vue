<script setup lang="ts">
import { LEGAL_PAGES } from '#shared/legal-navigation';
useSeoMeta({
  title: 'قوانین و حریم خصوصی | یاریزان',
  description:
    'راهنمای خرید و پرداخت، مهلت ۱۵ دقیقه‌ای فاکتور، تحویل و انتقال مجوز، بازپرداخت و حریم خصوصی یاریزان.',
});
</script>
<template>
  <LegalDocument
    index
    title="قوانین و حریم خصوصی"
    intro="هر آنچه پیش از خرید و هنگام استفاده از یاریزان باید بدانید؛ روشن، دسته‌بندی‌شده و در دسترس."
  >
    <section class="legal-payment-overview" aria-labelledby="legal-payment-title">
      <div>
        <p class="eyebrow">از فاکتور تا دریافت مجوز</p>
        <h2 id="legal-payment-title">خرید با خیال روشن</h2>
        <p>پیش از پرداخت، محصول، مبلغ و دستگاه دریافت‌کنندهٔ مجوز را در فاکتور بررسی کنید.</p>
        <NuxtLink to="/legal/terms#section-5" class="text-link"
          >جزئیات مهلت و پرداخت <AppIcon name="arrow-left"
        /></NuxtLink>
      </div>
      <ol>
        <li>
          <span>۱</span>
          <div>
            <strong>۱۵ دقیقه برای شروع پرداخت</strong>
            <p>از زمان صدور فاکتور؛ زمان باقی‌مانده در سفارش نمایش داده می‌شود.</p>
          </div>
        </li>
        <li>
          <span>۲</span>
          <div>
            <strong>پیگیری نتیجه در همان سفارش</strong>
            <p>اگر نتیجه در حال بررسی است، حتی پس از پایان شمارش دوباره پرداخت نکنید.</p>
          </div>
        </li>
        <li>
          <span>۳</span>
          <div>
            <strong>دریافت مجوز در برنامه</strong>
            <p>پس از تأیید پرداخت، برنامه را روی دستگاه انتخاب‌شده به اینترنت متصل کنید.</p>
          </div>
        </li>
      </ol>
    </section>
    <nav class="legal-topic-grid" aria-label="موضوع‌های قوانین">
      <NuxtLink
        v-for="(page, i) in LEGAL_PAGES"
        :key="page.path"
        :to="page.path"
        class="legal-topic"
        ><div class="legal-topic-top">
          <span aria-hidden="true">{{
            (i + 1).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })
          }}</span
          ><span>{{ page.sections.length.toLocaleString('fa-IR') }} بخش</span>
        </div>
        <h2>{{ page.title }}</h2>
        <p>{{ page.description }}</p>
        <span class="legal-topic-action"
          >خواندن راهنما <span aria-hidden="true"><AppIcon name="arrow-left" /></span></span
      ></NuxtLink>
    </nav>
    <div class="legal-directory-help">
      <div>
        <h2>برای پیگیری سفارش کمک می‌خواهید؟</h2>
        <p>شمارهٔ سفارش و وضعیت پرداخت را آماده کنید؛ اطلاعات کارت و کد ورود را نفرستید.</p>
      </div>
      <NuxtLink class="button secondary" to="/support"
        >تماس با پشتیبانی <AppIcon name="arrow-left"
      /></NuxtLink>
    </div>
  </LegalDocument>
</template>
