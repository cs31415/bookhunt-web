import type { RawRowFailure } from '../../../api/import/resolve';

/**
 * The failure report for a whole import (LOS-394).
 *
 * The API answers one batch per request and cannot see an import; a 372-row
 * file is nineteen POSTs, so a summary written there printed nineteen times and
 * never gave a total. The session lives here, in the loop that sends the
 * batches, so this is where the reasons are worth putting together.
 *
 * Two questions get answered, in the order they get asked. The tally says what
 * went wrong with the import -- one rate limit reads very differently from
 * forty-seven. The titles say which books are left to deal with.
 */

/** A row that came back with nothing, and what the providers said about it. */
export interface ImportFailureEntry {
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  /** Empty when every provider answered and simply had nothing. */
  failures: RawRowFailure[];
}

export interface ImportFailureTotals {
  rows: number;
  batches: number;
}

/** A row as its owner would recognise it, ISBN preferred over publisher because it is exact. */
function describeRow(entry: ImportFailureEntry): string {
  const parts = [entry.title];
  if (entry.author) parts.push(`by ${entry.author}`);
  if (entry.isbn) parts.push(`[${entry.isbn}]`);
  else if (entry.publisher) parts.push(`(${entry.publisher})`);
  return parts.join(' ');
}

/** One provider's account, e.g. `google_books: HTTP 429 Rate Limit Exceeded`. */
function describeFailure(failure: RawRowFailure): string {
  if (failure.skipped) return `${failure.provider}: skipped, circuit open`;
  const status = failure.status === null ? 'no response' : `HTTP ${failure.status}`;
  return `${failure.provider}: ${status}${failure.detail ? ` ${failure.detail}` : ''}`;
}

/**
 * The tally, counted on the text of each failure so that a rate limit and a
 * gateway error from the same provider stay separate lines. Ordered by count:
 * the thing that broke the import is the thing to read first.
 */
function tally(entries: ImportFailureEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const failure of entry.failures) {
      const key = describeFailure(failure);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `    ${count} x ${reason}`);
}

/**
 * The report, or null when every row resolved — a clean import should print
 * nothing, so that output means something went wrong rather than being scrolled
 * past by habit.
 */
export function formatImportFailures(
  entries: ImportFailureEntry[],
  totals: ImportFailureTotals,
): string | null {
  if (entries.length === 0) return null;

  const errored = entries.filter((entry) => entry.failures.length > 0);
  // A provider answered and had nothing. Not an error, and rerunning will not
  // change it: these need a different title, an ISBN, or picking by hand.
  const notFound = entries.filter((entry) => entry.failures.length === 0);

  const batches = `${totals.batches} batch${totals.batches === 1 ? '' : 'es'}`;
  const lines = [`${totals.rows} rows, ${batches}: ${entries.length} did not resolve`];

  if (errored.length > 0) {
    lines.push('  errors by provider:', ...tally(errored));
    lines.push(`  ${errored.length} because a provider errored:`);
    for (const entry of errored) {
      lines.push(`    ${describeRow(entry)}`);
      // Every provider that failed the row: with a two-provider chain one may
      // be rationing us while the other is simply down.
      lines.push(...entry.failures.map((failure) => `      ${describeFailure(failure)}`));
    }
  }

  if (notFound.length > 0) {
    lines.push(`  ${notFound.length} because no provider had a match:`);
    lines.push(...notFound.map((entry) => `    ${describeRow(entry)}`));
  }

  return lines.join('\n');
}
