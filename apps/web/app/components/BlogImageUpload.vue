<script setup lang="ts">
const model = defineModel<string | null>({ required: true });
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const api = useApi(true),
  csrf = useCookie<string>('yz_csrf_admin');
const preview = ref(''),
  message = ref(''),
  uploading = ref(false),
  dragging = ref(false),
  input = ref<HTMLInputElement>();
let generation = 0,
  alive = true;
const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
watch(
  model,
  async (value) => {
    const current = ++generation;
    preview.value = '';
    if (!value) return;
    if (value.startsWith('/blog-covers/')) {
      preview.value = value;
      return;
    }
    try {
      const id = value.split('/').pop()?.replace('.webp', '');
      const blob = await $fetch<Blob>('/api/v2/admin/blog/images/' + id, {
        responseType: 'blob',
        headers: { 'X-CSRF-Token': csrf.value },
        credentials: 'same-origin',
      });
      const url = await dataUrl(blob);
      if (alive && current === generation) preview.value = url;
    } catch {
      if (alive && current === generation) message.value = 'دریافت پیش‌نمایش تصویر ممکن نشد.';
    }
  },
  { immediate: true },
);
async function upload(file?: File) {
  if (!file || uploading.value || props.disabled) return;
  message.value = '';
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  ) {
    message.value = 'یک تصویر JPG، PNG یا WebP با حجم کمتر از ۸ مگابایت انتخاب کنید.';
    return;
  }
  uploading.value = true;
  emit('busy', true);
  const current = ++generation;
  try {
    const image = new Image();
    image.src = await dataUrl(file);
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 24000000) throw Error('dimensions');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.85, 0.7, 0.55]) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob && blob.size <= 330000) break;
    }
    if (!blob || blob.size > 330000) throw Error('size');
    const encoded = await dataUrl(blob);
    const result = await api.post('/api/v2/admin/blog/images', { data: encoded.split(',')[1]! });
    if (alive && current === generation) {
      model.value = result.url;
      message.value = 'تصویر آماده است. برای اعمال آن، نوشته را ذخیره کنید.';
    }
  } catch {
    if (alive && current === generation)
      message.value = 'بارگذاری تصویر ممکن نشد. تصویر کوچک‌تر یا فایل دیگری را امتحان کنید.';
  } finally {
    if (alive) {
      uploading.value = false;
      emit('busy', false);
      if (input.value) input.value.value = '';
    }
  }
}
function drop(event: DragEvent) {
  dragging.value = false;
  if (!uploading.value) void upload(event.dataTransfer?.files[0]);
}
onBeforeUnmount(() => {
  alive = false;
  generation++;
  emit('busy', false);
});
</script>
<template>
  <div class="blog-image-editor">
    <span class="field-label">تصویر شاخص نوشته</span>
    <div
      :class="['image-upload-zone', { dragging }]"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="drop"
    >
      <img
        v-if="preview"
        :src="preview"
        alt="پیش‌نمایش تصویر شاخص"
        width="1536"
        height="1024"
        class="image-upload-preview"
      />
      <div class="image-upload-copy">
        <span class="image-upload-symbol" aria-hidden="true"><AppIcon name="upload" /></span
        ><strong>{{
          uploading
            ? 'در حال آماده‌سازی تصویر…'
            : model
              ? 'تصویر این نوشته'
              : 'یک تصویر برای شروع نوشته'
        }}</strong>
        <p>تصویر را اینجا رها کنید یا از دستگاه انتخاب کنید.</p>
        <small>JPG، PNG یا WebP · حداکثر ۸ مگابایت · پیشنهاد: تصویر افقی</small>
        <div class="actions">
          <button
            type="button"
            class="button secondary"
            :disabled="disabled || uploading"
            @click="input?.click()"
          >
            {{ model ? 'تغییر تصویر' : 'انتخاب تصویر' }}</button
          ><button
            v-if="model"
            type="button"
            class="text-link"
            :disabled="disabled || uploading"
            @click="model = null"
          >
            <AppIcon name="trash" />
            حذف تصویر
          </button>
        </div>
      </div>
    </div>
    <input
      ref="input"
      type="file"
      hidden
      tabindex="-1"
      aria-label="فایل تصویر شاخص"
      accept="image/jpeg,image/png,image/webp"
      :disabled="disabled || uploading"
      @change="upload(($event.target as HTMLInputElement).files?.[0])"
    />
    <p v-if="message" role="status" class="muted">{{ message }}</p>
  </div>
</template>
