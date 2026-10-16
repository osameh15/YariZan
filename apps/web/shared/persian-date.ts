// Gregorian ISO dates stay at the API boundary; the picker uses Solar Hijri dates.
const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});
export const persianMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
export function persianParts(date: Date) {
  const parts = formatter.formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}
export function persianDate(year: number, month: number, day: number): string {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 3000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    throw new RangeError('Invalid Persian date');
  const key = year * 10000 + month * 100 + day;
  let low = Date.UTC(year + 621, 0, 1) / 86400000,
    high = Date.UTC(year + 623, 0, 1) / 86400000;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2),
      date = new Date(mid * 86400000),
      p = persianParts(date),
      value = p.year * 10000 + p.month * 100 + p.day;
    if (value === key) return date.toISOString().slice(0, 10);
    if (value < key) low = mid + 1;
    else high = mid - 1;
  }
  throw new RangeError('Invalid Persian date');
}
export function persianMonthDays(year: number, month: number) {
  const first = persianDate(year, month, 1),
    next = persianDate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1);
  return Math.round((Date.parse(next) - Date.parse(first)) / 86400000);
}
export const latinDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
