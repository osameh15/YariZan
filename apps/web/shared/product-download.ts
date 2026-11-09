import { standaloneRelease } from './standalone-releases';
import { latestForGrade, type Grade } from './windows-release';

/** Only released installers get a download entry point. */
export function productDownloadPath(sku: string): string | null {
  if (standaloneRelease(sku)) return '/download?product=' + sku;
  const grade = /^YARIZAN-G([1-6])$/.exec(sku);
  return grade && latestForGrade(Number(grade[1]) as Grade) ? '/download?grade=' + grade[1] : null;
}
