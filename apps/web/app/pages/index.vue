<script setup lang="ts">
const { data: products, status, error, refresh } = await useCatalog();
const { publicOnly } = useSiteMode();
useSeoMeta({ title: 'یاریزان | یادگیری با طعم بازی' });
</script>
<template>
  <section class="hero wrap">
    <div class="hero-copy">
      <p class="eyebrow"><span></span>برای شش فصلِ شیرینِ دبستان</p>
      <h1>بازی می‌کنیم،<br /><em>یاد می‌گیریم.</em></h1>
      <p class="hero-lead">
        کنجکاوی‌های کوچک، کشف‌های بزرگ.<br />یاریزان، همراه فارسیِ بازی و یادگیری بچه‌های دبستان.
      </p>
      <div class="actions">
        <NuxtLink class="button primary" to="/products"
          >کشف دنیای پایه‌ها <span aria-hidden="true">←</span></NuxtLink
        ><NuxtLink v-if="!publicOnly" class="text-link" to="/connect"
          >برنامه را دارم؛ متصل می‌شوم ↗</NuxtLink
        ><NuxtLink v-else class="text-link" to="/support"
          >پرسشی دارید؟ با ما تماس بگیرید ↗</NuxtLink
        >
      </div>
      <div class="hero-footnote">
        <span class="seal" aria-hidden="true">✦</span>
        <p>
          دو فرصت تجربه، برای هر پایه<br /><small
            >پس از شروع، بدون نیاز به اینترنت بازی کنید.</small
          >
        </p>
      </div>
    </div>
    <div class="hero-scene" aria-hidden="true">
      <span class="orbit orbit-one">الف</span><span class="orbit orbit-two">۲ + ۱</span
      ><span class="orbit orbit-three">✧</span>
      <div class="book-shadow"></div>
      <div class="hero-book">
        <div class="spine"></div>
        <span class="book-edition">پایهٔ اول دبستان</span
        ><img src="/brand/logo.webp" width="220" height="170" alt="" />
        <div class="cover-window"><span>۱</span><span>ب</span><span>✦</span></div>
        <p>یک کتاب، پر از تجربه‌های تازه</p>
        <div class="cover-bottom">بازی کنیم · کشف کنیم · یاد بگیریم</div>
      </div>
      <div class="floating-note">
        <span>∞</span>
        <div>یادگیری، همراه شما<small>مجوز خریداری‌شده، همیشگی و آفلاین</small></div>
      </div>
    </div>
  </section>
  <section class="promise-strip">
    <div class="wrap promise-grid">
      <div>
        <span>۰۱</span>
        <p>فارسی، ساده و صمیمی</p>
      </div>
      <div>
        <span>۰۲</span>
        <p>شش پایه، شش دنیای مستقل</p>
      </div>
      <div>
        <span>۰۳</span>
        <p>بازی آفلاین پس از فعال‌سازی</p>
      </div>
    </div>
  </section>
  <section class="section wrap">
    <div class="section-heading">
      <div>
        <p class="eyebrow">هر پایه، شروع یک ماجرا</p>
        <h2>دنیای فرزند شما کدام است؟</h2>
      </div>
      <NuxtLink class="text-link" to="/products">همهٔ پایه‌ها ←</NuxtLink>
    </div>
    <LoadState
      :loading="status === 'pending'"
      :error="!!error"
      :empty="products?.length === 0"
      @retry="refresh()"
      ><div class="product-grid home-products">
        <ProductCard
          v-for="product in products?.slice(0, 3)"
          :key="product.sku"
          :product="product"
          :public-only="publicOnly"
        /></div
    ></LoadState>
  </section>
  <section class="learning-section">
    <div class="wrap learning-grid">
      <div class="learning-art" aria-hidden="true">
        <div class="tile">آ</div>
        <div class="tile">۳</div>
        <div class="tile">✦</div>
        <span>کوچک آغاز می‌شود، بزرگ می‌ماند.</span>
      </div>
      <div>
        <p class="eyebrow">خیال راحتِ خانواده، لذتِ کشفِ کودک</p>
        <h2>برای تجربه کردن،<br />عجله‌ای نیست.</h2>
        <p v-if="publicOnly" class="notice">
          این بخش، سیاست آزمایش و مجوز را پس از آغاز عرضه توضیح می‌دهد. شروع آزمایش و فعال‌سازی هنوز
          در دسترس نیست.
        </p>
        <p>
          هر دستگاه برای هر پایه دو فرصت آزمایشی دارد. اینترنت فقط برای شروع هر نوبت لازم است؛ تا
          وقتی برنامه باز است، بازی بدون محدودیت زمانی ادامه دارد.
        </p>
        <p>
          با فعال‌سازی مجوز خریداری‌شده، همان پایه روی دستگاه تأییدشده همیشگی و آفلاین در دسترس است.
        </p>
        <NuxtLink class="text-link" to="/support#faq">بیشتر بدانید ←</NuxtLink>
      </div>
    </div>
  </section>
  <section class="section wrap faq-section" id="faq">
    <div>
      <p class="eyebrow">پیش از شروع</p>
      <h2>پرسش‌های کوچک،<br />پاسخ‌های روشن.</h2>
      <NuxtLink class="text-link" to="/support">هنوز پرسشی دارید؟ ←</NuxtLink>
    </div>
    <div class="faq-list">
      <details>
        <summary>برای بازی همیشه اینترنت لازم است؟</summary>
        <p>
          خیر. آزمایش فقط برای شروع هر نوبت اینترنت می‌خواهد. نسخهٔ فعال‌شده با مجوز معتبر، آفلاین
          اجرا می‌شود.
        </p>
      </details>
      <details>
        <summary>خرید یک پایه، بقیهٔ پایه‌ها را هم باز می‌کند؟</summary>
        <p>هر پایه محصولی مستقل و مجوز آن ویژهٔ همان پایه و دستگاه است.</p>
      </details>
      <details>
        <summary>چطور خرید کنم؟</summary>
        <p>
          پرداخت اینترنتی هنوز فعال نیست. قیمت و وضعیت محصول را ببینید و برای راهنمایی با پشتیبانی
          تماس بگیرید. هیچ پرداختی در این سایت انجام نمی‌شود.
        </p>
      </details>
    </div>
  </section>
  <section class="wrap support-banner">
    <div>
      <p class="eyebrow">در این مسیر تنها نیستید</p>
      <h2>از اولین اتصال تا اولین بازی، کنار شماییم.</h2>
    </div>
    <NuxtLink class="button primary" to="/support">گفت‌وگو با پشتیبانی ↗</NuxtLink>
  </section>
</template>
