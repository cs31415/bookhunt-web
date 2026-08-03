import { apiFetch } from '../client';
import type { RawAiSearchBook } from '../../normalize/search';
import type { RawCatalogBook } from '../../normalize/catalog-book';

/** The API rejects anything larger (MAX_IMPORT_ROWS, server-side). */
const MAX_ROWS_PER_REQUEST = 40;

/** Used when VITE_IMPORT_ROWS_PER_REQUEST is unset or unusable. */
const DEFAULT_ROWS_PER_REQUEST = 20;

/**
 * Rows per resolve request.
 *
 * The review list fills a batch at a time, so this trades round trips against
 * how soon covers start appearing. The server resolves 8 rows concurrently, so
 * the default is about three waves of provider calls between updates.
 *
 * It was 10 when every imported row cost the server its own catalog query. A
 * batch now costs one query whatever its size and Open Library is off the common
 * path (LOS-179), so larger batches are far cheaper than they were: a 1000-row
 * import makes 50 requests rather than 100.
 *
 * Read at call time, like the feature flags, so tests can stub it without
 * resetting modules and nothing depends on import order. Vite substitutes
 * `import.meta.env` at build time, so a change needs a dev-server restart.
 */
export function rowsPerRequest(): number {
  const configured = Number(import.meta.env.VITE_IMPORT_ROWS_PER_REQUEST);
  if (!Number.isFinite(configured) || configured < 1) return DEFAULT_ROWS_PER_REQUEST;
  return Math.min(Math.floor(configured), MAX_ROWS_PER_REQUEST);
}

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
  /**
   * The matched catalog book, ready to render. Sent with the id because the
   * search that found it already had the cover, slug and author — so there is
   * nothing left to fetch back (LOS-179).
   */
  matchedBook?: RawCatalogBook;
  /** Ranked best-first; empty when nothing was found. */
  candidates: RawAiSearchBook[];
  /**
   * True when no candidate answers the row's title — the provider offered a
   * book by the same author instead. Sometimes that is a retitled edition
   * ("Fermat's Enigma" is shelved as "Fermat's Last Theorem"), sometimes an
   * unrelated book, and nothing in the response separates the two.
   *
   * So these must never be preselected. A row asking for "From So Simple a
   * Beginning" by Clive Gamble came back with Cyclops by Clive Cussler, and
   * because this flag was ignored it went into the library unnoticed (LOS-205).
   */
  tentative?: boolean;
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
