import { useEffect, useRef, useState } from 'react';
import { ApiError, isAbortError } from '../../../api/client';
import { resolveImportRows, rowsPerRequest } from '../../../api/import/resolve';
import type { RawResolvedRow } from '../../../api/import/resolve';
import { normalizeCatalogBook } from '../../../normalize/catalog-book';
import { normalizeAiSearchBook } from '../../../normalize/search';
import type { RawAiSearchBook } from '../../../normalize/search';
import { parseCsv } from '../../../shared/lib/parse-csv';
import type { CsvBookRow } from '../../../shared/lib/parse-csv';
import { slugify } from '../../../shared/lib/slugify';
import { hashToHue } from '../../../shared/lib/hash';
import type { BookSummary } from '../../../shared/types/book';
import { useImportReview } from './useImportReview';
import type { UseImportReviewResult } from './useImportReview';

export type CsvPhase = 'upload' | 'review' | 'error';

/**
 * Rows accepted from one file. Sized for a Goodreads or StoryGraph migration,
 * which is the case CSV import exists to serve. The binding constraint is the
 * review list, which renders every row with no virtualisation — see LOS-171.
 */
export const MAX_CSV_ROWS = 1000;

const GENERIC_ERROR = "Couldn't look those books up — please try again.";
const RATE_LIMIT_ERROR = 'Too many imports right now — try again in a minute.';

export interface CsvCandidate {
  id: string;
  label: string;
  book: BookSummary;
  /** null for a local catalog match, which carries no provider payload. */
  raw: RawAiSearchBook | null;
}

export interface CsvRow {
  /** Keyed by CSV line, so two identical lines stay two independent rows. */
  key: string;
  hint: CsvBookRow;
  /** False until this row's batch comes back. */
  resolved: boolean;
  candidates: CsvCandidate[];
  /** Book id when this row is already in the library. */
  alreadyInLibraryId?: number;
}

export interface UseCsvImportSessionResult extends UseImportReviewResult<CsvRow> {
  phase: CsvPhase;
  rows: CsvRow[];
  error: string | null;
  /** Rows skipped during parsing — shown alongside the list, not instead of it. */
  warning: string | null;
  fileName: string | null;
  /** True while batches are still coming back. */
  resolving: boolean;
  /** Rows looked up so far, and the total. */
  progress: { done: number; total: number };
  selectedCandidateId: (key: string) => string | undefined;
  selectCandidate: (key: string, candidateId: string) => void;
  bookFor: (row: CsvRow) => BookSummary;
  start: (file: File) => void;
  /** Aborts an in-flight lookup and returns to the upload phase. */
  cancel: () => void;
  reset: () => void;
}

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_ERROR;
  if (error.status === 429) return RATE_LIMIT_ERROR;
  if (error.status === 400 && error.message) {
    return error.message.charAt(0).toUpperCase() + error.message.slice(1) + '.';
  }
  return GENERIC_ERROR;
}

/** One-line description dense enough to tell near-identical editions apart. */
function labelFor(book: BookSummary, publisher: string | null): string {
  const author = book.authorName || 'Unknown author';
  const detail = [publisher, book.year].filter(Boolean).join(', ');
  return detail ? `${book.title} — ${author} (${detail})` : `${book.title} — ${author}`;
}

/**
 * Stand-in cover built from what the file said, shown before a row is looked up
 * and kept if nothing matches. Cover draws its procedural design from `hue` when
 * there's no image, so the list has real shape from the first frame.
 */
function placeholderBook(hint: CsvBookRow): BookSummary {
  return {
    id: 0,
    slug: '',
    title: hint.title,
    authorName: hint.author ?? 'Unknown author',
    authorSlug: '',
    year: null,
    coverUrl: null,
    hue: hashToHue(`${hint.title}|${hint.author ?? ''}`),
    rating: null,
    source: 'catalog',
  };
}

