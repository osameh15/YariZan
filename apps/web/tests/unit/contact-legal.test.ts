import { describe, expect, it } from 'vitest';
import { ENAMAD, MERCHANT, SUPPORT_PHONES, SUPPORT_EMAIL, INFO_EMAIL } from '../../shared/contact';
import { LEGAL_APPROVAL, legalStatusText } from '../../shared/legal';

const latin = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

describe('public contact facts', () => {
  it('display numbers are Persian 4-3-4 and match their tel: digits exactly', () => {
    expect(SUPPORT_PHONES.map((p) => p.tel)).toEqual(['09188764024', '09369642754']);
    for (const p of SUPPORT_PHONES) {
      expect(p.display).toMatch(/^[۰-۹]{4}-[۰-۹]{3}-[۰-۹]{4}$/);
      expect(latin(p.display).replace(/-/g, '')).toBe(p.tel);
    }
  });
  it('uses only the owner-confirmed studio mailboxes and eNamad record', () => {
    expect([SUPPORT_EMAIL, INFO_EMAIL]).toEqual(['support@oarnova.games', 'info@oarnova.games']);
    expect(ENAMAD.url).toBe(
      'https://trustseal.enamad.ir/?id=8237399&Code=y2Y8bAJfRaMrTmiR3giBPYylZqSIoUvX',
    );
    expect(ENAMAD.url).toContain('id=' + ENAMAD.id);
    expect(MERCHANT.paymentProviderFa).toBe('زرین‌پال');
  });
});

describe('legal approval state', () => {
  it('is not approved and never shows a fabricated effective date', () => {
    expect(LEGAL_APPROVAL.approved).toBe(false);
    expect(LEGAL_APPROVAL.approvedOn).toBeNull();
    expect(legalStatusText()).toContain('پیشنهادی');
  });
  it('shows the version and effective date only once approved', () => {
    const text = legalStatusText({
      version: '2.0.0',
      approved: true,
      approvedOn: '2026-10-25',
      effectiveFrom: '2026-10-25',
    });
    expect(text).toContain('۲.۰.۰');
    expect(text).not.toContain('پیشنهادی');
    expect(text).toMatch(/۱۴۰۵/);
  });
});
