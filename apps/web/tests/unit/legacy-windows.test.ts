import { describe, expect, it } from 'vitest';
import {
  legacyWindowsRelease,
  legacyWindowsReleases,
  legacyWindowsUrl,
  validateLegacyRelease,
} from '../../shared/legacy-windows';
import { standaloneProducts } from '../../shared/products';

describe('legacy Windows downloads', () => {
  it('covers every released product with a separate tested installer', () => {
    const skus = ['YARIZAN-G1', ...standaloneProducts.map((p) => p.sku)].sort();
    expect(legacyWindowsReleases.map((p) => p.sku).sort()).toEqual(skus);
    for (const sku of skus) {
      const record = legacyWindowsRelease(sku)!;
      expect(record.channel).toBe('stable');
      expect(record.osAcceptance).toBe('verified');
      expect(record.filename).toMatch(/-Legacy-Setup-v[0-9.]+-beta\.exe$/);
      const url = legacyWindowsUrl(record);
      expect(url).toMatch(/^https:\/\/dl\.oarnova\.games\/downloads\/windows\/legacy\//);
      expect(url).toContain(sku === 'YARIZAN-G1' ? '/grade-1/' : '/products/');
    }
    expect(legacyWindowsRelease('YARIZAN-G2')).toBeUndefined();
  });
  it('rejects wrong products, unreviewed claims and altered filenames or checksums', () => {
    const record = legacyWindowsReleases[0]!;
    for (const changed of [
      { sku: 'YARIZAN-G2' },
      { filename: '../setup.exe' },
      { filename: 'YariZan-G1-Setup-v2.1.0.exe' },
      { sha256: 'a'.repeat(63) },
      { sizeBytes: 0 },
      { channel: 'experimental' },
      { osAcceptance: 'pending' },
    ])
      expect(() => validateLegacyRelease({ ...record, ...changed } as typeof record)).toThrow();
  });
});
