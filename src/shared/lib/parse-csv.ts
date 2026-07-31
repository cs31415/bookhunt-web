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
}

export interface ParsedCsv {
  rows: CsvBookRow[];
  /** Set when the file can't be used at all; rows is then empty. */
  error: string | null;
  /** Set when some rows were skipped but the rest are usable. */
  warning: string | null;
}

/** Header spellings accepted for each column, compared case- and space-insensitively. */
const COLUMN_ALIASES: Record<keyof CsvBookRow, string[]> = {
  title: ['title', 'book', 'booktitle', 'name'],
  author: ['author', 'authors', 'authorname', 'by'],
  publisher: ['publisher', 'publishers', 'imprint'],
  // isbn13 first: when a file carries both, the 13-digit form is unambiguous.
  isbn: ['isbn13', 'isbn', 'isbn10', 'ean'],
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
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

  const headers = rows[0].map(normalizeHeader);

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
      error: 'That file needs a "title" column. Expected headers: title, author, publisher.',
      warning: null,
    };
  }

  const authorIndex = indexOf('author');
  const publisherIndex = indexOf('publisher');
  const isbnIndex = indexOf('isbn');

  const parsed: CsvBookRow[] = [];
  const raggedLines: number[] = [];

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
    parsed.push({
      title,
      author: authorIndex === -1 ? null : blankToNull(cells[authorIndex]),
      publisher: publisherIndex === -1 ? null : blankToNull(cells[publisherIndex]),
      isbn: isbnIndex === -1 ? null : blankToNull(cells[isbnIndex]),
    });
  });

  const warning =
    raggedLines.length > 0
      ? `Skipped ${raggedLines.length} ${raggedLines.length === 1 ? 'row' : 'rows'} with more columns than the header (${raggedLines.slice(0, 5).join(', ')}${raggedLines.length > 5 ? '…' : ''}). Wrap values containing commas in "quotes".`
      : null;

  if (parsed.length === 0) {
    return {
      rows: [],
      error:
        warning ?? 'No books found — every row was missing a title.',
      warning: null,
    };
  }

  return { rows: parsed, error: null, warning };
}
