export default defineNuxtPlugin(() => {
  const router = useRouter();
  let checking = false;
  async function check() {
    if (
      !router.currentRoute.value.path.startsWith('/zanyari') ||
      router.currentRoute.value.path === '/zanyari/login' ||
      checking
    )
      return;
    checking = true;
    try {
      await $fetch('/api/v2/admin/auth/session', { retry: 0 });
    } catch (error) {
      if ((error as { status?: number }).status === 401) await navigateTo('/zanyari/login');
    } finally {
      checking = false;
    }
  }
  const timer = window.setInterval(check, 15000);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  router.afterEach(check);
  check();
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    });
});
