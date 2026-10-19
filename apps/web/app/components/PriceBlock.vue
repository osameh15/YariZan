<script setup lang="ts">
import { persianDigits } from '#shared/digits';
import { toman } from '#shared/domain';
import { endsLabel, type PromotionView } from '#shared/promotion';
// Customer price presentation. `promotion` must already be the ACTIVE promotion (the Backend, or the
// reviewed storefront list at render time, decides that): this component never infers a discount
// from the browser clock, and an absent promotion shows the regular price only. Availability is
// shown elsewhere; a discount never implies that a product can be bought.
defineProps<{ list: number | null; promotion?: PromotionView | null; detail?: boolean }>();
</script>
<template>
  <span
    class="price-block"
    :class="{ 'has-promotion': list !== null && promotion, detail }"
    :data-promotion="list !== null && promotion ? 'active' : 'none'"
  >
    <template v-if="list === null"
      ><span class="price"><small>قیمت هنگام آغاز فروش اعلام می‌شود</small></span></template
    >
    <template v-else-if="promotion"
      ><span class="price-was"
        ><span class="sr-only">قیمت اصلی: </span><s>{{ toman(list) }} تومان</s></span
      ><span class="price"
        ><span class="sr-only">قیمت ویژه: </span>{{ toman(promotion.price_irr) }}
        <small>تومان</small></span
      ><span class="discount-badge">{{ persianDigits(promotion.discount_percent) }}٪ تخفیف</span
      ><small class="promo-ends">{{ endsLabel(promotion.ends_at) }}</small></template
    >
    <span v-else class="price">{{ toman(list) }} <small>تومان</small></span>
  </span>
</template>
