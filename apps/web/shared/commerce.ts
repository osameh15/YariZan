export function commerceState(order: {
  state: string;
  paid_at?: unknown;
  exception_code?: unknown;
  payments?: PaymentEvidence[];
}) {
  if (order.exception_code) return 'نیازمند بررسی پشتیبانی';
  if (order.state === 'FULFILLED') return 'مجوز خرید آماده است';
  if (order.paid_at) return 'پرداخت تأیید شد؛ مجوز خرید در حال آماده‌سازی است';
  if (order.state === 'FAILED') return 'پرداخت ناموفق بود';
  if (order.state === 'CANCELLED') return 'پرداخت لغو شد';
  const unknown = order.payments?.find((p) => p.state === 'UNKNOWN');
  if (unknown?.customer_return === 'NOK') return 'لغو پرداخت گزارش شد؛ نتیجهٔ مالی هنوز قطعی نیست';
  if (unknown) return 'نتیجهٔ پرداخت هنوز مشخص نیست؛ در حال بررسی';
  return order.payments?.length ? 'در انتظار پرداخت و تأیید نهایی' : 'در انتظار پرداخت';
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
  if (unknown?.customer_return === 'NOK')
    return 'بازگشت از درگاه با لغو یا ناموفق بودن پرداخت همراه بود، اما درگاه هنوز نتیجهٔ مالی را قطعی نکرده است. دوباره پرداخت نکنید. اگر مبلغی از حساب شما کم شده باشد، بررسی خودکار ادامه دارد و نتیجه همین‌جا نمایش داده می‌شود.';
  if (unknown) return 'نتیجه هنوز قطعی نیست. دوباره پرداخت نکنید؛ بررسی سرور ادامه دارد.';
  if (
    payments.some((p) => p.state === 'FAILED' && p.terminal_reason === 'provider_confirmed_failed')
  )
    return 'درگاه پرداخت ناموفق بودن این تراکنش را تأیید کرد و این سفارش پرداخت نشد. اگر مبلغی از حساب شما کم شده باشد، طبق مقررات شاپرک حداکثر ظرف ۷۲ ساعت به حساب شما بازمی‌گردد. برای خرید می‌توانید سفارش تازه ثبت کنید.';
  return null;
}
export function financialToman(irr: unknown) {
  const value = String(irr ?? '0');
  if (!/^[0-9]+$/.test(value)) return '—';
  const n = BigInt(value),
    whole = new Intl.NumberFormat('fa-IR').format(n / 10n);
  return whole + (n % 10n ? '٫' + new Intl.NumberFormat('fa-IR').format(n % 10n) : '');
}