function toCandidates(raw: RawResolvedRow): CsvCandidate[] {
  return raw.candidates.map((candidate, index) => {
    const { book } = normalizeAiSearchBook(candidate);
    return {
      id: candidate.googleBooksId ?? candidate.openLibraryId ?? `c${index}`,
      label: labelFor(book, candidate.publisher),
      book,
      raw: candidate,
    };
  });
}

export interface UseCsvImportSessionOptions {
  /** Book ids already in the library — those rows drop out of the review list. */
  excludeBookIds: number[];
  onAdded?: (count: number) => void;
}

/**
 * Owns CSV import: parse, resolve against the API, then hand off to
 * useImportReview for selection and commit.
 *
 * The whole file is listed the moment it parses, with placeholder covers, and
 * rows fill in as their batch returns. Waiting for every lookup before showing
 * anything meant staring at a spinner for minutes on a large file, with no sign
 * the right thing had even been read.
 */
export function useCsvImportSession(
  options: UseCsvImportSessionOptions,
): UseCsvImportSessionResult {
  const { excludeBookIds, onAdded } = options;

  const [phase, setPhase] = useState<CsvPhase>('upload');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [chosenByKey, setChosenByKey] = useState<Record<string, string>>({});

  function candidateFor(row: CsvRow): CsvCandidate | undefined {
    const chosen = chosenByKey[row.key];
    return row.candidates.find((c) => c.id === chosen) ?? row.candidates[0];
  }

  function bookFor(row: CsvRow): BookSummary {
    return candidateFor(row)?.book ?? placeholderBook(row.hint);
  }

  const review = useImportReview<CsvRow>({
    rows,
    keyOf: (row) => row.key,
    toAddArgs: (row) => {
      if (!row.resolved || row.alreadyInLibraryId !== undefined) return null;
      const candidate = candidateFor(row);
      if (!candidate?.raw) {
        // Nothing matched, or a catalog hit with no provider payload: upsert a
        // thin row from what the file said. The reader opted in by leaving it ticked.
        return {
          slug: slugify(candidate?.book.title ?? row.hint.title),
          rawFields: {
            title: candidate?.book.title ?? row.hint.title,
            authorName: candidate?.book.authorName || row.hint.author || 'Unknown',
            ...(row.hint.publisher ? { publisher: row.hint.publisher } : {}),
            ...(row.hint.isbn ? { isbn13: row.hint.isbn } : {}),
          },
        };
      }
      const { raw, book } = candidate;
      return {
        slug: slugify(book.title),
        rawFields: {
          title: book.title,
          authorName: book.authorName || 'Unknown',
          googleBooksId: raw.googleBooksId,
          openLibraryId: raw.openLibraryId,
          year: raw.year,
          publisher: raw.publisher,
          pages: raw.pages,
          rating: raw.rating,
          subjects: raw.categories,
          blurb: raw.blurb,
          coverUrl: raw.coverUrl,
          isbn13: raw.isbn13,
          language: raw.language,
        },
      };
    },
    // Unticked while still being looked up, and afterwards if nothing matched —
    // adding an unmatched row upserts a title-and-author-only catalog entry.
    // Already-owned rows can't be added at all.
    startsUnticked: (row) =>
      !row.resolved || row.candidates.length === 0 || row.alreadyInLibraryId !== undefined,
    onAdded,
  });

  const excludeRef = useRef(excludeBookIds);
  const registerRef = useRef(review.registerRows);
  const clearRef = useRef(review.clearSelection);
  useEffect(() => {
    excludeRef.current = excludeBookIds;
    registerRef.current = review.registerRows;
    clearRef.current = review.clearSelection;
  });

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Abandoning the page mid-import shouldn't leave requests running either.
  useEffect(() => () => abortRef.current?.abort(), []);

  function start(file: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;

    setFileName(file.name);
    setRows([]);
    setChosenByKey({});
    clearRef.current();
    setError(null);
    setWarning(null);
    setResolving(true);

    void run(runId, file, controller.signal);
  }

  /**
   * Stops an in-flight lookup. Unlike the photo scan — one short request, worth
   * finishing in the background and offering back in a toast — a CSV import is
   * many requests over minutes, and dismissing it plainly means stop.
   */
  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }

  async function run(runId: number, file: File, signal: AbortSignal) {
    const fail = (message: string) => {
      if (runId !== runIdRef.current) return;
      setError(message);
      setResolving(false);
      setPhase('error');
    };

    try {
      const { rows: parsed, error: parseError, warning: parseWarning } = parseCsv(await file.text());
      if (parseError) return fail(parseError);
      if (parsed.length > MAX_CSV_ROWS) {
        return fail(
          `That file has ${parsed.length} books — please import at most ${MAX_CSV_ROWS} at a time.`,
        );
      }
      if (runId !== runIdRef.current) return;

      // Show the whole file at once, unresolved. The reader sees their books
      // listed immediately and can scroll while lookups are still running.
      const pending: CsvRow[] = parsed.map((hint, index) => ({
        key: `csv:${index}`,
        hint,
        resolved: false,
        candidates: [],
      }));
      setRows(pending);
      registerRef.current(pending);
      setWarning(parseWarning);
      setPhase('review');

      const owned = new Set(excludeRef.current);

      // Read once per import, so a batch size cannot change mid-run.
      const batchSize = rowsPerRequest();

      for (let offset = 0; offset < parsed.length; offset += batchSize) {
        const batch = parsed.slice(offset, offset + batchSize);
        const { rows: resolvedRows } = await resolveImportRows(batch, signal);

        if (runId !== runIdRef.current) return;

        const filled: CsvRow[] = resolvedRows.map((raw, i) => {
          // The response carries the matched book itself, so there is nothing to
          // fetch back for it — this used to be a GET /books per batch, asking
          // for what the resolve response had already been holding (LOS-179).
          const catalogBook = raw.matchedBook ? normalizeCatalogBook(raw.matchedBook) : undefined;
          const candidates = toCandidates(raw);
          // A catalog match is the best candidate there is — put it first.
          if (catalogBook) {
            candidates.unshift({
              id: `book:${catalogBook.id}`,
              label: labelFor(catalogBook, raw.publisher),
              book: catalogBook,
              raw: null,
            });
          }
          return {
            key: `csv:${offset + i}`,
            hint: parsed[offset + i],
            resolved: true,
            candidates,
            ...(raw.matchedBookId !== undefined && owned.has(raw.matchedBookId)
              ? { alreadyInLibraryId: raw.matchedBookId }
              : {}),
          };
        });

        const byKey = new Map(filled.map((row) => [row.key, row]));
        setRows((current) => current.map((row) => byKey.get(row.key) ?? row));
        registerRef.current(filled);
      }

      if (runId === runIdRef.current) setResolving(false);
    } catch (e) {
      // A cancelled import is not a failure; cancel() has already reset state.
      if (isAbortError(e)) return;
      console.error('[csv-import] failed', e);
      fail(messageFor(e));
    }
  }

  function reset() {
    runIdRef.current++;
    setRows([]);
    setChosenByKey({});
    clearRef.current();
    setError(null);
    setWarning(null);
    setResolving(false);
    setFileName(null);
    setPhase('upload');
  }

  return {
    ...review,
    phase,
    rows,
    error,
    warning,
    fileName,
    resolving,
    progress: { done: rows.filter((r) => r.resolved).length, total: rows.length },
    selectedCandidateId: (key) => {
      const row = rows.find((r) => r.key === key);
      return chosenByKey[key] ?? row?.candidates[0]?.id;
    },
    selectCandidate: (key, candidateId) =>
      setChosenByKey((current) => ({ ...current, [key]: candidateId })),
    bookFor,
    start,
    cancel,
    reset,
  };
}
