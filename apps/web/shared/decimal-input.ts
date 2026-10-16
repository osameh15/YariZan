// Validate decimal text before crossing the existing numeric DTO boundary.
// Reject values that Number would silently round or that violate the exact step.
export function decimalValue(text: string, step = '1'): number | undefined {
  if (!/^\d+(?:\.\d+)?$/.test(text) || !/^\d+(?:\.\d+)?$/.test(step)) return;
  const value = Number(text),
    rendered = String(value);
  if (!Number.isFinite(value) || !/^\d+(?:\.\d+)?$/.test(rendered)) return;
  const precision = Math.max(...[text, step, rendered].map((s) => s.split('.')[1]?.length ?? 0));
  const integer = (s: string) => {
    const [whole = '0', fraction = ''] = s.split('.');
    return (
      BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0') || '0')
    );
  };
  const raw = integer(text),
    increment = integer(step);
  if (increment <= 0n || raw !== integer(rendered) || raw % increment !== 0n) return;
  return value;
}
