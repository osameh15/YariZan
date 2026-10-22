<script setup lang="ts">
import { PRIMARY_SUPPORT_PHONE } from '#shared/contact';
import type { ApiResult } from '#shared/api';
import { gradeNames, availability } from '#shared/domain';
import PriceBlock from '~/components/PriceBlock.vue';
const route = useRoute(),
  match = /^(?:grade-|yarizan-g)([1-6])$/.exec(String(route.params.slug));
if (!match) throw createError({ statusCode: 404, statusMessage: 'محصول پیدا نشد' });
const { data: products, status, error, refresh } = await useCatalog();
const product = computed(() => products.value?.find((p) => p.grade === Number(match[1])));
useSeoMeta({
  title: () => (product.value ? `${product.value.title_fa} | یاریزان` : 'محصولات یاریزان'),
});
const assistance = ref(false);
const { publicOnly, storefront } = useSiteMode();
// Public-only profiles have no API: commerce capabilities are never requested.
const commerce = publicOnly.value
  ? ref<ApiResult<'/api/v2/commerce/capabilities', 'get'> | null>(null)
  : (
      await useFetch<ApiResult<'/api/v2/commerce/capabilities', 'get'>>(
        '/api/v2/commerce/capabilities',
      )
    ).data;
</script>
<template>
  <section class="wrap section">
    <NuxtLink to="/products" class="text-link"
      >محصولات / پایهٔ {{ gradeNames[Number(match?.[1]) - 1] }}</NuxtLink
    ><LoadState :loading="status === 'pending'" :error="!!error" @retry="refresh()"
      ><div v-if="product" class="product-detail">
        <div class="detail-art">
          <div class="product-art" :data-grade="product.grade">
            <span class="small-label">یاریزان</span
            ><span class="grade-number">{{
              new Intl.NumberFormat('fa-IR').format(product.grade)
            }}</span
            ><strong>پایهٔ {{ gradeNames[product.grade - 1] }}</strong
            ><img src="/brand/symbol.webp" width="90" height="90" alt="" />
          </div>
        </div>
        <div>
          <span
            class="badge"
            :class="product.publication_status === 'coming_soon' ? 'neutral' : 'available'"
            >{{ availability(product, publicOnly) }}</span
          >
          <h1>{{ product.title_fa }}</h1>
          <p class="hero-lead">
            یک دنیای مستقل برای بازی و یادگیری در پایهٔ {{ gradeNames[product.grade - 1] }} دبستان.
          </p>
          <p>
            همراهی فارسی برای تجربه‌های آموزشی کودک، در برنامهٔ ویندوز یاریزان. جزئیات محتوای هر
            نسخه هنگام عرضه اعلام می‌شود.
          </p>
          <div class="detail-price">
            <PriceBlock
              :list="product.price_irr"
              :test-price="product.test_price"
              :promotion="product.publication_status === 'coming_soon' ? null : product.promotion"
              detail
            />
          </div>
          <p v-if="product.publication_status === 'coming_soon'" class="notice">
            این پایه هنوز عرضه نشده است. فروش و فعال‌سازی آن در دسترس نیست.
          </p>
          <template v-else-if="publicOnly">
            <p v-if="storefront" class="notice">
              خرید اینترنتی، فعال‌سازی و شروع آزمایش این پایه به‌زودی فعال می‌شود. قیمت
              نمایش‌داده‌شده قیمت رسمی است، اما هنوز هیچ سفارش یا پرداختی در این سایت ثبت نمی‌شود.
            </p>
            <p v-else class="notice">
              یاریزان در مرحلهٔ معرفی است. خرید اینترنتی، فعال‌سازی و شروع آزمایش این پایه هنوز در
              دسترس نیست و هیچ پرداختی در این سایت انجام نمی‌شود.
            </p>
            <a class="button primary phone" :href="'tel:' + PRIMARY_SUPPORT_PHONE.tel" dir="ltr">{{
              PRIMARY_SUPPORT_PHONE.display
            }}</a>
          </template>
          <template v-else>
            <NuxtLink
              v-if="product.sale_enabled && commerce?.checkout_enabled"
              class="button primary"
              :to="'/checkout?sku=' + product.sku"
              >خرید آزمایشی این پایه</NuxtLink
            >
            <p v-if="commerce?.checkout_enabled" class="muted">
              پرداخت در این محیط شبیه‌سازی می‌شود؛ هیچ پولی دریافت نمی‌شود.
            </p>
            <button v-if="product.sale_enabled" class="button primary" @click="assistance = true">
              راهنمای تهیهٔ این نسخه ↗
            </button>
            <p v-else class="notice">فروش این نسخه فعلاً متوقف است.</p>
            <p class="muted">
              پرداخت اینترنتی هنوز فعال نیست؛ مبلغی در سایت دریافت نمی‌شود.
            </p></template
          >
          <div class="detail-facts">
            <p>✓ مجوز همیشگی، ویژهٔ همین پایه و دستگاه تأییدشده</p>
            <p>✓ اجرای آفلاین پس از فعال‌سازی مجوز معتبر</p>
            <p v-if="product.trial_enabled">✓ دو فرصت آزمایش؛ اینترنت فقط برای شروع</p>
            <p v-else>آزمایش این پایه فعلاً در دسترس نیست.</p>
            <p v-if="!product.activation_enabled">فعال‌سازی جدید این پایه فعلاً غیرفعال است.</p>
          </div>
          <NuxtLink to="/support" class="text-link">راهنمای دریافت برنامه و پشتیبانی ←</NuxtLink>
        </div>
      </div>
      <div v-else class="notice">این محصول در فهرست عمومی موجود نیست.</div></LoadState
    >
    <div class="faq-list section">
      <details>
        <summary>آیا برای هر بار اجرای نسخهٔ خریداری‌شده اینترنت لازم است؟</summary>
        <p>
          خیر. مجوز معتبرِ ذخیره‌شده برای همان دستگاه و پایه، دسترسی همیشگی و آفلاین می‌دهد. اختلال
          اینترنت مجوز را لغو نمی‌کند.
        </p>
      </details>
      <details>
        <summary>هر نوبت آزمایش چقدر طول می‌کشد؟</summary>
        <p>
          تا زمانی که همان برنامه باز است، محدودیت زمانی ندارد. پس از خروج کامل، شروع نوبت بعدی به
          اینترنت نیاز دارد.
        </p>
      </details>
    </div>
    <BaseDialog v-model="assistance" title="راهنمای تهیهٔ یاریزان"
      ><p>
        پرداخت اینترنتی هنوز آماده نیست. برای دریافت برنامه و راهنمای تهیهٔ پایهٔ موردنظر با
        پشتیبانی تماس بگیرید.
      </p>
      <a class="button primary phone" :href="'tel:' + PRIMARY_SUPPORT_PHONE.tel" dir="ltr">{{
        PRIMARY_SUPPORT_PHONE.display
      }}</a>
      <p class="muted">این صفحه هیچ خرید یا پرداختی ثبت نمی‌کند.</p></BaseDialog
    >
  </section>
</template>
