import { apiFetch } from '../client';
import type { RawAiSearchBook } from '../../normalize/search';

/**
 * Rows per request. Well below the API's cap of 40, because the review list
 * fills in a batch at a time: smaller batches mean covers start appearing
 * sooner, at the cost of more round trips.
 */
export const ROWS_PER_REQUEST = 10;

export interface ImportRowHint {
  title: string;
  author?: string | null;
  publisher?: string | null;
  /** Matched exactly when present, outranking every other signal. */
  isbn?: string | null;
}

export interface RawResolvedRow {
  title: string;
  author: string | null;
  publisher: string | null;
  /** Normalised form of the supplied ISBN, or null. */
  isbn: string | null;
  /** Present when the row is already in the catalog. */
  matchedBookId?: number;
  /** Ranked best-first; empty when nothing was found. */
  candidates: RawAiSearchBook[];
}

/**
 * POST /import/resolve — results are index-aligned with the rows sent, which is
 * what lets each candidate dropdown stay attached to its CSV line.
 */
export function resolveImportRows(
  rows: ImportRowHint[],
  signal?: AbortSignal,
): Promise<{ rows: RawResolvedRow[] }> {
  return apiFetch('/import/resolve', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    signal,
    // The modal shows its own progress bar. Left unsilenced, each of the many
    // requests a large file makes would drive the global full-screen activity
    // spinner, which then lingers over the page once the modal is dismissed.
    silent: true,
  });
}
