// Single source of the public business and contact facts confirmed by the owner (2026-10-22).
// Private authentication identities (Admin or customer numbers) never belong here.

/** Public support numbers: Persian 4-3-4 display, plain ASCII digits for tel: links. */
export const SUPPORT_PHONES = [
  { display: '۰۹۱۸-۸۷۶-۴۰۲۴', tel: '09188764024' },
  { display: '۰۹۳۶-۹۶۴-۲۷۵۴', tel: '09369642754' },
] as const;
export const PRIMARY_SUPPORT_PHONE = SUPPORT_PHONES[0];

/** Studio mailboxes confirmed by the owner. */
export const SUPPORT_EMAIL = 'support@oarnova.games';
export const INFO_EMAIL = 'info@oarnova.games';

/** Trade name as supplied; no registration identifier exists or is applicable to it. */
export const MERCHANT = {
  tradeNameFa: 'استودیوی بازی‌سازی اوآر نوآ',
  brandEn: 'OAR NOVA Games Studio',
  locationFa: 'تهران، منطقه ۱۰، جیحون، مالک اشتر',
  paymentProviderFa: 'زرین‌پال',
  website: 'https://oarnova.games',
} as const;

/** Official eNamad trust seal; the ID and code must stay exactly as issued. */
export const ENAMAD = {
  id: '8237399',
  url: 'https://trustseal.enamad.ir/?id=8237399&Code=y2Y8bAJfRaMrTmiR3giBPYylZqSIoUvX',
} as const;
