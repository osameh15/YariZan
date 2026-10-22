import { describe, expect, it } from 'vitest';
import {
  canonicalOrigin,
  parseIndexing,
  protectedRoute,
  robotsHeader,
  robotsTxt,
  sitemapPaths,
  sitemapXml,
} from '../../shared/seo';
import { brochureDecision } from '../../shared/site-mode';

describe('search indexing policy', () => {
  it('defaults to noindex for anything but an explicit "index"', () => {
    for (const value of [undefined, '', 'INDEX', 'true', 'yes', 'noindex'])
      expect(parseIndexing(value)).toBe('noindex');
    expect(parseIndexing('index')).toBe('index');
    expect(robotsTxt('noindex', 'https://yarizan.oarnova.games')).toBe(
      'User-agent: *\nDisallow: /\n',
    );
    expect(robotsHeader('noindex', '/')).toBe('noindex, nofollow');
  });
  it('protected routes stay noindex even when indexing is accepted', () => {
    for (const path of [
      '/account',
      '/account/orders',
      '/zanyari',
      '/login',
      '/connect',
      '/checkout',
      '/payment/result',
      '/reset-password',
      '/support-reset',
      '/api/v2/products',
    ])
      expect(robotsHeader('index', path), path).toBe('noindex, nofollow');
    expect(robotsHeader('index', '/products/grade-1')).toBe('index, follow');
    const robots = robotsTxt('index', 'https://yarizan.oarnova.games');
    expect(robots).toContain('Disallow: /zanyari');
    expect(robots).toContain('Sitemap: https://yarizan.oarnova.games/sitemap.xml');
  });
  it('sitemap lists only public pages under the canonical origin', () => {
    expect(sitemapPaths.some((p) => protectedRoute.test(p))).toBe(false);
    expect(sitemapPaths.every((p) => brochureDecision('GET', p) === 'page')).toBe(true);
    const xml = sitemapXml('https://yarizan.oarnova.games');
    expect(xml.match(/<loc>/g)).toHaveLength(9);
    expect(xml).not.toMatch(/account|zanyari|checkout|payment|login/);
    expect(() => canonicalOrigin('https://yarizan.oarnova.games/path')).toThrow();
    expect(canonicalOrigin('https://yarizan.oarnova.games')).toBe('https://yarizan.oarnova.games');
  });
  it('crawler files are reachable in public-only profiles; writes are refused', () => {
    expect(brochureDecision('GET', '/robots.txt')).toBe('asset');
    expect(brochureDecision('GET', '/sitemap.xml')).toBe('asset');
    expect(brochureDecision('POST', '/robots.txt')).toBe('method-not-allowed');
  });
});

describe('protected routes ignore letter case (GHSA-vjh5-4x84-xrqp)', () => {
  it('matches every case variant of protected pages and the API', () => {
    for (const path of [
      '/ACCOUNT',
      '/Account/orders',
      '/ZanYari',
      '/CHECKOUT',
      '/Payment/return',
      '/LOGIN',
      '/Connect',
      '/Reset-Password',
      '/SUPPORT-RESET',
      '/API/v2/account',
      '/Api',
    ])
      expect(protectedRoute.test(path), path).toBe(true);
    for (const path of [
      '/',
      '/products',
      '/Products',
      '/download',
      '/legal/privacy',
      '/accounts-info',
    ])
      expect(protectedRoute.test(path), path).toBe(false);
  });
});
