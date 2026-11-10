// A switch changes the shared browser cookie. Other tabs reload their device-bound views.
export default defineNuxtPlugin(() => {
  window.addEventListener('storage', (event) => {
    if (event.key === 'yarizan-device-context' && event.newValue !== null) window.location.reload();
  });
});
