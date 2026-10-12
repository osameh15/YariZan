'use strict';
const editor = document.getElementById('device-editor');
if (editor && window.location.hash === '#device-editor') {
  editor.focus({ preventScroll: true });
}
const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
document.querySelectorAll('time.persian-date').forEach((element) => {
  const date = new Date(element.dateTime);
  if (Number.isFinite(date.getTime())) element.textContent = persianDate.format(date);
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'per_page') event.target.form.requestSubmit();
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    status.textContent = 'در حافظه کپی شد.';
  } catch {
    status.textContent = 'کپی خودکار ممکن نشد؛ متن را انتخاب و کپی کنید.';
  }
  setTimeout(() => { status.textContent = ''; }, 3500);
});
const confirmationDialog = document.getElementById('confirmation-dialog');
const approvedForms = new WeakSet();
let pendingAction = null;
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (approvedForms.has(form)) { approvedForms.delete(form); return; }
  const message = form.dataset.confirm;
  if (!message) return;
  event.preventDefault();
  if (!confirmationDialog || pendingAction) return;
  const deleting = form.elements.action?.value === 'delete_device';
  document.getElementById('confirmation-title').textContent = form.dataset.confirmTitle || (deleting ? 'حذف دستگاه' : 'بازنشانی آزمایش');
  document.getElementById('confirmation-message').textContent = message;
  const confirmButton = document.getElementById('confirmation-accept');
  confirmButton.textContent = form.dataset.confirmLabel || (deleting ? 'حذف دستگاه' : 'بازنشانی آزمایش');
  confirmButton.classList.toggle('destructive', deleting || form.elements.action?.value === 'regenerate');
  pendingAction = { form, submitter: event.submitter };
  confirmationDialog.showModal();
});
document.getElementById('confirmation-accept')?.addEventListener('click', () => {
  if (!pendingAction) return;
  const { form, submitter } = pendingAction;
  confirmationDialog.close();
  pendingAction = null;
  approvedForms.add(form);
  if (submitter) form.requestSubmit(submitter);
  else form.requestSubmit();
});
document.querySelectorAll('[data-close-confirmation]').forEach((button) => {
  button.addEventListener('click', () => { pendingAction = null; confirmationDialog.close(); });
});
confirmationDialog?.addEventListener('cancel', () => { pendingAction = null; });
confirmationDialog?.addEventListener('close', () => { if (!confirmationDialog.open) pendingAction = null; });
confirmationDialog?.addEventListener('click', (event) => {
  if (event.target !== confirmationDialog) return;
  const bounds = confirmationDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    pendingAction = null;
    confirmationDialog.close();
  }
});
