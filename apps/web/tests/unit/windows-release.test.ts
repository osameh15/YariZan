import { describe, it, expect } from 'vitest';
import {
  assertValidRelease,
  formatSizeMb,
  gradeStatus,
  grades,
  latestForGrade,
  latestPath,
  parseGrade,
  releasePath,
  releasesForGrade,
  windowsReleases,
  type WindowsRelease,
} from '../../shared/windows-release';
import { brochureDecision } from '../../shared/site-mode';

const sample: WindowsRelease = {
  grade: 1,
  version: '2.0.0',
  releasedAt: '2026-11-01',
  filename: 'YariZan-G1-Setup-2.0.0.exe',
  sizeBytes: 104857600,
  sha256: 'a'.repeat(64),
  format: 'exe',
  notes: ['Synthetic fixture'],
  requirements: ['Synthetic requirement'],
  approval: {
    approvedBy: 'Synthetic owner',
    approvedAt: '2026-10-30',
    productionTrustRoots: true,
    signed: true,
    scanned: true,
    provenance: 'synthetic-record-1',
  },
};

describe('Windows release list', () => {
  it('lists no release for any grade until the owner approves a V2 installer', () => {
    expect(windowsReleases).toEqual([]);
    for (const grade of grades) expect(latestForGrade(grade)).toBeNull();
    expect(gradeStatus(1)).toBe('content-ready');
    for (const grade of [2, 3, 4, 5, 6] as const) expect(gradeStatus(grade)).toBe('coming-soon');
  });
  it('serves downloads from the first-party mirror, per grade, never from GitHub', () => {
    expect(latestPath(3)).toBe('/downloads/windows/grade-3/latest');
    expect(releasePath(sample)).toBe('/downloads/windows/grade-1/2.0.0/YariZan-G1-Setup-2.0.0.exe');
    expect(JSON.stringify(windowsReleases)).not.toMatch(/github|https?:/i);
  });
  it('a grade becomes available only through a complete approved record', () => {
    expect(gradeStatus(1, [sample])).toBe('available');
    expect(gradeStatus(2, [sample])).toBe('coming-soon');
    expect(latestForGrade(1, [sample])?.version).toBe('2.0.0');
    expect(releasesForGrade(2, [sample])).toEqual([]);
    expect(() => gradeStatus(1, [sample, sample])).toThrow(/DUPLICATE/);
    expect(gradeStatus(1, [sample, { ...sample, version: '2.1.0' }])).toBe('available');
  });
  it('rejects records with a missing or incomplete approval', () => {
    const bad = [
      { ...sample.approval, approvedBy: ' ' },
      { ...sample.approval, approvedAt: 'soon' },
      { ...sample.approval, productionTrustRoots: false as unknown as true },
      { ...sample.approval, signed: false as unknown as true },
      { ...sample.approval, scanned: false as unknown as true },
      { ...sample.approval, provenance: '' },
    ];
    for (const approval of bad)
      expect(() => assertValidRelease({ ...sample, approval })).toThrow(/APPROVAL/);
    expect(() =>
      assertValidRelease({
        ...sample,
        approval: undefined as unknown as WindowsRelease['approval'],
      }),
    ).toThrow(/APPROVAL/);
    expect(() =>
      gradeStatus(1, [
        { ...sample, approval: { ...sample.approval, signed: false as unknown as true } },
      ]),
    ).toThrow(/APPROVAL/);
  });
  it('rejects malformed release records', () => {
    const bad: [Partial<WindowsRelease>, RegExp][] = [
      [{ grade: 7 as unknown as 1 }, /GRADE/],
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
      [{ requirements: [] }, /REQUIREMENTS/],
    ];
    for (const [patch, error] of bad)
      expect(() => assertValidRelease({ ...sample, ...patch }), JSON.stringify(patch)).toThrow(
        error,
      );
    expect(() => assertValidRelease(sample)).not.toThrow();
  });
  it('parses the grade query safely and defaults to grade 1', () => {
    expect(parseGrade('4')).toBe(4);
    expect(parseGrade(['5', '2'])).toBe(5);
    for (const value of [undefined, '', '0', '7', '1.5', '1 ', 'abc', '__proto__', null])
      expect(parseGrade(value)).toBe(1);
  });
  it('formats sizes in binary megabytes', () => {
    expect(formatSizeMb(104857600)).toBe('100.0');
    expect(formatSizeMb(1572864)).toBe('1.5');
  });
});

describe('Download page routing', () => {
  it('serves the page in public-only profiles; binaries belong to the mirror, not Nuxt', () => {
    expect(brochureDecision('GET', '/download')).toBe('page');
    expect(brochureDecision('GET', '/download?grade=3')).toBe('page');
    expect(brochureDecision('POST', '/download')).toBe('method-not-allowed');
    expect(brochureDecision('GET', '/download/')).toBe('not-found');
    expect(brochureDecision('GET', '/downloads/windows/grade-1/latest')).toBe('not-found');
  });
});
