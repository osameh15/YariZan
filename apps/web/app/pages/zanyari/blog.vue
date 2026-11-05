<script setup lang="ts">
import { blogDate, type BlogPost } from '#shared/blog-model';
import { errorMessage } from '#shared/domain';
useSeoMeta({ title: 'مدیریت وبلاگ | یاریزان' });
const api = useApi(true);
const route = useRoute(),
  imageBusy = ref(false);
const articlePicker = computed({
  get: () => selected.value?.id ?? '',
  set: (id: string) => open(posts.value.find((p) => p.id === id)),
});
const pickerOptions = computed(() =>
  posts.value.map((p) => ({ value: p.id!, label: p.title, description: p.slug })),
);
const filterOptions = [
  { value: 'ALL', label: 'همهٔ نوشته‌ها' },
  { value: 'DRAFT', label: 'پیش‌نویس‌ها' },
  { value: 'PUBLISHED', label: 'منتشرشده‌ها' },
  { value: 'ARCHIVED', label: 'بایگانی‌شده‌ها' },
];
const posts = ref<BlogPost[]>([]),
  busy = ref(false),
  message = ref(''),
  success = ref(false);
const permitted = ref(false),
  preview = ref(false),
  publishing = ref(false);
const empty = () => ({
  cover_image: null as string | null,
  cover_alt: '',
  slug: '',
  title: '',
  description: '',
  category: 'راهنمای خانواده',
  body: '',
  seo_title: '',
  seo_description: '',
  state: 'DRAFT' as const,
  expected_revision: 0,
});
const form = ref<
  Omit<ReturnType<typeof empty>, 'state'> & { state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }
>(empty());
const selected = ref<BlogPost>();
const initial = ref('');
const dirty = computed(() => JSON.stringify(form.value) !== initial.value);
const filter = ref('ALL');
const visible = computed(() =>
  posts.value.filter((p) => filter.value === 'ALL' || p.state === filter.value),
);
const stateLabel = (state?: string) =>
  ({ DRAFT: 'پیش‌نویس', PUBLISHED: 'منتشرشده', ARCHIVED: 'بایگانی‌شده' })[state ?? 'DRAFT'];
