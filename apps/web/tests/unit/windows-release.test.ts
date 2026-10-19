import { describe, it, expect } from 'vitest';
import {
  assertValidRelease,
  formatSizeMb,
  latestDownloadPath,
  latestWindowsRelease,
  releasePath,
  windowsReleases,
  type WindowsRelease,
} from '../../shared/windows-release';
import { brochureDecision } from '../../shared/site-mode';

const sample: WindowsRelease = {
  version: '2.0.0',
  releasedAt: '2026-11-01',
  filename: 'YariZan-Setup-2.0.0.exe',
  sizeBytes: 104857600,
  sha256: 'a'.repeat(64),
  format: 'exe',
  notes: ['Synthetic fixture'],
};

describe('Windows release list', () => {
  it('lists no release until the owner approves a V2 installer', () => {
    expect(windowsReleases).toEqual([]);
    expect(latestWindowsRelease()).toBeNull();
  });
  it('serves downloads from the first-party mirror, never from GitHub', () => {
    expect(latestDownloadPath).toBe('/downloads/windows/latest');
    expect(releasePath(sample)).toBe('/downloads/windows/2.0.0/YariZan-Setup-2.0.0.exe');
    for (const release of windowsReleases)
      expect(JSON.stringify(release)).not.toMatch(/github|https?:/i);
  });
  it('returns the newest release and rejects duplicates', () => {
    expect(latestWindowsRelease([sample])?.version).toBe('2.0.0');
    expect(() => latestWindowsRelease([sample, sample])).toThrow(/DUPLICATE/);
  });
  it('rejects malformed release records', () => {
    const bad: [Partial<WindowsRelease>, RegExp][] = [
      [{ version: '2.0' }, /VERSION/],
      [{ version: '2.0.0/../x' }, /VERSION/],
      [{ releasedAt: '2026-13-45' }, /DATE/],
      [{ filename: '../x.exe' }, /FILENAME/],
      [{ filename: 'setup.exe', format: 'msi' }, /FILENAME/],
      [{ filename: 'setup.bat' }, /FILENAME/],
      [{ sizeBytes: 0 }, /SIZE/],
      [{ sizeBytes: 1.5 }, /SIZE/],
      [{ sha256: 'A'.repeat(64) }, /SHA256/],
      [{ sha256: 'a'.repeat(63) }, /SHA256/],
      [{ notes: [' '] }, /NOTES/],
    ];
    for (const [patch, error] of bad)
      expect(() => assertValidRelease({ ...sample, ...patch }), JSON.stringify(patch)).toThrow(
        error,
      );
    expect(() => assertValidRelease(sample)).not.toThrow();
  });
  it('formats sizes in binary megabytes', () => {
    expect(formatSizeMb(104857600)).toBe('100.0');
    expect(formatSizeMb(1572864)).toBe('1.5');
  });
});

describe('Download page routing', () => {
  it('serves the page in public-only profiles; binaries belong to the mirror, not Nuxt', () => {
    expect(brochureDecision('GET', '/download')).toBe('page');
    expect(brochureDecision('POST', '/download')).toBe('method-not-allowed');
    expect(brochureDecision('GET', '/download/')).toBe('not-found');
    expect(brochureDecision('GET', '/downloads/windows/latest')).toBe('not-found');
  });
});
