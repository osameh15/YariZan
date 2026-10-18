import { describe, it, expect } from 'vitest';
import {
  assertSiteMode,
  brochureDecision,
  brochurePageAllowed,
  parseSiteMode,
} from '../../shared/site-mode';
import { catalogSnapshot } from '../../shared/catalog-snapshot';
import { availability } from '../../shared/domain';

describe('Site mode configuration fails closed', () => {
  it('requires an explicit, exact mode', () => {
    for (const value of [undefined, ''])
      expect(() => parseSiteMode(value)).toThrow(/YARIZAN_SITE_MODE_REQUIRED/);
    for (const value of ['Brochure', 'full ', 'development', 'production', 'true'])
      expect(() => parseSiteMode(value)).toThrow(/YARIZAN_SITE_MODE_INVALID/);
    expect(parseSiteMode('brochure')).toBe('brochure');
    expect(parseSiteMode('full')).toBe('full');
  });
  it('refuses a runtime mode that differs from the build profile', () => {
    expect(() => assertSiteMode('full', 'brochure')).toThrow(/MISMATCH/);
    expect(() => assertSiteMode('brochure', 'full')).toThrow(/MISMATCH/);
    expect(assertSiteMode('brochure', 'brochure')).toBe('brochure');
  });
});

describe('Brochure route allowlist', () => {
  it('permits only reviewed public pages, assets and the health probe', () => {
    for (const path of ['/', '/products', '/products/grade-1', '/products/grade-6', '/support'])
      expect(brochureDecision('GET', path), path).toBe('page');
    expect(brochureDecision('HEAD', '/products')).toBe('page');
    expect(brochureDecision('GET', '/products?ref=home')).toBe('page');
    expect(brochureDecision('GET', '/healthz')).toBe('health');
    expect(brochureDecision('GET', '/_nuxt/entry.abc123.js')).toBe('asset');
    expect(brochureDecision('GET', '/brand/logo.webp')).toBe('asset');
    expect(brochureDecision('GET', '/fonts/Shabnam.woff2')).toBe('asset');
  });
  it('disables accounts, Admin, commerce and recovery pages', () => {
    for (const path of [
      '/account',
      '/account/orders/1',
      '/login',
      '/connect',
      '/zanyari',
      '/zanyari/commerce',
      '/checkout',
      '/payment/return',
      '/payment/simulate',
      '/reset-password',
      '/support-reset',
      '/LOGIN',
    ])
      expect(brochureDecision('GET', path), path).toBe('page-disabled');
  });
  it('answers every API path, method and case variant with the disabled API contract', () => {
    for (const [method, path] of [
      ['GET', '/api'],
      ['GET', '/api/v2/products'],
      ['POST', '/api/v2/auth/login'],
      ['POST', '/api/v2/devices/challenges'],
      ['GET', '/api/v2/desktop/entitlements'],
      ['DELETE', '/api/v2/account'],
      ['GET', '/API/v2/products'],
      ['GET', '/api/v2/%2e%2e/admin'],
    ])
      expect(brochureDecision(method!, path!), path).toBe('api-disabled');
  });
  it('refuses aliases, encodings, dot segments and trailing slashes', () => {
    for (const path of [
      '/products/',
      '/support/',
      '/Support',
      '/products/yarizan-g1',
      '/products/grade-7',
      '//account',
      '/./support',
      '/products/../account',
      '/%61ccount',
      '/products%2fgrade-1',
      '/products\\grade-1',
      '/support;jsessionid=1',
      '/_payload.json',
      '/products/grade-1/_payload.json',
      '/healthz/',
      '/_nuxt/../server/index.mjs',
      'products',
      '/محصولات',
    ])
      expect(brochureDecision('GET', path), path).toBe('not-found');
  });
  it('refuses state-changing methods on public pages and assets', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(brochureDecision(method, '/')).toBe('method-not-allowed');
      expect(brochureDecision(method, '/healthz')).toBe('method-not-allowed');
      expect(brochureDecision(method, '/_nuxt/a.js')).toBe('method-not-allowed');
    }
  });
  it('client navigation guard uses the same exact page list', () => {
    expect(brochurePageAllowed('/products/grade-2')).toBe(true);
    expect(brochurePageAllowed('/account')).toBe(false);
    expect(brochurePageAllowed('/products/')).toBe(false);
  });
});

describe('Reviewed brochure catalog snapshot', () => {
  it('lists six grades with nothing purchasable, activatable or trialable', () => {
    expect(catalogSnapshot.products).toHaveLength(6);
    expect(catalogSnapshot.products.map((p) => p.sku)).toEqual([
      'YARIZAN-G1',
      'YARIZAN-G2',
      'YARIZAN-G3',
      'YARIZAN-G4',
      'YARIZAN-G5',
      'YARIZAN-G6',
    ]);
    for (const p of catalogSnapshot.products) {
      expect(p.sale_enabled || p.trial_enabled || p.activation_enabled).toBe(false);
      // No owner-approved retail price exists; never show an unapproved number.
      expect(p.price_irr).toBeNull();
    }
    expect(catalogSnapshot.products[0]!.publication_status).toBe('published');
    expect(
      catalogSnapshot.products.slice(1).every((p) => p.publication_status === 'coming_soon'),
    ).toBe(true);
    expect(availability(catalogSnapshot.products[0]!)).toBe('معرفی محصول');
    expect(availability(catalogSnapshot.products[1]!)).toBe('به‌زودی');
  });
});
