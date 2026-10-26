// Approved Windows installer releases, one list for all grades, newest first. This is the only
// source for the public download page. A grade is downloadable ONLY when a complete, explicitly
// approved release record exists for it: a UI flag alone can never enable a download. The list is
// empty until the owner approves a V2 installer for a grade (current Windows CI, real Windows test,
// production licensing trust roots, signing policy, malware scan and provenance). The legacy G1
// installer on GitHub is not a V2 release and must never be listed here.
// Files are served by the first-party release mirror under /downloads/windows/ on the direct-download
// host (DNS-only, the CDN refuses files this large), never by GitHub.
export const grades = [1, 2, 3, 4, 5, 6] as const;
export type Grade = (typeof grades)[number];
export type InstallerFormat = 'exe' | 'msi' | 'zip';

export const gradeTitles: Record<Grade, string> = {
  1: 'اول',
  2: 'دوم',
  3: 'سوم',
  4: 'چهارم',
  5: 'پنجم',
  6: 'ششم',
};
// Whether the game content of a grade exists. This never enables a download by itself.
export const gradeContent: Record<Grade, 'ready' | 'planned'> = {
  1: 'ready',
  2: 'planned',
  3: 'planned',
  4: 'planned',
  5: 'planned',
  6: 'planned',
};

export interface ReleaseApproval {
  approvedBy: string;
  /** Approval date, ISO yyyy-mm-dd. */
  approvedAt: string;
  /** Production license trust roots are embedded (never development or synthetic keys). */
  productionTrustRoots: true;
  /**
   * How the installer is distributed: Authenticode-signed, or without any signature under the
   * owner's recorded 2.0.0 exception (docs/evidence/release-2.0.0-owner-acceptance.md), which the
   * download page discloses together with the SHA-256 check.
   */
  signature: 'authenticode' | 'unsigned-owner-approved';
  /** The artifact passed the malware and security scan. */
  scanned: true;
  /** Build provenance reference (attestation digest or release record id). */
  provenance: string;
}

export interface WindowsRelease {
  grade: Grade;
  version: string;
  /** Release date, ISO yyyy-mm-dd. */
  releasedAt: string;
  filename: string;
  sizeBytes: number;
  /** Lowercase hex SHA-256 of the file, from the release record on the mirror. */
  sha256: string;
  format: InstallerFormat;
  notes: readonly string[];
  requirements: readonly string[];
  approval: ReleaseApproval;
}

export const windowsReleases: readonly WindowsRelease[] = [
  {
    grade: 1,
    version: '2.1.0',
    releasedAt: '2026-10-26',
    filename: 'YariZan-G1-Setup-v2.1.0.exe',
    sizeBytes: 1081403001,
    sha256: '85cf8e1fc147c85d8ff6ff8e29a637774b5b0901f2c860efdd380a9e32a48ecb',
    format: 'exe',
    notes: [
      'صفحهٔ فعال‌سازی اکنون اولین صفحهٔ برنامه است و در پنجره‌ای کوچک و جابه‌جاشدنی باز می‌شود.',
      'پشتیبانی از ویندوز ۳۲ بیتی در کنار ۶۴ بیتی.',
      'نمایش شناسهٔ دستگاه در صفحهٔ اطلاعات پس از فعال‌سازی.',
    ],
    requirements: [
      'ویندوز ۱۰ یا ۱۱ (۶۴ یا ۳۲ بیتی)',
      'حدود ۲ گیگابایت فضای خالی دیسک',
      'اینترنت برای اتصال حساب، شروع فرصت تجربه و فعال‌سازی؛ پس از فعال‌سازی، بازی‌ها آفلاین اجرا می‌شوند.',
    ],
    approval: {
      approvedBy: 'OAR NOVA GAMES STUDIO (owner)',
      approvedAt: '2026-10-26',
      productionTrustRoots: true,
      signature: 'unsigned-owner-approved',
      scanned: true,
      provenance: 'release-2.1.0@8cf313c',
    },
  },
  {
    grade: 1,
    version: '2.0.0',
    releasedAt: '2026-10-24',
    filename: 'YariZan-G1-Setup-v2.0.0.exe',
    sizeBytes: 1042426854,
    sha256: 'd01bb66afebe125ed8ce259c9f091c5e63820aad42048c08488557c6263642b7',
    format: 'exe',
    notes: [
      'نخستین نسخهٔ تجاری یاریزان پایهٔ اول برای ویندوز.',
      'اتصال دستگاه به حساب، دو فرصت تجربه، خرید از سایت و فعال‌سازی خودکار.',
      'اجرای آفلاین بازی‌ها پس از فعال‌سازی.',
    ],
    requirements: [
      'ویندوز ۱۰ یا ۱۱ (۶۴ بیتی)',
      'حدود ۲ گیگابایت فضای خالی دیسک',
      'اینترنت برای اتصال حساب، شروع فرصت تجربه و فعال‌سازی؛ پس از فعال‌سازی، بازی‌ها آفلاین اجرا می‌شوند.',
    ],
    approval: {
      approvedBy: 'OAR NOVA GAMES STUDIO (owner)',
      approvedAt: '2026-10-24',
      productionTrustRoots: true,
      signature: 'unsigned-owner-approved',
      scanned: true,
      provenance: 'release-2.0.0@55939c3960cf7f772d1d2ca74c1473629206baf9',
    },
  },
];

