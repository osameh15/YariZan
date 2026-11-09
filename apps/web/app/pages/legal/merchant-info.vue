<script setup lang="ts">
import { ENAMAD, INFO_EMAIL, MERCHANT, SUPPORT_EMAIL, SUPPORT_PHONES } from '#shared/contact';
const { publicOnly } = useSiteMode();
useSeoMeta({
  description: 'فروشندهٔ یاریزان کیست و چطور با او در تماس باشید.',
  title: 'اطلاعات فروشنده | یاریزان',
});
</script>
<template>
  <LegalDocument title="اطلاعات فروشنده" intro="فروشندهٔ یاریزان کیست و چطور با او در تماس باشید.">
    <h2 id="section-1">فروشنده</h2>
    <dl class="legal-facts">
      <div>
        <dt>نام تجاری</dt>
        <dd>{{ MERCHANT.tradeNameFa }}</dd>
      </div>
      <div>
        <dt>نام انگلیسی</dt>
        <dd>
          <bdi dir="ltr">{{ MERCHANT.brandEn }}</bdi>
        </dd>
      </div>
      <div>
        <dt>محل فعالیت</dt>
        <dd>{{ MERCHANT.locationFa }}</dd>
      </div>
      <div>
        <dt>محصول</dt>
        <dd>یاریزان؛ بازی‌های آموزشی برای ویندوز، با مجوز جداگانه برای هر پایه یا بازی مستقل</dd>
      </div>
    </dl>
    <p>
      یاریزان با نام تجاری بالا عرضه می‌شود. این نام تجاری شمارهٔ ثبت شرکت ندارد و فروشنده خود را
      شرکت ثبت‌شده معرفی نمی‌کند.
    </p>
    <h2 id="section-2">راه‌های تماس</h2>
    <dl class="legal-facts">
      <div>
        <dt>تلفن پشتیبانی</dt>
        <dd class="legal-phones">
          <template v-for="(phone, i) in SUPPORT_PHONES" :key="phone.tel"
            ><span v-if="i > 0"> و </span
            ><a :href="'tel:' + phone.tel" dir="ltr">{{ phone.display }}</a></template
          >
        </dd>
      </div>
      <div>
        <dt>ایمیل پشتیبانی</dt>
        <dd>
          <a :href="'mailto:' + SUPPORT_EMAIL" dir="ltr">{{ SUPPORT_EMAIL }}</a>
        </dd>
      </div>
      <div>
        <dt>ایمیل عمومی</dt>
        <dd>
          <a :href="'mailto:' + INFO_EMAIL" dir="ltr">{{ INFO_EMAIL }}</a>
        </dd>
      </div>
    </dl>
    <h2 id="section-3">نماد اعتماد الکترونیکی</h2>
    <p>نام فروشگاه در اینماد: «یاریزان» / <bdi dir="ltr">Yarizan</bdi>.</p>
    <p>دامنهٔ دارای اینماد: <bdi dir="ltr">yarizan.oarnova.games</bdi>.</p>
    <p>
      شناسهٔ نماد اعتماد این فروشگاه
      <bdi dir="ltr">{{ ENAMAD.id }}</bdi> است. اطلاعات ثبت‌شدهٔ نماد را در سامانهٔ رسمی اینماد
      ببینید:
      <a
        class="text-link"
        :href="ENAMAD.url"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="مشاهدهٔ اطلاعات نماد اعتماد یاریزان در سایت اینماد (در زبانهٔ تازه)"
        >مشاهدهٔ نماد در سایت اینماد <AppIcon name="external"
      /></a>
    </p>
    <h2 id="section-4">پرداخت</h2>
    <p>نام پذیرندهٔ تأییدشدهٔ زرین‌پال: «{{ MERCHANT.tradeNameFa }}».</p>
    <p v-if="publicOnly">
      در این نسخهٔ اطلاع‌رسانی، خرید داخل سایت در دسترس نیست. برای راهنمایی دربارهٔ تهیهٔ محصول با
      پشتیبانی تماس بگیرید.
    </p>
    <p v-else>
      خرید اینترنتی محصولات عرضه‌شده در سایت فعال است و پرداخت از راه درگاه
      {{ MERCHANT.paymentProviderFa }} انجام می‌شود. مبلغ نهایی به تومان و دستگاه دریافت‌کنندهٔ
      مجوز، پیش از پرداخت در فاکتور مشخص است. اطلاعات کارت بانکی را فقط در صفحهٔ درگاه وارد کنید.
    </p>
    <h2 id="section-5">فاکتور و مهلت پرداخت</h2>
    <p>
      هر فاکتور از زمان صدور ۱۵ دقیقه برای شروع پرداخت اعتبار دارد. زمان باقی‌مانده در صفحهٔ سفارش
      نمایش داده می‌شود. پایان این زمان به معنی پرداخت موفق یا بازگشت وجه نیست؛ وضعیت نهایی را در
      همان سفارش بررسی کنید.
    </p>
    <p>
      اگر پرداخت پیش از پایان مهلت شروع شده باشد، تأیید آن می‌تواند بعد از پایان شمارش ادامه داشته
      باشد. تا وقتی نتیجه در حال بررسی است، دوباره پرداخت نکنید. جزئیات در
      <NuxtLink to="/legal/refund">سیاست لغو و بازپرداخت</NuxtLink> آمده است.
    </p>
  </LegalDocument>
</template>
