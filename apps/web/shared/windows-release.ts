// Approved Windows installer releases, newest first. This list is the only source for the public
// download page. It stays empty until the owner approves a V2 installer (current Windows CI, runtime
// test, production licensing trust roots, signing policy, malware scan and provenance). The legacy
// G1 installer on GitHub is not a V2 release and must never be listed here.
// The file is served by the first-party release mirror under /downloads/windows/, never by GitHub.
export type InstallerFormat = 'exe' | 'msi' | 'zip';

export interface WindowsRelease {
  version: string;
  /** Release date, ISO yyyy-mm-dd. */
  releasedAt: string;
  filename: string;
  sizeBytes: number;
  /** Lowercase hex SHA-256 of the file, from the release record. */
  sha256: string;
  format: InstallerFormat;
  notes: readonly string[];
}

export const windowsReleases: readonly WindowsRelease[] = [];

export const latestDownloadPath = '/downloads/windows/latest';

const versionPattern = /^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,5}$/;
const filenamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(exe|msi|zip)$/;

export function releasePath(release: Pick<WindowsRelease, 'version' | 'filename'>) {
  return `/downloads/windows/${release.version}/${release.filename}`;
}

// Fails loudly at build and test time rather than publishing a malformed download.
export function assertValidRelease(release: WindowsRelease) {
  if (!versionPattern.test(release.version)) throw new Error('RELEASE_VERSION_INVALID');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(release.releasedAt) ||
    Number.isNaN(Date.parse(release.releasedAt))
  )
    throw new Error('RELEASE_DATE_INVALID');
  const match = filenamePattern.exec(release.filename);
  if (!match || match[1] !== release.format) throw new Error('RELEASE_FILENAME_INVALID');
  if (!Number.isSafeInteger(release.sizeBytes) || release.sizeBytes <= 0)
    throw new Error('RELEASE_SIZE_INVALID');
  if (!/^[0-9a-f]{64}$/.test(release.sha256)) throw new Error('RELEASE_SHA256_INVALID');
  if (release.notes.some((note) => note.trim() === '')) throw new Error('RELEASE_NOTES_INVALID');
}

export function latestWindowsRelease(releases: readonly WindowsRelease[] = windowsReleases) {
  releases.forEach(assertValidRelease);
  if (new Set(releases.map((release) => release.version)).size !== releases.length)
    throw new Error('RELEASE_VERSION_DUPLICATE');
  return releases[0] ?? null;
}

// 12.3 MB style size for the public page, binary megabytes (1 MB = 1,048,576 bytes).
export function formatSizeMb(bytes: number) {
  return (bytes / 1048576).toFixed(1);
}
