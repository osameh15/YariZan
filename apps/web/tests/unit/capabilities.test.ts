import { describe, expect, it } from 'vitest';
import {
  pageServed,
  parseCapabilities,
  requiredCapabilities,
  type CapabilityId,
} from '../../shared/capabilities';

describe('Backend capabilities in the full application', () => {
  it('reads only known capabilities and fails closed on anything else', () => {
    expect(
      parseCapabilities({ enabled_capabilities: ['PRODUCTION_CORE', 'ADMIN_AUTH', 'ROOT'] }),
    ).toEqual(['PRODUCTION_CORE', 'ADMIN_AUTH']);
    for (const value of [null, undefined, {}, { enabled_capabilities: 'ADMIN_AUTH' }, []])
      expect(parseCapabilities(value)).toEqual([]);
  });

  it('maps each protected page to the capabilities it needs', () => {
    expect(requiredCapabilities('/zanyari/products')).toEqual(['ADMIN_AUTH']);
    expect(requiredCapabilities('/ZANYARI')).toEqual(['ADMIN_AUTH']);
    expect(requiredCapabilities('/checkout?sku=YARIZAN-G1')).toEqual([
      'CUSTOMER_AUTH',
      'LIVE_COMMERCE',
    ]);
    expect(requiredCapabilities('/payment/return')).toEqual(['CUSTOMER_AUTH', 'LIVE_COMMERCE']);
    expect(requiredCapabilities('/connect')).toEqual(['CUSTOMER_AUTH', 'DESKTOP_PROVISIONING']);
    for (const path of ['/account', '/login', '/reset-password', '/support-reset'])
      expect(requiredCapabilities(path)).toEqual(['CUSTOMER_AUTH']);
    for (const path of ['/', '/products', '/products/grade-1', '/download', '/legal/privacy'])
      expect(requiredCapabilities(path)).toEqual([]);
  });

  it('serves a page only when every capability it needs is enabled', () => {
    const core: CapabilityId[] = ['PRODUCTION_CORE'];
    expect(pageServed('/products', core)).toBe(true);
    expect(pageServed('/zanyari', core)).toBe(false);
    expect(pageServed('/account', core)).toBe(false);
    expect(pageServed('/zanyari', [...core, 'ADMIN_AUTH'])).toBe(true);
    expect(pageServed('/checkout', [...core, 'CUSTOMER_AUTH'])).toBe(false);
  });
});
