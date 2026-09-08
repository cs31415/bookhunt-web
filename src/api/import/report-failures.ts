import { apiFetch } from '../client';
import type { RawRowFailure } from './resolve';

/** A row an import could not resolve, and what the providers said about it. */
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

/**
 * POST /bff/import/report — hand the BFF what this import could not resolve, so
 * it can be reported in the server log (LOS-394).
 *
 * Only this app sees a whole import: the API answers one batch per request, so
 * a summary written there printed once per POST rather than once per file. The
 * report is assembled here and printed there, where diagnostics belong -- not
 * in the reader's own console.
 *
 * Never rejects. A diagnostic that broke an import would be worse than no
 * diagnostic, and there is nothing the reader could do about a failed one.
 */
export function reportImportFailures(
  entries: ImportFailureEntry[],
  totals: ImportFailureTotals,
): Promise<void> {
  return apiFetch<void>('/import/report', {
    method: 'POST',
    body: JSON.stringify({ ...totals, entries }),
    // The import modal shows its own progress; this must not touch the global
    // spinner, and must not raise a toast if it fails.
    silent: true,
  }).catch(() => {});
}