function open(post?: BlogPost) {
  if (dirty.value && !window.confirm('تغییرات ذخیره نشده است. از آن‌ها صرف‌نظر می‌کنید؟')) return;
  selected.value = post;
  form.value = post
    ? {
        cover_image: post.cover_image ?? null,
        cover_alt: post.cover_alt ?? post.title,
        slug: post.slug,
        title: post.title,
        description: post.description,
        category: post.category,
        body: post.body,
        seo_title: post.seo_title,
        seo_description: post.seo_description,
        state: post.state!,
        expected_revision: Number(post.revision),
      }
    : empty();
  initial.value = JSON.stringify(form.value);
  preview.value = false;
  publishing.value = false;
  message.value = '';
}
async function load() {
  busy.value = true;
  try {
    const session = await api.get('/api/v2/admin/auth/session');
    permitted.value = session.permissions.includes('blog.manage');
    if (!permitted.value) {
      message.value = 'دسترسی مدیریت وبلاگ برای این حساب فعال نیست.';
      return;
    }
    const response = (await api.get('/api/v2/admin/blog')) as { posts: BlogPost[] };
    posts.value = response.posts;
    if (!selected.value && route.query.post) {
      const target = posts.value.find((p) => p.id === route.query.post);
      if (target) open(target);
    }
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function save(state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
  const editor = document.getElementById('blog-editor') as HTMLFormElement | null;
  if (editor && !editor.reportValidity()) return;
  busy.value = true;
  message.value = '';
  success.value = false;
  try {
    const payload = { ...form.value, state };
    const result = (
      selected.value
        ? await api.patch('/api/v2/admin/blog/{id}', payload, { id: selected.value.id! })
        : await api.post('/api/v2/admin/blog', payload)
    ) as BlogPost;
    initial.value = JSON.stringify(form.value);
    open(result);
    await load();
    message.value =
      state === 'PUBLISHED'
        ? 'نوشته با تأیید شما منتشر شد.'
        : state === 'ARCHIVED'
          ? 'نوشته بایگانی شد و دیگر عمومی نیست.'
          : 'پیش‌نویس ذخیره شد؛ در سایت عمومی نمایش داده نمی‌شود.';
    success.value = true;
  } catch (e) {
    message.value = errorMessage(e);
  } finally {
    busy.value = false;
    publishing.value = false;
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault();
}
onBeforeRouteLeave(
  () => !dirty.value || window.confirm('تغییرات ذخیره نشده است. از این صفحه خارج می‌شوید؟'),
);
onMounted(() => {
  initial.value = JSON.stringify(form.value);
  window.addEventListener('beforeunload', beforeUnload);
  void load();
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>
<template>
  <section class="wrap section blog-manager">
    <nav class="blog-breadcrumbs" aria-label="مسیر مدیریت">
      <NuxtLink to="/zanyari">میز کار</NuxtLink><span>/</span><span>مدیریت وبلاگ</span>
    </nav>
    <div class="blog-manager-heading">
      <div>
        <p class="eyebrow">محتوا و جست‌وجو</p>
        <h1>مدیریت وبلاگ</h1>
        <p>نوشته را بازبینی کنید، پیش‌نمایش را ببینید و با تأیید خودتان منتشر کنید.</p>
      </div>
      <button
        v-if="permitted"
        class="button secondary"
        type="button"
        :disabled="busy || imageBusy"
        @click="open()"
      >
        نوشتهٔ تازه
      </button>
    </div>
    <p v-if="message" role="status" :class="['notice', { success }]">{{ message }}</p>
    <p v-if="busy" role="status">در حال انجام…</p>
    <div v-if="permitted" class="blog-workspace">
      <aside class="blog-post-list" aria-label="نوشته‌ها">
        <AppCombobox
          v-model="articlePicker"
          label="جست‌وجوی نوشته"
          :options="pickerOptions"
          placeholder="عنوان یا نشانی نوشته را بنویسید…"
          :disabled="busy || imageBusy"
        />
        <AppSelect
          v-model="filter"
          label="وضعیت نوشته‌ها"
          :options="filterOptions"
          :disabled="busy || imageBusy"
        />
        <p v-if="!visible.length">نوشته‌ای پیدا نشد.</p>
        <button
          v-for="post in visible"
          :key="post.id"
          type="button"
          :class="['blog-list-item', { active: selected?.id === post.id }]"
          :aria-pressed="selected?.id === post.id"
          :disabled="busy || imageBusy"
          @click="open(post)"
        >
          <span class="blog-list-state">{{ stateLabel(post.state) }}</span
          ><strong>{{ post.title }}</strong
          ><small>{{ blogDate(post.updated_at) }}</small>
        </button>
      </aside>
      <div class="blog-editor">
        <form
          v-if="!preview"
          id="blog-editor"
          @submit.prevent="save(form.state === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')"
        >
          <h2>{{ selected ? 'ویرایش نوشته' : 'نوشتهٔ تازه' }}</h2>
          <label for="blog-title"
            >عنوان نوشته<input
              id="blog-title"
              v-model="form.title"
              required
              minlength="5"
              maxlength="160"
              :disabled="busy || imageBusy"
          /></label>
          <div class="blog-field-pair">
            <div>
              <label for="blog-slug"
                >نشانی نوشته<input
                  id="blog-slug"
                  v-model="form.slug"
                  dir="ltr"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxlength="100"
                  :readonly="!!selected?.published_at"
                  :disabled="busy || imageBusy"
                  aria-describedby="blog-slug-help" /></label
              ><small id="blog-slug-help">{{
                selected?.published_at
                  ? 'نشانی پس از اولین انتشار ثابت می‌ماند.'
                  : 'حروف کوچک انگلیسی، عدد و خط تیره؛ مانند number-games-at-home'
              }}</small>
            </div>
            <label for="blog-category"
              >دسته‌بندی<input
                id="blog-category"
                v-model="form.category"
                required
                minlength="2"
                maxlength="60"
                :disabled="busy || imageBusy"
            /></label>
          </div>
          <label for="blog-description"
            >خلاصهٔ نوشته<textarea
              id="blog-description"
              v-model="form.description"
              required
              minlength="20"
              maxlength="320"
              rows="3"
              :disabled="busy || imageBusy"
            />
          </label>
          <BlogImageUpload
            :key="selected?.id ?? 'new'"
            v-model="form.cover_image"
            :disabled="busy"
            @busy="imageBusy = $event"
          />
          <label v-if="form.cover_image" for="blog-cover-alt"
            >توضیح تصویر برای دسترس‌پذیری و جست‌وجو<input
              id="blog-cover-alt"
              v-model="form.cover_alt"
              maxlength="250"
              required
              :disabled="busy || imageBusy"
              placeholder="آنچه در تصویر دیده می‌شود را کوتاه و روشن بنویسید."
          /></label>
          <label for="blog-body"
            >متن نوشته<textarea
              id="blog-body"
              v-model="form.body"
              required
              minlength="100"
              maxlength="12000"
              rows="20"
              :disabled="busy || imageBusy"
              aria-describedby="blog-format"
            />
          </label>
          <p id="blog-format" class="muted">
            بین بندها یک خط خالی بگذارید. تیتر: ## عنوان · فهرست: - متن · پیوند در یک بند جدا:
            [عنوان](https://example.com). متن HTML اجرا نمی‌شود.
          </p>
          <details class="blog-seo-fields">
            <summary>نمایش در جست‌وجو</summary>
            <label for="blog-seo-title"
              >عنوان جست‌وجو (اختیاری)<input
                id="blog-seo-title"
                v-model="form.seo_title"
                maxlength="160"
                :placeholder="form.title"
                :disabled="busy || imageBusy" /></label
            ><label for="blog-seo-description"
              >توضیح جست‌وجو (اختیاری)<textarea
                id="blog-seo-description"
                v-model="form.seo_description"
                maxlength="320"
                rows="3"
                :placeholder="form.description"
                :disabled="busy || imageBusy"
              />
            </label>
            <p class="muted">
              اگر خالی بماند، عنوان و خلاصهٔ نوشته استفاده می‌شود. موتور جست‌وجو ممکن است متن دیگری
              نمایش دهد.
            </p>
          </details>
          <div class="actions">
            <button class="button primary" type="submit" :disabled="busy || imageBusy">
              {{
                form.state === 'PUBLISHED' ? 'ذخیرهٔ تغییرات منتشرشده' : 'ذخیرهٔ پیش‌نویس'
              }}</button
            ><button
              class="button secondary"
              type="button"
              :disabled="busy || imageBusy || !form.title || !form.body"
              @click="preview = true"
            >
              پیش‌نمایش</button
            ><button
              v-if="form.state !== 'PUBLISHED'"
              class="button secondary"
              type="button"
              :disabled="busy || imageBusy || !form.title || !form.body"
              @click="publishing = true"
            >
              بررسی و انتشار</button
            ><button
              v-if="selected && form.state === 'PUBLISHED'"
              class="button secondary"
              type="button"
              :disabled="busy || imageBusy"
              @click="save('DRAFT')"
            >
              برداشتن از انتشار</button
            ><button
              v-if="selected && form.state === 'DRAFT'"
              class="button secondary"
              type="button"
              :disabled="busy || imageBusy"
              @click="save('ARCHIVED')"
            >
              بایگانی
            </button>
          </div>
        </form>
        <article v-else class="blog-article">
          <div class="actions">
            <span class="pill">پیش‌نمایش؛ هنوز ذخیره نشده</span
            ><button type="button" class="button secondary" @click="preview = false">
              بازگشت به ویرایش
            </button>
          </div>
          <header class="blog-article-header">
            <p class="eyebrow">{{ form.category }}</p>
            <h2>{{ form.title }}</h2>
            <p class="hero-lead">{{ form.description }}</p>
          </header>
          <BlogPrivateImage
            v-if="form.cover_image"
            :src="form.cover_image"
            :alt="form.cover_alt"
          /><BlogBody :body="form.body" />
        </article>
        <div
          v-if="publishing"
          class="notice blog-publish-confirm"
          role="region"
          aria-label="تأیید انتشار"
        >
          <h3>این نوشته را منتشر می‌کنید؟</h3>
          <p>
            پس از تأیید، متن فعلی برای همه قابل مشاهده و وارد نقشهٔ سایت می‌شود. عنوان، متن و منابع
            را پیش از انتشار بازبینی کنید.
          </p>
          <div class="actions">
            <button
              class="button primary"
              type="submit"
              form="blog-editor"
              :disabled="busy || imageBusy"
              @click.prevent="save('PUBLISHED')"
            >
              تأیید و انتشار</button
            ><button class="button secondary" type="button" @click="publishing = false">
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
    <p v-if="!permitted && !busy">
      <NuxtLink class="text-link" to="/zanyari/login">ورود به مدیریت</NuxtLink>
    </p>
  </section>
</template>
