import {
  ref,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  type Ref,
  type CSSProperties,
} from 'vue';

// Keep small form popups inside the viewport and outside persistent dialog actions.
export function useControlPopup(
  trigger: Ref<HTMLElement | undefined>,
  panel: Ref<HTMLElement | undefined>,
  open: Ref<boolean>,
  calendar = false,
) {
  const style = ref<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  async function place() {
    if (!open.value) return;
    await nextTick();
    if (!trigger.value || !panel.value || !open.value) return;
    const anchor = trigger.value.getBoundingClientRect();
    const scroller = trigger.value.closest('.commerce-editor-fields');
    const boundary = scroller?.getBoundingClientRect();
    const left = Math.max(16, (boundary?.left ?? 8) + 8),
      right = Math.min(window.innerWidth - 16, (boundary?.right ?? window.innerWidth - 8) - 8);
    const top = Math.max(16, (boundary?.top ?? 8) + 8),
      bottom = Math.min(window.innerHeight - 16, (boundary?.bottom ?? window.innerHeight - 8) - 8);
    const width = Math.max(0, Math.min(calendar ? 360 : Math.max(anchor.width, 240), right - left));
    const maxHeight = Math.max(0, Math.min(calendar ? bottom - top : 240, bottom - top));
    style.value = {
      position: 'fixed',
      width: width + 'px',
      maxHeight: maxHeight + 'px',
      left: Math.max(left, Math.min(anchor.right - width, right - width)) + 'px',
      top: top + 'px',
      zIndex: 30,
    };
    await nextTick();
    if (!open.value || !panel.value) return;
    const height = Math.min(panel.value.getBoundingClientRect().height, maxHeight);
    const y =
      anchor.bottom + 8 + height <= bottom
        ? anchor.bottom + 8
        : anchor.top - height - 8 >= top
          ? anchor.top - height - 8
          : top;
    style.value = { ...style.value, top: Math.max(top, Math.min(y, bottom - height)) + 'px' };
  }
  function changed(event: Event) {
    if (event.target instanceof Node && panel.value?.contains(event.target)) return;
    void place();
  }
  watch(open, (value) => {
    if (value) void place();
    else style.value = { position: 'fixed', visibility: 'hidden' };
  });
  onMounted(() => {
    window.addEventListener('resize', changed);
    document.addEventListener('scroll', changed, true);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('resize', changed);
    document.removeEventListener('scroll', changed, true);
  });
  return { popupStyle: style, placePopup: place };
}
