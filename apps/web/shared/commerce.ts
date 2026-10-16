export function commerceState(order: {
  state: string;
  paid_at?: unknown;
  exception_code?: unknown;
  payments?: { state: string }[];
}) {
  if (order.exception_code) return 'نیازمند بررسی پشتیبانی';
  if (order.state === 'FULFILLED') return 'مجوز خرید آماده است';
  if (order.paid_at) return 'پرداخت تأیید شد؛ مجوز خرید در حال آماده‌سازی است';
  if (order.state === 'FAILED') return 'پرداخت ناموفق بود';
  if (order.state === 'CANCELLED') return 'پرداخت لغو شد';
  if (order.payments?.some((p) => p.state === 'UNKNOWN'))
    return 'نتیجهٔ پرداخت هنوز مشخص نیست؛ در حال بررسی';
  return order.payments?.length ? 'در انتظار پرداخت و تأیید نهایی' : 'در انتظار پرداخت';
}
export function financialToman(irr: unknown) {
  const value = String(irr ?? '0');
  if (!/^[0-9]+$/.test(value)) return '—';
  const n = BigInt(value),
    whole = new Intl.NumberFormat('fa-IR').format(n / 10n);
  return whole + (n % 10n ? '٫' + new Intl.NumberFormat('fa-IR').format(n % 10n) : '');
}
