import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../api/client';
import { MAX_ROWS_PER_REQUEST, resolveImportRows } from '../../../api/import/resolve';
import type { RawResolvedRow } from '../../../api/import/resolve';
import { getBooksByIds } from '../../../api/books/get-books-by-ids';
import { normalizeBooksByIds } from '../../../normalize/books-by-ids';
import { normalizeAiSearchBook } from '../../../normalize/search';
import { parseCsv } from '../../../shared/lib/parse-csv';
import { slugify } from '../../../shared/lib/slugify';
import type { BookSummary } from '../../../shared/types/book';
import { useImportReview } from './useImportReview';
import type { UseImportReviewResult } from './useImportReview';

export type CsvPhase = 'upload' | 'processing' | 'results' | 'error';

/**
 * Rows accepted from one file. Sized for a Goodreads or StoryGraph migration,
 * which is the case CSV import exists to serve. The binding constraint is the
 * review list, which renders every row's cover and dropdown with no
 * virtualisation — see LOS-171.
 */
export const MAX_CSV_ROWS = 1000;

const GENERIC_ERROR = "Couldn't look those books up — please try again.";
const RATE_LIMIT_ERROR = 'Too many imports right now — try again in a minute.';

export interface CsvCandidate {
  id: string;
  label: string;
  book: BookSummary;
  raw: import('../../../normalize/search').RawAiSearchBook;
}

export interface CsvRow {
  /** Keyed by CSV line, so two identical lines stay two independent rows. */
  key: string;
  /** What the file said, shown when nothing was matched. */
  hint: { title: string; author: string | null; publisher: string | null; isbn: string | null };
  candidates: CsvCandidate[];
  /** Book id when this row is already in the library. */
  alreadyInLibraryId?: number;
}

