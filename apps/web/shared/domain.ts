import { z } from 'zod';
export const productSchema = z.object({
  sku: z.string().regex(/^YARIZAN-G[1-6]$/),
  grade: z.number().int().min(1).max(6),
  title_fa: z.string(),
  price_irr: z.number().int().nonnegative().safe(),
  publication_status: z.enum(['published', 'coming_soon', 'hidden']),
  sale_enabled: z.boolean(),
  trial_enabled: z.boolean(),
  activation_enabled: z.boolean(),
  revision: z.number().int().positive(),
});
export type Product = z.infer<typeof productSchema>;
export const gradeNames = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];
export function toman(irr: number) {
  if (!Number.isSafeInteger(irr) || irr < 0) throw new Error('Invalid IRR');
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(irr / 10);
}
export function safeReturn(value: unknown, fallback = '/account') {
  return typeof value === 'string' &&
    (/^\/account(?:\/[a-z-]+)?$/.test(value) || /^\/checkout\?sku=YARIZAN-G[1-6]$/.test(value))
    ? value
    : fallback;
}
export function availability(p: Product) {
  return p.publication_status === 'coming_soon'
    ? 'به‌زودی'
    : p.sale_enabled
      ? 'عرضه‌شده'
      : 'فروش غیرفعال';
}
export function errorMessage(error: unknown) {
  const code = (error as { data?: { error?: { code?: string } } })?.data?.error?.code;
  return (
    (
      {
        COUPON_UNAVAILABLE: 'این کد برای سفارش شما قابل استفاده نیست. کد و شرایط آن را بررسی کنید.',
        ZERO_TOTAL_BLOCKED: 'پرداخت بدون مبلغ در این مرحله پشتیبانی نمی‌شود.',
        COMMERCE_UNAVAILABLE: 'خرید اینترنتی در این محیط فعال نیست. با پشتیبانی تماس بگیرید.',
        ALREADY_OWNED:
          'مجوز این پایه قبلاً برای دستگاه ثبت شده است. برای بازیابی با پشتیبانی تماس بگیرید.',
        ORDER_ALREADY_OPEN:
          'برای این پایه سفارش باز دارید. ابتدا وضعیت آن را در سفارش‌ها بررسی کنید.',
        ORDER_NOT_PAYABLE: 'این سفارش اکنون قابل پرداخت نیست. وضعیت سفارش را بررسی کنید.',
        PAYMENT_ALREADY_PENDING: 'نتیجهٔ پرداخت قبلی هنوز مشخص نیست. دوباره پرداخت نکنید.',
        PAYMENT_STATE_CONFLICT: 'وضعیت پرداخت تغییر کرده است. اطلاعات سفارش را تازه کنید.',
        QUOTA_BELOW_ALLOCATED: 'سقف جدید از تعداد سهمیه‌های رزروشده و استفاده‌شده کمتر است.',
        OTP_INVALID:
          'کد تأیید درست نیست، منقضی شده یا قبلاً استفاده شده است. کد را بررسی کنید یا کد تازه بخواهید.',
        OTP_REQUIRED: 'ابتدا شمارهٔ همراه را با کد پیامک تأیید کنید.',
        MOBILE_INVALID: 'شمارهٔ همراه معتبر وارد کنید.',
        MOBILE_REQUIRED: 'ابتدا شمارهٔ همراه خود را تأیید کنید.',
        SMS_UNAVAILABLE: 'ارسال پیامک اکنون در دسترس نیست. کمی بعد دوباره تلاش کنید.',
        ADMIN_SMS_NOT_ENROLLED: 'شمارهٔ تأییدشدهٔ مدیر ثبت نشده است. با مسئول سامانه تماس بگیرید.',
        PRODUCT_NOT_AVAILABLE: 'این پایه برای عملیات انتخاب‌شده در دسترس نیست.',
        IDEMPOTENCY_MISMATCH: 'درخواست با اطلاعات دیگری ثبت شده است. وضعیت را بررسی کنید.',
        INVALID_CREDENTIALS: 'نام کاربری یا گذرواژه درست نیست.',
        UNAUTHENTICATED: 'نشست شما پایان یافته است. دوباره وارد شوید.',
        MFA_REQUIRED: 'تأیید دومرحله‌ای یا ورود مجدد لازم است.',
        CSRF_REJECTED: 'نشست را تازه کنید و دوباره تلاش کنید.',
        RATE_LIMITED:
          'درخواست‌های زیادی فرستاده‌اید. مدتی صبر کنید و دوباره امتحان کنید؛ اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.',
        PAIRING_INVALID: 'درخواست اتصال منقضی یا استفاده شده است. از برنامه درخواست تازه بگیرید.',
        PROFILE_NOT_AUTHORIZED: 'تأیید این رایانه به ورود صاحب حساب نیاز دارد.',
        STALE_REVISION: 'اطلاعات تغییر کرده است. فهرست را تازه کنید و عملیات را دوباره بررسی کنید.',
        FORBIDDEN: 'اجازهٔ انجام این کار را ندارید.',
        PRODUCT_BLOCKED: 'این پایه برای دستگاه محدود شده است.',
        OWNERSHIP_EVIDENCE_REQUIRED: 'مرجع تأیید مستقل مالکیت لازم است.',
        RESET_INVALID: 'مجوز بازیابی منقضی یا استفاده شده است.',
        INVALID_REQUEST: 'اطلاعات واردشده را بررسی کنید.',
      } as Record<string, string>
    )[code ?? ''] ??
    'در حال حاضر انجام این کار ممکن نیست. اتصال خود را بررسی کنید و دوباره تلاش کنید.'
  );
}
