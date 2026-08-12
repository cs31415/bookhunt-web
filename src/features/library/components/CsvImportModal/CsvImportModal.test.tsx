import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LibraryPage } from '../../LibraryPage';
import { ToastHost } from '../../../../shared/toast/ToastHost';
import { clearToasts } from '../../../../shared/toast/toast-store';
import { getLibrary } from '../../../../api/library/get-library';
import { addToLibrary } from '../../../../api/library/add-to-library';
import { getBooksByIds } from '../../../../api/books/get-books-by-ids';
import { resolveImportRows } from '../../../../api/import/resolve';
import { categorizeBooks } from '../../../../api/ai/categorize';
import { ApiError } from '../../../../api/client';
import type { RawResolvedRow } from '../../../../api/import/resolve';
import type { RawAiSearchBook } from '../../../../normalize/search';
import type { RawLibraryEntry } from '../../../../normalize/library';

vi.mock('../../../../api/library/get-library');
vi.mock('../../../../api/library/add-to-library');
vi.mock('../../../../api/books/get-books-by-ids');
vi.mock('../../../../api/ai/categorize');
vi.mock('../../../../api/import/resolve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../api/import/resolve')>()),
  resolveImportRows: vi.fn(),
}));

const mockedGetLibrary = vi.mocked(getLibrary);
const mockedAddToLibrary = vi.mocked(addToLibrary);
const mockedCategorizeBooks = vi.mocked(categorizeBooks);
const mockedGetBooksByIds = vi.mocked(getBooksByIds);
const mockedResolve = vi.mocked(resolveImportRows);

function makeEntry(overrides: Partial<RawLibraryEntry> = {}): RawLibraryEntry {
  const id = overrides.book_id ?? 1;
  return {
    book_id: id,
    status: 'queued',
    notes: null,
    review: null,
    title: `Book ${id}`,
    book_slug: `book-${id}`,
    author_name: 'Anon',
    author_slug: 'anon',
    year: 2000,
    rating: 4,
    cover_url: null,
    hue: '#6f7a55',
    subjects: [],
    date_added: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<RawAiSearchBook> = {}): RawAiSearchBook {
  return {
    googleBooksId: 'gb-1',
    openLibraryId: null,
    title: 'Dune',
    authors: ['Frank Herbert'],
    year: 1965,
    publisher: 'Ace',
    pages: 412,
    rating: 4.5,
    coverUrl: null,
    isbn13: '9780441013593',
    language: 'en',
    blurb: null,
    categories: [],
    moods: [],
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books',
    ...overrides,
  };
}

function resolved(overrides: Partial<RawResolvedRow> = {}): RawResolvedRow {
  return {
    title: 'Dune',
    author: 'Frank Herbert',
    publisher: null,
    isbn: null,
    candidates: [candidate()],
    ...overrides,
  };
}

/** A catalog match as /import/resolve now returns it, ready to render. */
function catalogBook(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'book-1',
    title: 'Existing',
    authorName: 'Anon',
    authorSlug: 'anon',
    year: 2000,
    rating: 4,
    coverUrl: null,
    hue: '#6f7a55',
    ...overrides,
  };
}

function csvFile(text: string, name = 'books.csv') {
  const file = new File([text], name, { type: 'text/csv' });
  // jsdom's File.text() is available, but pinning it keeps the test independent
  // of the Blob implementation.
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  return file;
}