export interface UseCsvImportSessionResult extends UseImportReviewResult<CsvRow> {
  phase: CsvPhase;
  rows: CsvRow[];
  error: string | null;
  /** Rows skipped during parsing — shown alongside results, not instead of them. */
  warning: string | null;
  fileName: string | null;
  /** Rows looked up so far, and the total, while resolving. */
  progress: { done: number; total: number } | null;
  selectedCandidateId: (key: string) => string | undefined;
  selectCandidate: (key: string, candidateId: string) => void;
  bookFor: (row: CsvRow) => BookSummary;
  start: (file: File) => void;
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

/** Placeholder for a row nothing matched, so it can still be reviewed and added. */
function unmatchedBook(hint: CsvRow['hint']): BookSummary {
  return {
    id: 0,
    slug: '',
    title: hint.title,
    authorName: hint.author ?? 'Unknown author',
    authorSlug: '',
    year: null,
    coverUrl: null,
    hue: 'var(--line-2)',
    rating: null,
    source: 'catalog',
  };
}

export interface UseCsvImportSessionOptions {
  /** Book ids already in the library — those rows render inert rather than vanishing. */
  excludeBookIds: number[];
  onResolveComplete?: (count: number) => void;
  onAdded?: (count: number) => void;
}

/**
 * Owns CSV import: parse, resolve against the API, then hand off to
 * useImportReview for selection and commit.
 *
 * Lives in LibraryPage rather than the modal for the same reason the scan
 * session does — closing mid-resolve must not abandon the request.
 */
export function useCsvImportSession(
  options: UseCsvImportSessionOptions,
): UseCsvImportSessionResult {
  const { excludeBookIds, onResolveComplete, onAdded } = options;

  const [phase, setPhase] = useState<CsvPhase>('upload');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [chosenByKey, setChosenByKey] = useState<Record<string, string>>({});

  function candidateFor(row: CsvRow): CsvCandidate | undefined {
    const chosen = chosenByKey[row.key];
    return row.candidates.find((c) => c.id === chosen) ?? row.candidates[0];
  }

  function bookFor(row: CsvRow): BookSummary {
    return candidateFor(row)?.book ?? unmatchedBook(row.hint);
  }

  const review = useImportReview<CsvRow>({
    rows,
    keyOf: (row) => row.key,
    toAddArgs: (row) => {
      if (row.alreadyInLibraryId !== undefined) return null;
      const candidate = candidateFor(row);
      if (!candidate) {
        // Nothing matched: still addable, upserting a thin catalog row from what
        // the file said. The reader opted in by leaving it ticked.
        return {
          slug: slugify(row.hint.title),
          rawFields: {
            title: row.hint.title,
            authorName: row.hint.author ?? 'Unknown',
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
    // A row nothing matched would upsert a title-and-author-only catalog entry,
    // so it starts unticked. Rows already owned can't be added at all.
    startsUnticked: (row) => row.candidates.length === 0 || row.alreadyInLibraryId !== undefined,
    onAdded,
  });

  const excludeRef = useRef(excludeBookIds);
  const completeRef = useRef(onResolveComplete);
  const resetSelectionRef = useRef(review.resetSelection);
  useEffect(() => {
    excludeRef.current = excludeBookIds;
    completeRef.current = onResolveComplete;
    resetSelectionRef.current = review.resetSelection;
  });

  const runIdRef = useRef(0);

  function start(file: File) {
    const runId = ++runIdRef.current;
    setFileName(file.name);
    setRows([]);
    setChosenByKey({});
    resetSelectionRef.current([]);
    setError(null);
    setWarning(null);
    setProgress(null);
    setPhase('processing');

    void run(runId, file);
  }

  async function run(runId: number, file: File) {
    try {
      const { rows: parsed, error: parseError, warning: parseWarning } = parseCsv(await file.text());
      if (parseError) {
        if (runId === runIdRef.current) {
          setError(parseError);
          setPhase('error');
        }
        return;
      }
      if (parsed.length > MAX_CSV_ROWS) {
        if (runId === runIdRef.current) {
          setError(`That file has ${parsed.length} books — please import at most ${MAX_CSV_ROWS} at a time.`);
          setPhase('error');
        }
        return;
      }

      // The endpoint caps each request, so a larger file goes in several. Serial
      // rather than parallel: each request already fans out to many provider
      // calls server-side, and the endpoint is rate limited per minute.
      const resolved: RawResolvedRow[] = [];
      setProgress({ done: 0, total: parsed.length });
      for (let i = 0; i < parsed.length; i += MAX_ROWS_PER_REQUEST) {
        const batch = parsed.slice(i, i + MAX_ROWS_PER_REQUEST);
        const response = await resolveImportRows(batch);
        resolved.push(...response.rows);
        if (runId !== runIdRef.current) return;
        // A thousand rows is 25 requests against providers; without this the
        // reader watches a bare spinner for minutes with no sign of life.
        setProgress({ done: resolved.length, total: parsed.length });
      }

      const matchedIds = resolved
        .map((r) => r.matchedBookId)
        .filter((id): id is number => id !== undefined);
      const catalogById = new Map<number, BookSummary>();
      if (matchedIds.length > 0) {
        const res = await getBooksByIds(matchedIds);
        for (const book of normalizeBooksByIds(res)) catalogById.set(book.id, book);
      }

      if (runId !== runIdRef.current) return;

      const owned = new Set(excludeRef.current);
      const next: CsvRow[] = resolved.map((raw, index) => {
        const catalogBook =
          raw.matchedBookId !== undefined ? catalogById.get(raw.matchedBookId) : undefined;
        const candidates = toCandidates(raw);
        // A catalog match is the best candidate there is — put it first.
        if (catalogBook) {
          candidates.unshift({
            id: `book:${catalogBook.id}`,
            label: labelFor(catalogBook, raw.publisher),
            book: catalogBook,
            raw: {} as never,
          });
        }
        return {
          // Keyed by line, not content: two identical rows must stay independent.
          key: `csv:${index}`,
          hint: {
            title: raw.title,
            author: raw.author,
            publisher: raw.publisher,
            isbn: raw.isbn,
          },
          candidates,
          ...(raw.matchedBookId !== undefined && owned.has(raw.matchedBookId)
            ? { alreadyInLibraryId: raw.matchedBookId }
            : {}),
        };
      });

      setRows(next);
      resetSelectionRef.current(next);
      setWarning(parseWarning);
      setProgress(null);
      setPhase('results');
      completeRef.current?.(next.filter((r) => r.alreadyInLibraryId === undefined).length);
    } catch (e) {
      console.error('[csv-import] failed', e);
      if (runId !== runIdRef.current) return;
      setError(messageFor(e));
      setPhase('error');
    }
  }

  function reset() {
    runIdRef.current++;
    setRows([]);
    setChosenByKey({});
    resetSelectionRef.current([]);
    setError(null);
    setWarning(null);
    setProgress(null);
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
    progress,
    selectedCandidateId: (key) => {
      const row = rows.find((r) => r.key === key);
      return chosenByKey[key] ?? row?.candidates[0]?.id;
    },
    selectCandidate: (key, candidateId) =>
      setChosenByKey((current) => ({ ...current, [key]: candidateId })),
    bookFor,
    start,
    reset,
  };
}
