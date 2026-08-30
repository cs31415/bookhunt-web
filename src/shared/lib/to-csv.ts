/**
 * Writes CSV, in the shape parse-csv.ts reads back.
 *
 * A header row always, because the parser requires one -- it matches columns by
 * name so a file whose columns are ordered differently still reads correctly,
 * and a positional file would not.
 */

/**
 * Quotes a value only where it would otherwise be misread.
 *
 * A comma, a quote or a newline inside a value is what breaks a naive writer,
 * and the parser's own rule for reading them back is the doubled quote. A
 * leading or trailing space is quoted too: the parser trims, so an author who
 * really is written " Anon" would come back changed.
 */
function escapeCell(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value) || value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellOf(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return escapeCell(String(value));
}

/**
 * A CSV of `rows`, taking the named columns in the order given.
 *
 * CRLF line endings, which is what RFC 4180 specifies and what Excel expects on
 * every platform. The parser splits on either, so nothing here depends on it.
 */
export function toCsv<T extends object>(
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
): string {
  const lines = [columns.map(cellOf).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => cellOf(row[column] as never)).join(','));
  }
  return lines.join('\r\n');
}
