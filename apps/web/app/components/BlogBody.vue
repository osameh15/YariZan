<script setup lang="ts">
import { blogBlocks } from '#shared/blog-model';
const props = defineProps<{ body: string }>();
const blocks = computed(() => blogBlocks(props.body));
</script>
<template>
  <div class="blog-body">
    <template v-for="block in blocks" :key="block.id">
      <h2 v-if="block.type === 'heading'" :id="block.id">{{ block.text }}</h2>
      <ul v-else-if="block.type === 'list'">
        <li v-for="(item, index) in block.items" :key="index"><BlogInline :text="item" /></li>
      </ul>
      <p v-else-if="block.type === 'link'">
        <a :href="block.href">{{ block.text }}</a>
      </p>
      <p v-else><BlogInline :text="block.text" /></p>
    </template>
  </div>
</template>
