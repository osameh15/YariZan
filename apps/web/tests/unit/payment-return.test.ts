import { describe, expect, it } from 'vitest';
import { paymentReturnAuthority } from '../../shared/payment-return';
import { PAYMENT_RETURN_AUTHORITY } from '../../../../backend/src/commerce/gateway';

// The web return handler must neither reject an authority the Backend adapter can issue (a real
// 36-character production authority, a sandbox "S" authority) nor forward anything the Backend would
// refuse. One source string, compared here, keeps both layers identical.
describe('payment return authority pattern', () => {
  it('is identical in the web layer and the Backend', () => {
    expect(paymentReturnAuthority.source).toBe(PAYMENT_RETURN_AUTHORITY.source);
    expect(paymentReturnAuthority.flags).toBe(PAYMENT_RETURN_AUTHORITY.flags);
  });
  it('accepts the documented 36-character production authority, sandbox authorities and the fake test authority', () => {
    const good = [
      'A' + '0'.repeat(35),
      'A' + 'a1B2'.repeat(8) + 'xyz',
      'S' + '0'.repeat(35),
      'S' + 'Z9'.repeat(16),
      'A' + '1'.repeat(32),
      'A' + '1'.repeat(40),
      'FAKE-8d22d23a-cc95-4553-b703-11e45831e2b4',
    ];
    for (const value of good) expect(paymentReturnAuthority.test(value), value).toBe(true);
  });
  it('rejects anything that could alter a URL or is the wrong shape', () => {
    const bad = [
      '',
      'A' + '0'.repeat(31),
      'A' + '0'.repeat(41),
      'B' + '0'.repeat(35),
      'a' + '0'.repeat(35),
      'A' + '0'.repeat(34) + '/',
      'A' + '0'.repeat(34) + '?',
      'A' + '0'.repeat(34) + '#',
      'A' + '0'.repeat(34) + '%',
      'A' + '0'.repeat(34) + '\n',
      ' A' + '0'.repeat(35),
      'A' + '0'.repeat(35) + ' ',
      'S' + '0'.repeat(34) + '.',
      'FAKE-' + 'g'.repeat(36),
      'FAKE-8d22d23a-cc95-4553-b703-11e45831e2b4/../x',
    ];
    for (const value of bad)
      expect(paymentReturnAuthority.test(value), JSON.stringify(value)).toBe(false);
  });
});
