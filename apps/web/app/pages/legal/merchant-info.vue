<script setup lang="ts">
import { ENAMAD, INFO_EMAIL, MERCHANT, SUPPORT_EMAIL, SUPPORT_PHONES } from '#shared/contact';
useSeoMeta({ title: 'اطلاعات فروشنده | یاریزان' });
</script>
<template>
  <LegalDocument title="اطلاعات فروشنده" intro="فروشندهٔ یاریزان کیست و چطور با او در تماس باشید.">
    <h2>فروشنده</h2>
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
        <dd>یاریزان؛ بازی‌های آموزشی برای ویندوز، با مجوز جداگانه برای هر پایه</dd>
      </div>
    </dl>
    <p>
      یاریزان با نام تجاری بالا عرضه می‌شود. این نام تجاری شمارهٔ ثبت شرکت ندارد و فروشنده خود را
      شرکت ثبت‌شده معرفی نمی‌کند.
    </p>
    <h2>راه‌های تماس</h2>
    <dl class="legal-facts">
      <div>
        <dt>تلفن پشتیبانی</dt>
        <dd class="legal-phones">
          <a
            v-for="phone in SUPPORT_PHONES"
            :key="phone.tel"
            :href="'tel:' + phone.tel"
            dir="ltr"
            >{{ phone.display }}</a
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
    <h2>نماد اعتماد الکترونیکی</h2>
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
        >مشاهدهٔ نماد در سایت اینماد ↗</a
      >
    </p>
    <h2>پرداخت</h2>
    <p>
      پرداخت اینترنتی از راه درگاه {{ MERCHANT.paymentProviderFa }} انجام می‌شود. تا زمانی که خرید
      اینترنتی روی همین سایت فعال اعلام نشده است، پرداخت آنلاین در دسترس نیست و برای تهیهٔ برنامه
      می‌توانید با پشتیبانی تماس بگیرید.
    </p>
  </LegalDocument>
</template>
