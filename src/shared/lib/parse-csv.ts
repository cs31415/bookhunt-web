/**
 * Minimal RFC 4180 CSV reader.
 *
 * Hand-rolled rather than pulled in: the app's only runtime dependencies are
 * react, react-dom and react-router-dom, and one import screen doesn't justify
 * being the first exception.
 *
 * Takes a string, not a File, so the parser is testable without touching
 * FileReader and only the caller deals with I/O.
 */

import { ALL_LIBRARY_STATUSES, LIBRARY_STATUS_LABELS } from '../types/library-status';
import type { LibraryStatus } from '../types/library-status';

/** Splits CSV text into rows of raw cells, honouring quotes. */
export function parseCsvRows(text: string): string[][] {
  // Strip a UTF-8 BOM: Excel writes one, and it would otherwise become part of
  // the first header name and break column matching.
  const input = text.replace(/^\uFEFF/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (input[i + 1] === '"') {
        // "" is an escaped quote inside a quoted field.
        cell += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      // Treat CRLF as one break rather than an extra empty row.
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  // A trailing newline leaves nothing pending; anything else is a final row.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface CsvBookRow {
  title: string;
  author: string | null;
  publisher: string | null;
  /**
   * Passed through as written; the API normalises and validates it. An ISBN
   * pins an exact edition, so it outranks every other column when present —
   * which is why Goodreads and StoryGraph exports resolve so much better.
   */
  isbn: string | null;
  /**
   * The shelf this book starts on, or null when the column is absent, blank or
   * unreadable — the review list then defaults it to New, as it always has.
   */
  status: LibraryStatus | null;
}

export interface ParsedCsv {
  rows: CsvBookRow[];
  /** Set when the file can't be used at all; rows is then empty. */
  error: string | null;
  /**
   * Set when the file was read but not everything in it was — a skipped row, a
   * status we couldn't place. The rest is still usable, so this shows alongside
   * the review list rather than instead of it.
   */
  warning: string | null;
}

/** Header spellings accepted for each column, compared case- and space-insensitively. */
const COLUMN_ALIASES: Record<keyof CsvBookRow, string[]> = {
  title: ['title', 'book', 'booktitle', 'name'],
  author: ['author', 'authors', 'authorname', 'by'],
  publisher: ['publisher', 'publishers', 'imprint'],
  // isbn13 first: when a file carries both, the 13-digit form is unambiguous.
  isbn: ['isbn13', 'isbn', 'isbn10', 'ean'],
  status: ['status', 'shelf'],
};

/** Folds case and punctuation, so "Book Title" and "book_title" are one key. */
function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The status words a file may use, derived from the labels the app itself
 * displays rather than listed here — a reader copies what they see on the
 * shelf, and a hand-written vocabulary would drift the first time a label
 * changed. So "New" means queued, not some fifth state.
 *
 * Deliberately narrow: another service's spelling of these ("read",
 * "currently-reading", "did-not-finish") is not accepted, and lands in the
 * warning below rather than being guessed at.
 */
const STATUS_BY_LABEL = new Map<string, LibraryStatus>(
  ALL_LIBRARY_STATUSES.map((status) => [normalizeToken(LIBRARY_STATUS_LABELS[status]), status]),
);

/** "New, Reading, Finished or Abandoned" — for telling a reader what we take. */
const ACCEPTED_STATUS_LABELS = (() => {
  const labels = ALL_LIBRARY_STATUSES.map((status) => LIBRARY_STATUS_LABELS[status]);
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
})();

/** Line numbers for a warning, capped so one bad file can't fill the message. */
function lineList(lines: number[]): string {
  return `${lines.slice(0, 5).join(', ')}${lines.length > 5 ? '…' : ''}`;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Reads a CSV of books. Requires a header row so columns can appear in any
 * order — a positional format would silently mis-read a file whose columns are
 * ordered differently, which is worse than refusing it.
 */
export function parseCsv(text: string): ParsedCsv {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { rows: [], error: 'That file is empty.', warning: null };

  const headers = rows[0].map(normalizeToken);

  // Scans aliases in order rather than headers, so alias order is priority
  // order: a Goodreads export has both "ISBN" and "ISBN13" columns, and the
  // 13-digit one is the unambiguous choice regardless of which comes first.
  const indexOf = (column: keyof CsvBookRow): number => {
    for (const alias of COLUMN_ALIASES[column]) {
      const index = headers.indexOf(alias);
      if (index !== -1) return index;
    }
    return -1;
  };

  const titleIndex = indexOf('title');
  if (titleIndex === -1) {
    return {
      rows: [],
      error:
        'That file needs a "title" column. Expected headers: title, author, publisher, isbn, status.',
      warning: null,
    };
  }

  const authorIndex = indexOf('author');
  const publisherIndex = indexOf('publisher');
  const isbnIndex = indexOf('isbn');
  const statusIndex = indexOf('status');

  const parsed: CsvBookRow[] = [];
  const raggedLines: number[] = [];
  const unreadableStatusLines: number[] = [];

  rows.slice(1).forEach((cells, i) => {
    // More cells than headers almost always means an unquoted comma inside a
    // value. Reading it positionally anyway would shift every later column —
    // "Hong Kong, Macau,,Frommer's" would file Macau as the author and drop the
    // publisher entirely. Wrong data is worse than a skipped row, so skip and say so.
    if (cells.length > headers.length) {
      raggedLines.push(i + 2); // +2: 1-based, and the header is line 1.
      return;
    }
    const title = blankToNull(cells[titleIndex]) ?? '';
    if (title === '') return;

    // A status we can't read is worth saying out loud. Silently shelving such a
    // book as New would look like the column had been ignored altogether, and
    // the reader has no way to tell one from the other.
    const rawStatus = statusIndex === -1 ? null : blankToNull(cells[statusIndex]);
    const status =
      rawStatus === null ? null : (STATUS_BY_LABEL.get(normalizeToken(rawStatus)) ?? null);
    if (rawStatus !== null && status === null) unreadableStatusLines.push(i + 2);

    parsed.push({
      title,
      author: authorIndex === -1 ? null : blankToNull(cells[authorIndex]),
      publisher: publisherIndex === -1 ? null : blankToNull(cells[publisherIndex]),
      isbn: isbnIndex === -1 ? null : blankToNull(cells[isbnIndex]),
      status,
    });
  });

  // Collected rather than assigned, so a file with both kinds of problem
  // reports both instead of the first one silencing the second.
  const warnings: string[] = [];
  if (raggedLines.length > 0) {
    warnings.push(
      `Skipped ${raggedLines.length} ${raggedLines.length === 1 ? 'row' : 'rows'} with more columns than the header (${lineList(raggedLines)}). Wrap values containing commas in "quotes".`,
    );
  }
  if (unreadableStatusLines.length > 0) {
    warnings.push(
      `Didn't recognise the status on ${unreadableStatusLines.length} ${unreadableStatusLines.length === 1 ? 'row' : 'rows'} (${lineList(unreadableStatusLines)}) — those came in as ${LIBRARY_STATUS_LABELS.queued}. Use ${ACCEPTED_STATUS_LABELS}.`,
    );
  }
  const warning = warnings.length > 0 ? warnings.join(' ') : null;

  if (parsed.length === 0) {
    return {
      rows: [],
      error: warning ?? 'No books found — every row was missing a title.',
      warning: null,
    };
  }

  return { rows: parsed, error: null, warning };
}
