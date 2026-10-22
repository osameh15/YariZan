<script setup lang="ts">
import { LEGAL_APPROVAL, legalStatusText } from '#shared/legal';
const props = defineProps<{ title: string; intro: string; index?: boolean }>();
const router = useRouter();
// Back goes to the previous page of this site only. Vue Router records the previous in-app path in
// history.state.back; a direct visit (or one from another site) has none, so the link falls back to
// the legal directory. It never follows an external or query-supplied URL.
function back(event: MouseEvent) {
  const previous = import.meta.client ? (window.history.state?.back as unknown) : null;
  if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//')) {
    event.preventDefault();
    router.back();
  }
}
const status = legalStatusText();
const approved = LEGAL_APPROVAL.approved;
useHead({ meta: props.index ? [] : [{ name: 'robots', content: approved ? 'index' : 'noindex' }] });
</script>
<template>
  <section class="wrap section legal-document">
    <NuxtLink v-if="!index" class="legal-back" to="/legal" @click="back"
      ><span aria-hidden="true">←</span> بازگشت</NuxtLink
    >
    <div class="page-intro">
      <p class="eyebrow">قوانین و اطلاعات</p>
      <h1>{{ title }}</h1>
      <p>{{ intro }}</p>
    </div>
    <p class="legal-status" :class="{ proposed: !approved }" role="note">{{ status }}</p>
    <article class="panel legal-body"><slot /></article>
  </section>
</template>
