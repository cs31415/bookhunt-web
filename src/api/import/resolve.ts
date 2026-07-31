import { apiFetch } from '../client';
import type { RawAiSearchBook } from '../../normalize/search';

/** Rows the API accepts per request; the client batches a larger CSV into several. */
export const MAX_ROWS_PER_REQUEST = 40;

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
export function resolveImportRows(rows: ImportRowHint[]): Promise<{ rows: RawResolvedRow[] }> {
  return apiFetch('/import/resolve', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}
