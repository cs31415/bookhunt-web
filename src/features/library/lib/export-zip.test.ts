import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildExportZip } from './export-zip';
import { parseCsv } from '../../../shared/lib/parse-csv';
import type { LibraryExport, ExportedBook } from '../../../api/library/export-library';

function book(overrides: Partial<ExportedBook> = {}): ExportedBook {
  return {
    title: 'Dune',
    author: 'Frank Herbert',
    publisher: 'Ace',
    isbn: '9780441013593',
    status: 'finished',
    format: 'physical',
    ...overrides,
  };
}

function exportOf(overrides: Partial<LibraryExport> = {}): LibraryExport {
  return {
    exportedAt: '2026-08-30T00:00:00Z',
    books: [book()],
    favorites: { books: [], authors: [], users: [] },
    ...overrides,
  };
}

/** The zip's files, as text, which is what a reader would open. */
async function filesIn(blob: Blob): Promise<Record<string, string>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const unzipped = unzipSync(bytes);
  return Object.fromEntries(
    Object.entries(unzipped).map(([name, content]) => [name, strFromU8(content)]),
  );
}

describe('buildExportZip', () => {
  it('writes the four files', async () => {
    const files = await filesIn(buildExportZip(exportOf()));

    expect(Object.keys(files).sort()).toEqual([
      'favorite-authors.csv',
      'favorite-books.csv',
      'favorite-readers.csv',
      'library.csv',
    ]);
  });

  // The importer matches columns by name, so these words are the contract. A
  // rename here breaks the round trip without breaking anything visible.
  it('heads library.csv with exactly the importer’s columns', async () => {
    const files = await filesIn(buildExportZip(exportOf()));

    expect(files['library.csv'].split('\r\n')[0]).toBe(
      'title,author,publisher,isbn,status,format',
    );
  });

  it('keeps favourites in their own file, in the same shape', async () => {
    const files = await filesIn(
      buildExportZip(
        exportOf({
          books: [book(), book({ title: 'Solaris' })],
          favorites: { books: [book({ title: 'Solaris' })], authors: [], users: [] },
        }),
      ),
    );

    expect(files['favorite-books.csv'].split('\r\n')[0]).toBe(
      'title,author,publisher,isbn,status,format',
    );
    expect(files['favorite-books.csv']).toContain('Solaris');
    expect(files['favorite-books.csv']).not.toContain('Dune');
  });

  it('carries the favourite authors and readers', async () => {
    const files = await filesIn(
      buildExportZip(
        exportOf({
          favorites: {
            books: [],
            authors: [{ name: 'Ursula Le Guin', slug: 'ursula-le-guin' }],
            users: [{ handle: 'ada', displayName: 'Ada Reader' }],
          },
        }),
      ),
    );

    expect(files['favorite-authors.csv']).toContain('Ursula Le Guin,ursula-le-guin');
    expect(files['favorite-readers.csv']).toContain('ada,Ada Reader');
  });

  /*
   * The acceptance test the ticket names: export a library, read library.csv
   * back with the importer's own parser, and get the same shelf -- same
   * statuses, same formats.
   */
  describe('round trip', () => {
    const shelf = [
      book({ title: 'Dune', status: 'finished', format: 'physical' }),
      book({ title: 'Solaris', status: 'reading', format: 'ebook' }),
      book({ title: 'Ubik', status: 'queued', format: 'audiobook' }),
      book({ title: 'Blindsight', status: 'abandoned', format: 'physical' }),
    ];

    it('comes back as the same shelf', async () => {
      const files = await filesIn(buildExportZip(exportOf({ books: shelf })));
      const parsed = parseCsv(files['library.csv']);

      expect(parsed.error).toBeNull();
      expect(parsed.warning).toBeNull();
      expect(parsed.rows.map((row) => [row.title, row.status, row.format])).toEqual([
        ['Dune', 'finished', 'physical'],
        ['Solaris', 'reading', 'ebook'],
        ['Ubik', 'queued', 'audiobook'],
        ['Blindsight', 'abandoned', 'physical'],
      ]);
    });

    it('keeps the author, publisher and isbn on the way through', async () => {
      const files = await filesIn(buildExportZip(exportOf({ books: [book()] })));
      const [row] = parseCsv(files['library.csv']).rows;

      expect(row.author).toBe('Frank Herbert');
      expect(row.publisher).toBe('Ace');
      expect(row.isbn).toBe('9780441013593');
    });

    // The case a naive writer breaks on, and the one most likely to appear in a
    // real library: a title with a comma in it.
    it('survives commas, quotes and newlines in a title', async () => {
      const awkward = [
        book({ title: 'Girl, Interrupted' }),
        book({ title: 'The "Good" Soldier' }),
        book({ title: 'One\nTwo' }),
        book({ title: '  Padded  ', author: 'A, B' }),
      ];
      const files = await filesIn(buildExportZip(exportOf({ books: awkward })));
      const parsed = parseCsv(files['library.csv']);

      expect(parsed.error).toBeNull();
      expect(parsed.rows.map((row) => row.title)).toEqual([
        'Girl, Interrupted',
        'The "Good" Soldier',
        'One\nTwo',
        // The parser trims, which is why the writer quotes a padded value: the
        // quotes survive the trip even though the padding does not.
        'Padded',
      ]);
      expect(parsed.rows[3].author).toBe('A, B');
    });

    it('writes an empty cell for a missing publisher or isbn', async () => {
      const files = await filesIn(
        buildExportZip(exportOf({ books: [book({ publisher: null, isbn: null })] })),
      );
      const [row] = parseCsv(files['library.csv']).rows;

      expect(row.publisher).toBeNull();
      expect(row.isbn).toBeNull();
    });

    it('writes a header and nothing else for an empty library', async () => {
      const files = await filesIn(buildExportZip(exportOf({ books: [] })));

      expect(files['library.csv']).toBe('title,author,publisher,isbn,status,format');
      expect(parseCsv(files['library.csv']).rows).toEqual([]);
    });
  });
});
