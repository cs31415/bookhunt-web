/**
 * Coerces an API numeric field to a real number. Postgres NUMERIC columns
 * (e.g. a book's `rating`) are serialized over JSON as strings ("4.5"), but the
 * app types and treats them as `number | null` — passing the raw string through
 * makes callers like `rating.toFixed(1)` throw. Returns null for null/undefined,
 * empty, or non-numeric input.
 */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