export type GradeStatus = 'available' | 'content-ready' | 'coming-soon';

const versionPattern = /^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,5}$/;
const filenamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(exe|msi|zip)$/;
const isoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export function parseGrade(value: unknown): Grade {
  const raw = Array.isArray(value) ? value[0] : value;
  const number = typeof raw === 'string' && /^[1-6]$/.test(raw) ? Number(raw) : 1;
  return number as Grade;
}

/** First-party direct-download host of the release mirror (not proxied by the CDN). */
export const DOWNLOAD_ORIGIN = 'https://dl.oarnova.games';
export function releasePath(release: Pick<WindowsRelease, 'grade' | 'version' | 'filename'>) {
  return `/downloads/windows/grade-${release.grade}/${release.version}/${release.filename}`;
}
export function latestPath(grade: Grade) {
  return `/downloads/windows/grade-${grade}/latest`;
}
export function releaseUrl(release: Pick<WindowsRelease, 'grade' | 'version' | 'filename'>) {
  return DOWNLOAD_ORIGIN + releasePath(release);
}
export function latestUrl(grade: Grade) {
  return DOWNLOAD_ORIGIN + latestPath(grade);
}

// Fails loudly at build and test time rather than publishing a malformed or unapproved download.
export function assertValidRelease(release: WindowsRelease) {
  if (!grades.includes(release.grade)) throw new Error('RELEASE_GRADE_INVALID');
  if (!versionPattern.test(release.version)) throw new Error('RELEASE_VERSION_INVALID');
  if (!isoDate(release.releasedAt)) throw new Error('RELEASE_DATE_INVALID');
  const match = filenamePattern.exec(release.filename);
  if (!match || match[1] !== release.format) throw new Error('RELEASE_FILENAME_INVALID');
  if (!Number.isSafeInteger(release.sizeBytes) || release.sizeBytes <= 0)
    throw new Error('RELEASE_SIZE_INVALID');
  if (!/^[0-9a-f]{64}$/.test(release.sha256)) throw new Error('RELEASE_SHA256_INVALID');
  if (release.notes.some((note) => note.trim() === '')) throw new Error('RELEASE_NOTES_INVALID');
  if (release.requirements.length === 0 || release.requirements.some((item) => item.trim() === ''))
    throw new Error('RELEASE_REQUIREMENTS_INVALID');
  const a = release.approval;
  if (
    !a ||
    a.approvedBy.trim() === '' ||
    !isoDate(a.approvedAt) ||
    a.productionTrustRoots !== true ||
    !['authenticode', 'unsigned-owner-approved'].includes(a.signature) ||
    a.scanned !== true ||
    a.provenance.trim() === ''
  )
    throw new Error('RELEASE_APPROVAL_INCOMPLETE');
}

function validated(releases: readonly WindowsRelease[]) {
  releases.forEach(assertValidRelease);
  const keys = releases.map((release) => `${release.grade}@${release.version}`);
  if (new Set(keys).size !== keys.length) throw new Error('RELEASE_VERSION_DUPLICATE');
  return releases;
}

export function releasesForGrade(
  grade: Grade,
  releases: readonly WindowsRelease[] = windowsReleases,
) {
  return validated(releases).filter((release) => release.grade === grade);
}
/** Newest approved release of a grade, or null when the grade has no approved installer. */
export function latestForGrade(
  grade: Grade,
  releases: readonly WindowsRelease[] = windowsReleases,
) {
  return releasesForGrade(grade, releases)[0] ?? null;
}
export function gradeStatus(
  grade: Grade,
  releases: readonly WindowsRelease[] = windowsReleases,
): GradeStatus {
  if (latestForGrade(grade, releases)) return 'available';
  return gradeContent[grade] === 'ready' ? 'content-ready' : 'coming-soon';
}

// 12.3 MB style size for the public page, binary megabytes (1 MB = 1,048,576 bytes).
export function formatSizeMb(bytes: number) {
  return (bytes / 1048576).toFixed(1);
}
