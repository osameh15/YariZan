import { describe, expect, it } from 'vitest';
import { productDownloadPath } from '#shared/product-download';
describe('product download entry points', () => {
  it('links every released product to its matching installer selection', () => {
    expect(productDownloadPath('YARIZAN-G1')).toBe('/download?grade=1');
    for (const sku of [
      'YARIZAN-S-NUMBER-BUILDER',
      'YARIZAN-S-BUNDLE-BUILDER',
      'YARIZAN-S-COMBINATION-LAND',
    ]) {
      expect(productDownloadPath(sku)).toBe('/download?product=' + sku);
    }
  });
  it('does not advertise installers for unreleased grades or unknown products', () => {
    for (const sku of ['YARIZAN-G2', 'YARIZAN-G6', 'YARIZAN-G0', 'YARIZAN-S-UNKNOWN']) {
      expect(productDownloadPath(sku)).toBeNull();
    }
  });
});
