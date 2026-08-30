import { zipSync, strToU8 } from 'fflate';
import { toCsv } from '../../../shared/lib/to-csv';
import type { LibraryExport, ExportedBook } from '../../../api/library/export-library';

/**
 * The importer's columns, in the importer's order.
 *
 * parse-csv matches by header name rather than position, so the order is for
 * whoever opens the file in a spreadsheet. The names are not: these are the
 * exact words the importer looks for, and renaming one here breaks the round
 * trip silently (LOS-347).
 */
const BOOK_COLUMNS = ['title', 'author', 'publisher', 'isbn', 'status', 'format'] as const;

function booksCsv(books: ExportedBook[]): string {
  return toCsv(BOOK_COLUMNS, books);
}

/**
 * A reader's library as a zip of CSVs the importer can read back.
 *
 * Four files, not three. `favorite-readers.csv` has no importer counterpart --
 * nothing reads a follow list back in -- but an export is a backup, and a
 * backup that silently dropped something a reader has is not one. It costs a
 * few bytes and a spreadsheet opens it.
 *
 * `zipSync`, not the async form: this runs on a library already held whole in
 * memory, having just arrived as one JSON response, so there is nothing to
 * stream and a worker would cost more than it saved.
 */
export function buildExportZip(data: LibraryExport): Blob {
  const files: Record<string, Uint8Array> = {
    'library.csv': strToU8(booksCsv(data.books)),
    'favorite-books.csv': strToU8(booksCsv(data.favorites.books)),
    'favorite-authors.csv': strToU8(toCsv(['name', 'slug'], data.favorites.authors)),
    'favorite-readers.csv': strToU8(toCsv(['handle', 'displayName'], data.favorites.users)),
  };

  // Deflated at the default level. zipSync carries the deflate code whether it
  // is used or not, so storing these would cost the same to ship and hand the
  // reader a bigger file -- and CSV of repeated author names compresses well.
  return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' });
}
