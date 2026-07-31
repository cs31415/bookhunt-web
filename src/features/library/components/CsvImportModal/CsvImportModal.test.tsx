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
import { ApiError } from '../../../../api/client';
import type { RawResolvedRow } from '../../../../api/import/resolve';
import type { RawAiSearchBook } from '../../../../normalize/search';
import type { RawLibraryEntry } from '../../../../normalize/library';

vi.mock('../../../../api/library/get-library');
vi.mock('../../../../api/library/add-to-library');
vi.mock('../../../../api/books/get-books-by-ids');
vi.mock('../../../../api/import/resolve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../api/import/resolve')>()),
  resolveImportRows: vi.fn(),
}));

const mockedGetLibrary = vi.mocked(getLibrary);
const mockedAddToLibrary = vi.mocked(addToLibrary);
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
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', 'false');
    mockedGetLibrary.mockResolvedValue({
      entries: [makeEntry({ book_id: 1, title: 'Existing' })],
      stats: { total: 1, by_status: { queued: 1 } },
    });
    mockedGetBooksByIds.mockResolvedValue({ books: [] });
    mockedResolve.mockResolvedValue({ rows: [resolved()] });
    mockedAddToLibrary.mockResolvedValue({ entry: {}, book: { id: 9, slug: 'dune' } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens from the header and shows the expected format', async () => {
    renderLibrary();
    const dialog = await openModal();

    expect(within(dialog).getByText('Drop a CSV of your books')).toBeInTheDocument();
    expect(within(dialog).getByText(/title,author,publisher,isbn/)).toBeInTheDocument();
  });

  it('opens from the empty state too', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
    renderLibrary();

    await screen.findByText('Your shelves are empty');
    fireEvent.click(screen.getByRole('button', { name: 'Import from CSV' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('is available even when photo import is disabled', async () => {
    renderLibrary();
    await screen.findByText('Your library');

    expect(screen.getByRole('button', { name: 'Import from CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add from a photo' })).not.toBeInTheDocument();
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
    expect(mockedResolve).toHaveBeenCalledWith([
      { title: 'Dune', author: 'Frank Herbert', publisher: null, isbn: null },
    ]);
  });

  it('passes an ISBN through when the file has one', async () => {
    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title,isbn\nDune,978-0-441-01359-3'));

    await screen.findByText(/Found matches for/);
    expect(mockedResolve).toHaveBeenCalledWith([
      { title: 'Dune', author: null, publisher: null, isbn: '978-0-441-01359-3' },
    ]);
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
    dropFile(dialog, csvFile("title,author,publisher\nHong Kong, Macau,,Frommer's\nDune,Frank Herbert,Ace"));

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
              candidate({ googleBooksId: 'g1', title: "Frommer's Hong Kong", publisher: "Frommer's" }),
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
        ),
      );
    });
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

  // A machine-generated photo scan can drop duplicates silently; a file the
  // reader wrote cannot, or they'd wonder where their rows went.
  it('renders an already-owned book as inert rather than dropping it', async () => {
    mockedResolve.mockResolvedValue({
      rows: [resolved({ title: 'Existing', matchedBookId: 1 })],
    });
    mockedGetBooksByIds.mockResolvedValue({
      books: [
        {
          id: 1,
          slug: 'book-1',
          title: 'Existing',
          authorName: 'Anon',
          authorSlug: 'anon',
          year: 2000,
          rating: 4,
          coverUrl: null,
          hue: '#6f7a55',
        },
      ],
    });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nExisting'));

    expect(await screen.findByText('Already in your library')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('cycles a status and drops the count when a row is unticked', async () => {
    mockedResolve.mockResolvedValue({ rows: [resolved(), resolved({ title: 'Ubik' })] });

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile('title\nDune\nUbik'));

    await screen.findByRole('button', { name: 'Add 2 to library' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Queued' })[0]);
    expect(screen.getByRole('button', { name: 'Reading' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: 'Add 1 to library' })).toBeInTheDocument();
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

    expect(await screen.findByText(/Added 1 of 2/)).toBeInTheDocument();
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

  it('toasts when resolution finishes after the modal was closed', async () => {
    let resolveNow: (v: { rows: RawResolvedRow[] }) => void = () => {};
    mockedResolve.mockReturnValue(new Promise((r) => (resolveNow = r)));

    renderLibrary();
    const dialog = await openModal();
    dropFile(dialog, csvFile(SIMPLE_CSV));

    await screen.findByText(/Looking up/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    resolveNow({ rows: [resolved()] });

    expect(await screen.findByText('Matched 1 book from your file')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
