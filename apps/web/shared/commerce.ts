/** Why an unpaid invoice ended (orders.closed_reason), in the customer's words. */
export const closedReasons: Record<string, string> = {
  customer_cancelled: 'پرداخت لغو شد',
  payment_unsuccessful: 'پرداخت ناموفق بود',
  invoice_expired: 'مهلت ۱۵ دقیقه‌ای پرداخت تمام شد',
  admin_voided: 'فاکتور توسط پشتیبانی باطل شد',
  provider_confirmed_failed: 'درگاه ناموفق بودن پرداخت را تأیید کرد',
};
export function commerceState(order: {
  state: string;
  paid_at?: unknown;
  exception_code?: unknown;
  closed_reason?: unknown;
  payments?: PaymentEvidence[];
}) {
  if (order.exception_code) return 'نیازمند بررسی پشتیبانی';
  if (order.state === 'FULFILLED') return 'مجوز خرید آماده است';
  if (order.paid_at) return 'پرداخت تأیید شد؛ مجوز خرید در حال آماده‌سازی است';
  if (order.closed_reason && closedReasons[String(order.closed_reason)])
    return closedReasons[String(order.closed_reason)]!;
  if (order.state === 'FAILED') return 'پرداخت ناموفق بود';
  if (order.state === 'CANCELLED') return 'پرداخت لغو شد';
  if (order.payments?.some((p) => p.state === 'UNKNOWN')) return 'در حال بررسی نتیجهٔ پرداخت';
  return order.payments?.length ? 'در انتظار پرداخت و تأیید نهایی' : 'در انتظار پرداخت';
}
/** Tone for a status pill: ok (done), warn (waiting) or bad (ended without payment). */
export function commerceTone(order: {
  state: string;
  paid_at?: unknown;
  exception_code?: unknown;
}) {
  if (order.exception_code) return 'warn';
  if (order.state === 'FULFILLED' || order.paid_at) return 'ok';
  if (['FAILED', 'CANCELLED'].includes(order.state)) return 'bad';
  return 'warn';
}
export type PaymentEvidence = {
  state: string;
  customer_return?: 'OK' | 'NOK' | null;
  terminal_reason?: string | null;
};
/**
 * Customer guidance for an unsettled or failed payment. A browser cancellation is never presented as a
 * final result: until the provider confirms, the customer is told not to pay again.
 */
export function paymentNotice(payments: PaymentEvidence[]): string | null {
  const unknown = payments.find((p) => p.state === 'UNKNOWN');
  if (unknown?.customer_return === 'OK')
    return 'درگاه پرداخت را موفق اعلام کرد و تأیید نهایی در حال انجام است. دوباره پرداخت نکنید.';
  if (unknown)
    return 'نتیجهٔ پرداخت هنوز مشخص نیست. اگر پرداخت را کامل نکرده‌اید، می‌توانید این فاکتور را لغو و فاکتور تازه صادر کنید.';
  if (payments.some((p) => ['FAILED', 'CANCELLED'].includes(p.state)))
    return 'این پرداخت انجام نشد. اگر مبلغی از حساب شما کم شده باشد، بانک آن را حداکثر تا ۷۲ ساعت به حساب شما برمی‌گرداند. برای خرید، فاکتور تازه صادر کنید.';
  return null;
}
export function financialToman(irr: unknown) {
  const value = String(irr ?? '0');
  if (!/^[0-9]+$/.test(value)) return '—';
  const n = BigInt(value),
    whole = new Intl.NumberFormat('fa-IR').format(n / 10n);
  return whole + (n % 10n ? '٫' + new Intl.NumberFormat('fa-IR').format(n % 10n) : '');
}
