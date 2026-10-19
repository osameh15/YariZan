import { z } from 'zod';
import { financialToman } from './commerce';
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
  // The Backend decides which promotion is active (database time); absent for older responses.
  effective_price_irr: z.number().int().nonnegative().safe().optional(),
  promotion: z
    .object({
      price_irr: z.number().int().positive().safe(),
      original_price_irr: z.number().int().positive().safe(),
      discount_percent: z.number().int().min(1).max(99),
      starts_at: z.string(),
      ends_at: z.string(),
    })
    .nullable()
    .optional(),
});
export type Product = z.infer<typeof productSchema>;
export const gradeNames = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];
export function toman(irr: number) {
  if (!Number.isSafeInteger(irr) || irr < 0) throw new Error('Invalid IRR');
  return financialToman(irr);
}
export function safeReturn(value: unknown, fallback = '/account') {
  return typeof value === 'string' &&
    (/^\/account(?:\/[a-z-]+)?$/.test(value) || /^\/checkout\?sku=YARIZAN-G[1-6]$/.test(value))
    ? value
    : fallback;
}
// Availability is independent of price. publicOnly: the public storefront/brochure, where no
// product can be bought on the site yet, so a priced launch product reads "online sale soon".
export function availability(
  p: Pick<Product, 'publication_status' | 'sale_enabled'> & { price_irr: number | null },
  publicOnly = false,
) {
  return p.publication_status === 'coming_soon'
    ? 'به‌زودی'
    : p.sale_enabled
      ? 'عرضه‌شده'
      : p.price_irr === null
        ? 'معرفی محصول'
        : publicOnly
          ? 'فروش اینترنتی به‌زودی'
          : 'فروش غیرفعال';
}
export function errorMessage(error: unknown) {
  const code = (error as { data?: { error?: { code?: string } } })?.data?.error?.code;
  return (
    (
      {
        COUPON_NOT_COMBINABLE_WITH_PROMOTION:
          'این پایه هم‌اکنون با قیمت ویژه عرضه می‌شود و کد تخفیف روی قیمت ویژه قابل استفاده نیست. کد را حذف کنید.',
        PROMOTION_PRICE_NOT_LOWER: 'قیمت ویژه باید کمتر از قیمت اصلی باشد.',
        PROMOTION_START_IN_PAST:
          'زمان شروع نباید گذشته باشد. برای شروع فوری، زمان شروع را خالی بگذارید.',
        PROMOTION_WINDOW_INVALID: 'پایان قیمت ویژه باید بعد از شروع و در آینده باشد.',
        PROMOTION_OVERLAP: 'برای این پایه در همین بازه، قیمت ویژهٔ فعال دیگری وجود دارد.',
        PROMOTION_ACTIVE_LOCKED:
          'قیمت ویژهٔ فعال قابل ویرایش نیست؛ فقط زمان پایان تغییر می‌کند. برای قیمت تازه، آن را غیرفعال و قیمت ویژهٔ جدید ثبت کنید.',
        PROMOTION_EXPIRED: 'مهلت این قیمت ویژه تمام شده است.',
        PROMOTION_NOT_ENABLED: 'این قیمت ویژه اکنون فعال نیست.',
        PROMOTION_NOT_DISABLED: 'این قیمت ویژه غیرفعال نیست.',
        PROMOTION_BASE_PRICE_CHANGED:
          'قیمت اصلی محصول از زمان ثبت این قیمت ویژه تغییر کرده است؛ قیمت ویژهٔ تازه ثبت کنید.',
        PROMOTION_BASE_PRICE_CONFLICT:
          'تا زمانی که قیمت ویژهٔ زمان‌بندی‌شده یا فعال وجود دارد، قیمت اصلی تغییر نمی‌کند. ابتدا قیمت ویژه را غیرفعال کنید.',
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