function renderLibrary() {
  const router = createMemoryRouter(
    [
      {
        path: '/library',
        element: (
          <>
            <LibraryPage />
            <ToastHost />
          </>
        ),
      },
      { path: '/', element: <div /> },
      { path: '/books/:slug', element: <div /> },
    ],
    { initialEntries: ['/library'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function openModal() {
  fireEvent.click(await screen.findByRole('button', { name: 'Import from CSV' }));
  return await screen.findByRole('dialog');
}

function dropFile(dialog: HTMLElement, file: File) {
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const SIMPLE_CSV = 'title,author\nDune,Frank Herbert';

describe('CsvImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearToasts();
    mockedGetLibrary.mockResolvedValue({
      entries: [makeEntry({ book_id: 1, title: 'Existing' })],
      total: 1,
      stats: { total: 1, by_status: { queued: 1 } },
    });
    mockedGetBooksByIds.mockResolvedValue({ books: [] });
    mockedResolve.mockResolvedValue({ rows: [resolved()] });
    mockedAddToLibrary.mockResolvedValue({ entry: {}, book: { id: 9, slug: 'dune' } });
    mockedCategorizeBooks.mockResolvedValue({ categorized: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens from the header and shows the expected format', async () => {
    renderLibrary();
    const dialog = await openModal();

    expect(within(dialog).getByText('Drop a CSV of your books')).toBeInTheDocument();
    expect(within(dialog).getByText(/title,author,publisher,isbn,status/)).toBeInTheDocument();
  });

  // A reader shouldn't have to guess between "Finished" and "Read", or find out
  // which words we take from a warning after the import has already run.
  it('names every status the file may use', async () => {
    renderLibrary();
    const dialog = await openModal();

    const hint = within(dialog).getByText(/status can be one of/);
    expect(hint).toHaveTextContent(
      'status can be one of: New, Reading, Finished, Abandoned. Defaults to New.',
    );
  });

  it('opens from the empty state too', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], total: 0, stats: { total: 0, by_status: {} } });
    renderLibrary();

    await screen.findByText('Your shelves are empty');
    fireEvent.click(screen.getByRole('button', { name: 'Import from CSV' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('rejects a file that is not a .csv without calling the API', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('whatever', 'shelf.jpg'));

    expect(await screen.findByText(/isn’t a .csv file/)).toBeInTheDocument();
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('sends parsed rows to the API and lists the matches', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(SIMPLE_CSV));

    expect(await screen.findByText(/Found matches for/)).toHaveTextContent('Found matches for 1');
    expect(mockedResolve).toHaveBeenCalledWith(
      [{ title: 'Dune', author: 'Frank Herbert', publisher: null, isbn: null }],
      expect.any(AbortSignal),
    );
  });

  it('passes an ISBN through when the file has one', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title,isbn\nDune,978-0-441-01359-3'));

    await screen.findByText(/Found matches for/);
    expect(mockedResolve).toHaveBeenCalledWith(
      [{ title: 'Dune', author: null, publisher: null, isbn: '978-0-441-01359-3' }],
      expect.any(AbortSignal),
    );
  });

  it('surfaces a parse error without calling the API', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('name_of_thing\nDune'));

    expect(await screen.findByText(/needs a "title" column/)).toBeInTheDocument();
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('warns about skipped ragged rows while still importing the rest', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(
      dialog,
      csvFile("title,author,publisher\nHong Kong, Macau,,Frommer's\nDune,Frank Herbert,Ace"),
    );

    expect(await screen.findByText(/Skipped 1 row/)).toBeInTheDocument();
    expect(screen.getByText(/Found matches for/)).toHaveTextContent('Found matches for 1');
  });

  describe('candidate picking', () => {
    beforeEach(() => {
      mockedResolve.mockResolvedValue({
        rows: [
          resolved({
            title: 'Hong Kong',
            author: null,
            publisher: "Frommer's",
            candidates: [
              candidate({
                googleBooksId: 'g1',
                title: "Frommer's Hong Kong",
                publisher: "Frommer's",
              }),
              candidate({ googleBooksId: 'g2', title: 'Hong Kong', publisher: 'Lonely Planet' }),
            ],
          }),
        ],
      });
    });

    it('offers the alternatives in a dropdown, best first', async () => {
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile("title,publisher\nHong Kong,Frommer's"));

      const select = (await screen.findByRole('combobox', {
        name: /Match for/,
      })) as HTMLSelectElement;
      const labels = Array.from(select.options).map((o) => o.textContent);

      expect(labels[0]).toContain("Frommer's Hong Kong");
      expect(labels[1]).toContain('Lonely Planet');
    });

    it('adds the candidate the reader picked, not the default', async () => {
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile("title,publisher\nHong Kong,Frommer's"));

      const select = await screen.findByRole('combobox', { name: /Match for/ });
      fireEvent.change(select, { target: { value: 'g2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add 1 to library' }));

      await waitFor(() =>
        expect(mockedAddToLibrary).toHaveBeenCalledWith(
          'hong-kong',
          'queued',
          expect.objectContaining({ googleBooksId: 'g2' }),
          { enrich: false },
        ),
      );
    });
  });

  it('toasts a success summary once the import finishes', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(SIMPLE_CSV));

    await screen.findByText(/Found matches for/);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to library' }));

    expect(await screen.findByText('Successfully imported 1 book.')).toBeInTheDocument();
  });

  it('toasts a partial summary when some rows fail to add', async () => {
    mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });
    mockedAddToLibrary
      .mockResolvedValueOnce({ entry: {}, book: { id: 9, slug: 'dune' } })
      .mockRejectedValueOnce(new ApiError(500, 'nope'));

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune\nUbik'));

    await screen.findByRole('button', { name: 'Add 2 to library' });
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 to library' }));

    expect(
      await screen.findByText('Imported 1 of 2 books. 1 books had errors.'),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText(/1 of 2 couldn.t be added/)).toBeInTheDocument();

    // The row that landed stops being selected, so the retry covers only what
    // failed. It used to still offer "Add 2 to library" and re-send the one
    // already in (LOS-198).
    expect(
      await within(dialog).findByRole('button', { name: 'Add 1 to library' }),
    ).toBeInTheDocument();
  });

  // One call for the whole import, not one per book: the model can only group
  // books it sees together (LOS-197).
  it('categorizes everything it added in a single call', async () => {
    mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });
    mockedAddToLibrary
      .mockResolvedValueOnce({ entry: {}, book: { id: 9, slug: 'dune' } })
      .mockResolvedValueOnce({ entry: {}, book: { id: 10, slug: 'ubik' } });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune\nUbik'));

    await screen.findByRole('button', { name: 'Add 2 to library' });
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 to library' }));

    await screen.findByText('Successfully imported 2 books.');
    expect(mockedCategorizeBooks).toHaveBeenCalledTimes(1);
    expect(mockedCategorizeBooks).toHaveBeenCalledWith([9, 10]);
  });

  // Tagging is a nicety; the books are already on the shelf.
  it('still reports success when categorizing fails', async () => {
    mockedCategorizeBooks.mockRejectedValue(new ApiError(500, 'llm down'));

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(SIMPLE_CSV));

    await screen.findByText(/Found matches for/);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to library' }));

    expect(await screen.findByText('Successfully imported 1 book.')).toBeInTheDocument();
  });

  // Two identical lines must stay two rows: keying by content would collapse
  // them into one, silently dropping a book the reader listed twice.
  it('keeps identical CSV lines as separate rows', async () => {
    mockedResolve.mockResolvedValue({ rows: [resolved(), resolved()] });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title,author\nDune,Frank Herbert\nDune,Frank Herbert'));

    await screen.findByText(/Found matches for/);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('shows a row with no matches unticked but still addable', async () => {
    mockedResolve.mockResolvedValue({
      rows: [resolved({ title: 'Nonexistent Xyzzy', author: null, candidates: [] })],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nNonexistent Xyzzy'));

    expect(await screen.findByText(/Couldn’t find/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Include Nonexistent Xyzzy/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  // Re-importing an export against a library that already holds most of it is
  // the case this feature exists to serve, so owned rows are the majority and
  // leave the list. The summary keeps them counted, so nothing vanishes
  // unaccounted for.
  it('drops an already-owned book from the list and counts it in the summary', async () => {
    mockedResolve.mockResolvedValue({
      rows: [
        resolved({ title: 'Existing', matchedBookId: 1, matchedBook: catalogBook() }),
        resolved(),
      ],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nExisting\nDune'));

    expect(await screen.findByText(/Found matches for/)).toHaveTextContent(
      'Found matches for 1 book. 1 already in your library.',
    );
    // Scoped to the dialog: the library behind it lists the same book.
    expect(within(dialog).queryByText('Existing')).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1);
  });

  // The button adds ticked rows only, and a row nothing matched starts unticked.
  // Counting those as matches made the summary claim more books than the button
  // was going to add — 61 versus 10 on a real import.
  it('counts unmatched rows separately so the summary agrees with the button', async () => {
    mockedResolve.mockResolvedValue({
      rows: [
        resolved(),
        resolved({ title: 'Nonexistent Xyzzy', author: null, candidates: [] }),
        resolved({ title: 'Nonexistent Plugh', author: null, candidates: [] }),
      ],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune\nNonexistent Xyzzy\nNonexistent Plugh'));

    expect(await screen.findByText(/Found matches for/)).toHaveTextContent(
      'Found matches for 1 book. 2 we couldn’t find.',
    );
    expect(screen.getByRole('button', { name: 'Add 1 to library' })).toBeInTheDocument();
    // Unmatched rows stay listed: ticking one adds what the file said as-is.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('says so plainly when nothing in the file could be matched', async () => {
    mockedResolve.mockResolvedValue({
      rows: [resolved({ title: 'Nonexistent Xyzzy', author: null, candidates: [] })],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nNonexistent Xyzzy'));

    expect(await screen.findByText(/No matches found/)).toHaveTextContent(
      'No matches found. 1 we couldn’t find.',
    );
  });

  it('says all books are already in the library when every row matches one already owned', async () => {
    mockedResolve.mockResolvedValue({
      rows: [
        resolved({ title: 'Existing', matchedBookId: 1, matchedBook: catalogBook() }),
        resolved({
          title: 'Existing 2',
          matchedBookId: 2,
          matchedBook: catalogBook({ id: 2, slug: 'book-2', title: 'Existing 2' }),
        }),
      ],
    });
    mockedGetLibrary.mockResolvedValue({
      entries: [makeEntry({ book_id: 1 }), makeEntry({ book_id: 2 })],
      total: 2,
      stats: { total: 2, by_status: { queued: 2 } },
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nExisting\nExisting 2'));

    expect(
      await within(dialog).findByText('All these books are already in your library.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Found matches for/)).not.toBeInTheDocument();
  });

  // The resolve response carries the matched book, so the batch no longer
  // follows itself with GET /books asking for what it already had — one round
  // trip per batch, ~30 on a 372-row import (LOS-179).
  it('renders a catalog match from the resolve response alone', async () => {
    mockedResolve.mockResolvedValue({
      rows: [
        resolved({
          title: 'Dune',
          matchedBookId: 9,
          matchedBook: catalogBook({
            id: 9,
            slug: 'dune',
            title: 'Dune',
            authorName: 'Frank Herbert',
            rating: '4.5',
          }),
        }),
      ],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune'));

    await screen.findByText(/Found matches for/);
    // The catalog match leads the candidate list, so it is what the row shows.
    expect(within(dialog).getByText('Frank Herbert')).toBeInTheDocument();
    expect(mockedGetBooksByIds).not.toHaveBeenCalled();
  });

  // The batch size is configurable (LOS-180); what matters here is that the hook
  // actually splits the file by it rather than sending everything at once.
  it('splits a file into batches of the configured size', async () => {
    vi.stubEnv('VITE_IMPORT_ROWS_PER_REQUEST', '20');
    mockedResolve.mockResolvedValue({ rows: [] });
    const titles = Array.from({ length: 25 }, (_, i) => `Book ${i + 1}`).join('\n');

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(`title\n${titles}`));

    await waitFor(() => expect(mockedResolve).toHaveBeenCalledTimes(2));
    expect(mockedResolve.mock.calls[0][0]).toHaveLength(20);
    expect(mockedResolve.mock.calls[1][0]).toHaveLength(5);
  });

  it('cycles a status and drops the count when a row is unticked', async () => {
    mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune\nUbik'));

    await screen.findByRole('button', { name: 'Add 2 to library' });
    fireEvent.click(screen.getAllByRole('button', { name: 'New' })[0]);
    expect(screen.getByRole('button', { name: 'Reading' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: 'Add 1 to library' })).toBeInTheDocument();
  });

  describe('a status column', () => {
    it('shelves each row where the file said, and adds it there', async () => {
      mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });
      mockedAddToLibrary.mockResolvedValue({ entry: {}, book: { id: 9, slug: 'dune' } });

      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,status\nDune,Finished\nUbik,Abandoned'));

      await screen.findByRole('button', { name: 'Add 2 to library' });
      expect(screen.getByRole('button', { name: 'Finished' })).toBeInTheDocument();
      // Abandoned isn't in the cycle, but a file may still ask for it.
      expect(screen.getByRole('button', { name: 'Abandoned' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add 2 to library' }));

      await waitFor(() => expect(mockedAddToLibrary).toHaveBeenCalledTimes(2));
      expect(mockedAddToLibrary.mock.calls.map((call) => call[1])).toEqual([
        'finished',
        'abandoned',
      ]);
    });

    // The lookup identifies a book; where it goes on the shelf is ours to apply.
    it('does not send the status to the resolve endpoint', async () => {
      mockedResolve.mockResolvedValue({ rows: [resolved()] });

      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,status\nDune,Finished'));

      await waitFor(() => expect(mockedResolve).toHaveBeenCalled());
      expect(mockedResolve.mock.calls[0][0]).toEqual([
        { title: 'Dune', author: null, publisher: null, isbn: null },
      ]);
    });

    // Cycling must walk on from what the file said, not restart from New.
    it('cycles on from the status the file gave', async () => {
      mockedResolve.mockResolvedValue({ rows: [resolved()] });

      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,status\nDune,Reading'));

      fireEvent.click(await screen.findByRole('button', { name: 'Reading' }));
      expect(screen.getByRole('button', { name: 'Finished' })).toBeInTheDocument();
    });

    it('warns about a status it could not read', async () => {
      mockedResolve.mockResolvedValue({ rows: [resolved()] });

      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,status\nDune,currently-reading'));

      expect(await screen.findByText(/Didn.t recognise the status/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    });
  });

  it('stays open and reports the count when only some books are added', async () => {
    mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });
    mockedAddToLibrary
      .mockResolvedValueOnce({ entry: {}, book: { id: 9, slug: 'dune' } })
      .mockRejectedValueOnce(new ApiError(500, 'nope'));

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune\nUbik'));

    fireEvent.click(await screen.findByRole('button', { name: 'Add 2 to library' }));

    // addError now carries only the failure; the summary reports what landed.
    expect(await screen.findByText(/1 of 2 couldn.t be added/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes and refreshes the library when everything is added', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(SIMPLE_CSV));

    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 to library' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(mockedGetLibrary).toHaveBeenCalledTimes(2));
  });

  it('shows the rate-limit message distinctly from a generic failure', async () => {
    mockedResolve.mockRejectedValue(new ApiError(429, 'slow down'));

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(SIMPLE_CSV));

    expect(await screen.findByText(/Too many imports right now/)).toBeInTheDocument();
  });

  describe('progressive display', () => {
    function pendingResolve() {
      let settle: (v: { rows: RawResolvedRow[] }) => void = () => {};
      mockedResolve.mockReturnValue(new Promise((r) => (settle = r)));
      return (rows: RawResolvedRow[]) => settle({ rows });
    }

    // The whole file appears at once so the reader can confirm it was read
    // correctly, rather than watching a spinner with nothing to look at.
    it('lists every row from the file before any lookup returns', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune\nUbik\nSolaris'));

      // One pending row per CSV line, before any lookup has come back.
      expect(await screen.findAllByText('Looking up…')).toHaveLength(3);
      for (const title of ['Dune', 'Ubik', 'Solaris']) {
        expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      }
    });

    it('marks rows as still being looked up, and not yet addable', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune'));

      expect(await screen.findAllByText('Looking up…')).toHaveLength(1);
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('reports how far along the lookup is', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune\nUbik'));

      expect(await screen.findByText(/Looking up 0 of 2 books/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2');
    });

    it('fills a row in once its batch returns', async () => {
      const settle = pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune'));

      await screen.findAllByText('Looking up…');
      settle([resolved()]);

      expect(await screen.findByRole('checkbox', { name: /Skip Dune/ })).toBeInTheDocument();
      expect(screen.queryByText('Looking up…')).not.toBeInTheDocument();
    });

    it('holds the add button until every row is looked up', async () => {
      const settle = pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune'));

      await screen.findAllByText('Looking up…');
      expect(screen.getByRole('button', { name: /Add .* to library/ })).toBeDisabled();

      settle([resolved()]);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add 1 to library' })).toBeEnabled(),
      );
    });
  });

  // A CSV import is many requests over minutes, so dismissing it means stop --
  // unlike a single short request worth finishing in the
  // background and offering back in a toast.
  describe('cancelling', () => {
    function pendingResolve() {
      let settle: (v: { rows: RawResolvedRow[] }) => void = () => {};
      mockedResolve.mockReturnValue(new Promise((r) => (settle = r)));
      return () => settle({ rows: [resolved()] });
    }

    it('asks before discarding, and does not abort yet', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByRole('button', { name: 'Cancel import' });
      const signal = mockedResolve.mock.calls[0][1] as AbortSignal;

      fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));

      expect(await screen.findByText('Discard this import?')).toBeInTheDocument();
      expect(signal.aborted).toBe(false);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('carries on when the prompt is declined', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByRole('button', { name: 'Cancel import' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Keep importing' }));

      expect((mockedResolve.mock.calls[0][1] as AbortSignal).aborted).toBe(false);
      expect(screen.getByText(/Looking up \d+ of/)).toBeInTheDocument();
    });

    it('aborts the request once the prompt is confirmed', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByRole('button', { name: 'Cancel import' });
      const signal = mockedResolve.mock.calls[0][1] as AbortSignal;

      fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Discard import' }));

      expect(signal.aborted).toBe(true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Escape and the backdrop route through the same handler, so they prompt too.
    it('prompts rather than closing when dismissed with the close button', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByText(/Looking up \d+ of/);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

      expect(await screen.findByText('Discard this import?')).toBeInTheDocument();
      expect((mockedResolve.mock.calls[0][1] as AbortSignal).aborted).toBe(false);
    });

    it('says how much work discarding would lose', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByRole('button', { name: 'Cancel import' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));

      expect(await screen.findByText(/have been looked up/)).toBeInTheDocument();
    });

    it('returns to the upload phase when reopened after discarding', async () => {
      pendingResolve();
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByRole('button', { name: 'Cancel import' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel import' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Discard import' }));

      const reopened = await openModal();
      expect(within(reopened).getByText('Drop a CSV of your books')).toBeInTheDocument();
    });
  });

  // Adding 336 books used to say "Adding…" and nothing else for minutes (LOS-202).
  describe('progress and aftermath', () => {
    it('counts the books as they are written', async () => {
      let release: (v: { entry: object; book: { id: number; slug: string } }) => void = () => {};
      mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });
      mockedAddToLibrary
        .mockResolvedValueOnce({ entry: {}, book: { id: 9, slug: 'dune' } })
        .mockReturnValueOnce(new Promise((r) => (release = r)));

      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune\nUbik'));

      await screen.findByRole('button', { name: 'Add 2 to library' });
      fireEvent.click(screen.getByRole('button', { name: 'Add 2 to library' }));

      expect(await within(dialog).findByText('Adding 1 of 2 books…')).toBeInTheDocument();
      release({ entry: {}, book: { id: 10, slug: 'ubik' } });
    });

    it('drops added books from the list and says how many landed', async () => {
      // Each row needs its own candidate: the row title is only a hint, and the
      // list renders the candidate, so a shared one shows the same book twice.
      mockedResolve.mockResolvedValue({
        rows: [
          resolved(),
          resolved({
            title: 'Ubik',
            candidates: [candidate({ title: 'Ubik', googleBooksId: 'gb-2' })],
          }),
        ],
      });
      mockedAddToLibrary
        .mockResolvedValueOnce({ entry: {}, book: { id: 9, slug: 'dune' } })
        .mockRejectedValueOnce(new ApiError(500, 'nope'));

      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title\nDune\nUbik'));

      await screen.findByRole('button', { name: 'Add 2 to library' });
      fireEvent.click(screen.getByRole('button', { name: 'Add 2 to library' }));

      // The summary reports the add, not the lookup it has moved on from.
      expect(await within(dialog).findByText(/^Added/)).toHaveTextContent(
        'Added 1 book to your library.',
      );
      expect(within(dialog).queryByText(/Found matches for/)).not.toBeInTheDocument();

      // The one that landed is gone from the list; the failure remains to retry.
      // AllBy because a placeholder cover repeats the title as SVG text.
      expect(within(dialog).queryAllByText('Dune')).toHaveLength(0);
      expect(within(dialog).getAllByText('Ubik').length).toBeGreaterThan(0);
      expect(within(dialog).getByRole('button', { name: 'Add 1 to library' })).toBeInTheDocument();
    });
  });

  /**
   * The row that put Cyclops by Clive Cussler into a library that had asked for
   * "From So Simple a Beginning" by Clive Gamble. The server marked it
   * tentative; the client ignored the flag, preselected it, and added it
   * silently (LOS-205).
   */
  describe('tentative rows', () => {
    const cyclops = () =>
      resolved({
        title: 'From So Simple a Beginning',
        author: 'Clive Gamble',
        tentative: true,
        candidates: [
          candidate({ title: 'Cyclops', authors: ['Clive Cussler'], googleBooksId: 'r-sli' }),
        ],
      });

    it('does not tick a row nothing matched the title of', async () => {
      mockedResolve.mockResolvedValue({ rows: [cyclops()] });
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,author\nFrom So Simple a Beginning,Clive Gamble'));

      await within(dialog).findByText(/Nothing matched/);
      // Nothing selected means nothing to add, so the button has nothing to offer.
      expect(within(dialog).getByRole('button', { name: /^Add 0 to library/ })).toBeDisabled();
    });

    it('says why, rather than leaving the row mysteriously unticked', async () => {
      mockedResolve.mockResolvedValue({ rows: [cyclops()] });
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,author\nFrom So Simple a Beginning,Clive Gamble'));

      expect(await within(dialog).findByText(/Nothing matched/)).toHaveTextContent(
        'From So Simple a Beginning',
      );
    });

    it('still lets the reader tick it themselves', async () => {
      mockedResolve.mockResolvedValue({ rows: [cyclops()] });
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile('title,author\nFrom So Simple a Beginning,Clive Gamble'));

      await within(dialog).findByText(/Nothing matched/);
      fireEvent.click(within(dialog).getAllByRole('checkbox')[0]);

      expect(within(dialog).getByRole('button', { name: /^Add 1 to library/ })).toBeEnabled();
    });

    it('leaves an ordinary match ticked', async () => {
      mockedResolve.mockResolvedValue({ rows: [resolved()] });
      renderLibrary();
      const dialog = await openModal();
      dropFile(dialog, csvFile(SIMPLE_CSV));

      await screen.findByText(/Found matches for/);
      expect(within(dialog).queryByText(/Nothing matched/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add 1 to library' })).toBeEnabled();
    });
  });
});
