/** Display digits without parsing or rounding financial values or identifiers. */
export function persianDigits(value: unknown): string {
  return String(value ?? '').replace(/[0-9٠-٩]/g, (digit) =>
    String.fromCharCode(
      1776 + (digit.charCodeAt(0) >= 1632 ? digit.charCodeAt(0) - 1632 : Number(digit)),
    ),
  );
}
export function asciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) >= 1776 ? digit.charCodeAt(0) - 1776 : digit.charCodeAt(0) - 1632),
  );
}
