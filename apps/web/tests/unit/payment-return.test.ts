import { describe, expect, it } from 'vitest';
import {
  liveStartPay,
  paymentReturnAuthority,
  sandboxStartPay,
  startPayPattern,
} from '../../shared/payment-return';
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

describe('the only external payment destination', () => {
  it('is the official sandbox StartPay page with a sandbox authority', () => {
    expect(
      sandboxStartPay.test('https://sandbox.zarinpal.com/pg/StartPay/S' + '0'.repeat(35)),
    ).toBe(true);
    for (const bad of [
      'https://payment.zarinpal.com/pg/StartPay/A' + '0'.repeat(35),
      'https://payment.zarinpal.com/pg/StartPay/S' + '0'.repeat(35),
      'http://sandbox.zarinpal.com/pg/StartPay/S' + '0'.repeat(35),
      'https://sandbox.zarinpal.com.evil.example/pg/StartPay/S' + '0'.repeat(35),
      'https://evil.example/https://sandbox.zarinpal.com/pg/StartPay/S' + '0'.repeat(35),
      'https://sandbox.zarinpal.com/pg/StartPay/A' + '0'.repeat(35),
      'https://sandbox.zarinpal.com/pg/StartPay/S' + '0'.repeat(35) + '?x=1',
      'https://sandbox.zarinpal.com/pg/StartPay/S' + '0'.repeat(35) + '/x',
      'https://pay.yarizan.oarnova.games/pg/StartPay/S' + '0'.repeat(35),
      '/payment/simulate?order=x',
      '',
    ])
      expect(sandboxStartPay.test(bad), bad).toBe(false);
  });
  it('allows the production StartPay page only while the API reports live payments', () => {
    const live = 'https://payment.zarinpal.com/pg/StartPay/A' + '0'.repeat(35);
    const sandbox = 'https://sandbox.zarinpal.com/pg/StartPay/S' + '0'.repeat(35);
    expect(liveStartPay.test(live)).toBe(true);
    for (const bad of [
      sandbox,
      'https://payment.zarinpal.com/pg/StartPay/S' + '0'.repeat(35),
      'http://payment.zarinpal.com/pg/StartPay/A' + '0'.repeat(35),
      'https://payment.zarinpal.com.evil.example/pg/StartPay/A' + '0'.repeat(35),
      live + '?x=1',
      live + '/x',
      'https://pay.yarizan.oarnova.games/pg/StartPay/A' + '0'.repeat(35),
    ])
      expect(liveStartPay.test(bad), bad).toBe(false);
    // Live mode follows only production links, sandbox mode only sandbox links, otherwise none.
    expect(startPayPattern({ real_payments_enabled: true, sandbox: false })?.test(live)).toBe(true);
    expect(startPayPattern({ real_payments_enabled: true, sandbox: false })?.test(sandbox)).toBe(
      false,
    );
    expect(startPayPattern({ real_payments_enabled: false, sandbox: true })?.test(live)).toBe(
      false,
    );
    expect(startPayPattern({ real_payments_enabled: false, sandbox: true })?.test(sandbox)).toBe(
      true,
    );
    expect(startPayPattern({ real_payments_enabled: false, sandbox: false })).toBeNull();
    expect(startPayPattern(null)).toBeNull();
  });
});
