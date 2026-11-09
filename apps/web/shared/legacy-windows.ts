import data from './legacy-windows-releases.json';
import { standaloneProduct } from './products';

export interface LegacyWindowsRelease {
  sku: string;
  version: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  published: boolean;
  channel: 'experimental';
  osAcceptance: 'pending';
}

const stems: Record<string, string> = {
  'YARIZAN-G1': 'YariZan-G1',
  'YARIZAN-S-NUMBER-BUILDER': 'YariZan-NumberBuilder',
  'YARIZAN-S-BUNDLE-BUILDER': 'YariZan-BundleBuilder',
  'YARIZAN-S-COMBINATION-LAND': 'YariZan-CombinationLand',
};

export function validateLegacyRelease(value: LegacyWindowsRelease): LegacyWindowsRelease {
  const stem = stems[value.sku];
  if (
    !stem ||
    !/^\d+\.\d+\.\d+$/.test(value.version) ||
    value.filename !== `${stem}-Legacy-Setup-v${value.version}-beta.exe` ||
    !Number.isSafeInteger(value.sizeBytes) ||
    value.sizeBytes <= 0 ||
    !/^[0-9a-f]{64}$/.test(value.sha256) ||
    typeof value.published !== 'boolean' ||
    value.channel !== 'experimental' ||
    value.osAcceptance !== 'pending'
  )
    throw new Error('INVALID_LEGACY_WINDOWS_RELEASE');
  return value;
}

// Enabled with the coordinated mirror handoff: infrastructure verifies and publishes
// these exact four artifacts before the web image starts. Publication is not OS acceptance.
export const legacyWindowsReleases = data.map((value) =>
  validateLegacyRelease(value as LegacyWindowsRelease),
);
export function legacyWindowsRelease(sku: string) {
  return legacyWindowsReleases.find((value) => value.sku === sku && value.published);
}
export function legacyWindowsUrl(value: LegacyWindowsRelease) {
  validateLegacyRelease(value);
  const path =
    value.sku === 'YARIZAN-G1' ? 'grade-1' : `products/${standaloneProduct(value.sku)!.slug}`;
  return `https://dl.oarnova.games/downloads/windows/legacy/${path}/${value.version}/${value.filename}`;
}

export const legacyWindowsRequirements = [
  'ویندوز ۷ سرویس‌پک ۱ یا ویندوز ۸.۱، با به‌روزرسانی‌های سیستم و گواهی‌های معتبر',
  'نسخهٔ ۳۲ یا ۶۴ بیتی؛ نصب‌کننده معماری مناسب را انتخاب می‌کند.',
  'نصب Microsoft .NET Framework 4.8 پیش از اجرای نصب‌کننده الزامی است.',
  'ویندوز ۸ اولیه و ویندوز ۷ بدون سرویس‌پک ۱ پشتیبانی نمی‌شوند.',
  'اینترنت برای اتصال به حساب، شروع هر نوبت آزمایش و دریافت مجوز؛ اجرای بعدی با مجوز معتبر آفلاین است.',
] as const;
