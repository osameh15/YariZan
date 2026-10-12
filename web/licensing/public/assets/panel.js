'use strict';
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
document.addEventListener('submit', (event) => {
  const message = event.target.dataset.confirm;
  if (message && !window.confirm(message)) event.preventDefault();
});
