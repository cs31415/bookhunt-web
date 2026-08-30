import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LibraryPage } from './LibraryPage';
import { getLibrary } from '../../api/library/get-library';
import { removeEntry } from '../../api/library/remove-entry';
import { removeEntries } from '../../api/library/remove-entries';
import { setEbook } from '../../api/library/set-ebook';
import { exportLibrary } from '../../api/library/export-library';
import { downloadBlob } from '../../shared/lib/download-json';
import { ApiError } from '../../api/client';
import { ToastHost } from '../../shared/toast/ToastHost';
import { clearToasts } from '../../shared/toast/toast-store';
import type { RawLibraryEntry } from '../../normalize/library';
import type { LibraryStatus } from '../../shared/types/library-status';

vi.mock('../../api/library/get-library');
vi.mock('../../api/library/remove-entry');
vi.mock('../../api/library/remove-entries');
vi.mock('../../api/library/set-ebook');
vi.mock('../../api/library/export-library');
vi.mock('../../shared/lib/download-json', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/lib/download-json')>()),
  downloadBlob: vi.fn(),
}));

const mockedGetLibrary = vi.mocked(getLibrary);
const mockedRemoveEntry = vi.mocked(removeEntry);
const mockedRemoveEntries = vi.mocked(removeEntries);
const mockedSetEbook = vi.mocked(setEbook);
const mockedExport = vi.mocked(exportLibrary);
const mockedDownload = vi.mocked(downloadBlob);

let idSeq = 1;

function makeRaw(overrides: Partial<RawLibraryEntry> = {}): RawLibraryEntry {
  const id = overrides.book_id ?? idSeq++;
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

function mockLibrary(entries: RawLibraryEntry[], byStatus: Partial<Record<LibraryStatus, number>> = {}) {
  mockedGetLibrary.mockResolvedValue({
    entries,
    total: entries.length,
    stats: { total: entries.length, by_status: byStatus },
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderLibrary(initialEntry = '/library') {
  const router = createMemoryRouter(
    [
      {
        path: '/library',
        element: (
          <>
            <LibraryPage />
            <LocationProbe />
            {/* App renders this, not the page -- without it a toast has
                nowhere to appear and the assertions below cannot see one. */}
            <ToastHost />
          </>
        ),
      },
      { path: '/', element: <LocationProbe /> },
      { path: '/books/:slug', element: <LocationProbe /> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const dune = makeRaw({
  title: 'Dune',
  book_slug: 'dune',
  status: 'reading',
  subjects: ['Evolution'],
  author_name: 'Frank Herbert',
});
const sapiens = makeRaw({
  title: 'Sapiens',
  status: 'finished',
  subjects: ['Evolution', 'History'],
  author_name: 'Yuval Harari',
});
const clockwork = makeRaw({
  title: 'Clockwork',
  status: 'queued',
  subjects: ['History'],
  author_name: 'Anon',
});

describe('LibraryPage', () => {
  beforeEach(() => {
    idSeq = 100;
    mockedGetLibrary.mockReset();
    mockedRemoveEntry.mockReset();
    mockedRemoveEntry.mockResolvedValue(undefined);
    mockedRemoveEntries.mockReset();
    mockedRemoveEntries.mockResolvedValue({ removed: 0, requested: 0 });
    mockedSetEbook.mockReset();
    mockedSetEbook.mockResolvedValue({
      entry: { user_id: 1, book_id: 1, is_favorite: false, is_hidden: false, is_ebook: true },
    });
    mockedExport.mockReset();
    mockedDownload.mockReset();
    clearToasts();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the header, the filter rail, and the book grid', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    expect(await screen.findByText('Your library')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 books' })).toBeInTheDocument();

    const rail = screen.getByLabelText('Library filters');
    expect(within(rail).getByText('Category')).toBeInTheDocument();
    expect(within(rail).getByText('Status')).toBeInTheDocument();
    // No Author group: 242 of 273 authors in a real library have one book, so
    // every pill would be a dead end.
    expect(within(rail).queryByText('Author')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
  });

  // Regression test: GET /library paginates (LOS-118, max 60/page). A
  // library bigger than one page must still show every book and count every
  // status correctly, not just whatever page 1 happened to return.
  it('walks every page of a library bigger than one page', async () => {
    const allEntries = Array.from({ length: 64 }, (_, i) => makeRaw({ book_id: i + 1, status: 'queued' }));
    mockedGetLibrary.mockImplementation(async ({ page = 1, limit = 24 } = {}) => {
      const start = (page - 1) * limit;
      return {
        entries: allEntries.slice(start, start + limit),
        // Stats come back on the first page only, so the walk has to run off
        // `total` — the server no longer recomputes them per page (LOS-179).
        ...(page === 1
          ? { stats: { total: allEntries.length, by_status: { queued: allEntries.length } } }
          : {}),
        total: allEntries.length,
        page,
        pageSize: limit,
      };
    });

    renderLibrary();

    expect(await screen.findByRole('heading', { name: '64 books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New 64' })).toBeInTheDocument();
    expect(mockedGetLibrary).toHaveBeenCalledWith({ page: 1, limit: 60 });
    expect(mockedGetLibrary).toHaveBeenCalledWith({ page: 2, limit: 60 });
  });

  it('filters the grid to finished books when the Finished pill is picked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    fireEvent.click(await screen.findByRole('button', { name: /^Finished/ }));

    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Finished/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters by category when a category pill is picked, and clears on a second click', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    const rail = await screen.findByLabelText('Library filters');
    fireEvent.click(within(rail).getByText('History'));

    // History books: Sapiens + Clockwork; Dune (Evolution only) is filtered out.
    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clockwork/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();

    // The pill stays lit, so it is also the way back out.
    fireEvent.click(within(rail).getByText('History'));
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
  });

  it('selects the Reading pill and narrows the grid to it', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    const rail = await screen.findByLabelText('Library filters');
    fireEvent.click(within(rail).getByText(/^Reading/));

    expect(screen.getByRole('button', { name: /^Reading/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sapiens/ })).not.toBeInTheDocument();
  });

  it('offers more when the shelf is longer than one slice', async () => {
    const many = Array.from({ length: 61 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(many, { queued: 61 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByText('60 of 61 books')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
  });

  // Grows the slice rather than moving a window over it, so what the reader has
  // already scrolled past stays where they left it.
  it('keeps the books already shown when more are asked for', async () => {
    const many = Array.from({ length: 61 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(many, { queued: 61 });
    renderLibrary();

    await screen.findByText('Your library');
    // fireEvent, not userEvent: this page renders sixty cards, and userEvent's
    // pointer simulation over that many nodes is slow enough to time out under
    // full-suite load. The press itself is all this test needs.
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('All 61 books')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    // A minute past the default: growing the slice renders sixty-one cards,
    // each drawing a procedural cover, and under full-suite load that has taken
    // past the five seconds vitest allows a test by default. The failure that
    // produced read as this assertion breaking, which it never was (LOS-332).
  }, 20000);

  // The count is the whole shelf, not the slice: a reader who cannot see the
  // grid has only this line to tell them how far through it they are.
  it('says nothing about slices when the shelf fits in one', async () => {
    mockLibrary([makeRaw({ status: 'queued' })], { queued: 1 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByText('All 1 book')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows the empty state for a library with no books', async () => {
    mockLibrary([], {});
    renderLibrary();

    expect(await screen.findByText('Your shelves are empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover books' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Library filters')).not.toBeInTheDocument();
  });

  it('hides status pills that have no books', async () => {
    const allQueued = Array.from({ length: 3 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(allQueued, { queued: 3 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByRole('button', { name: /^New/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Finished/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reading/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Abandoned/ })).not.toBeInTheDocument();
  });

  it('navigates to the book detail page when a card is clicked', async () => {
    mockLibrary([dune], { reading: 1 });
    renderLibrary();

    fireEvent.click(await screen.findByRole('button', { name: /Dune/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/books/dune');
  });

  // Moods and themes are AI-generated and filled in lazily, so most rows carry
  // neither and both filters have to cope with that (LOS-186).
  describe('mood and theme filters', () => {
    const reflective = makeRaw({
      title: 'Cosmos',
      book_slug: 'cosmos',
      moods: ['Reflective', 'Analytical'],
      themes: ['Scientific discovery'],
    });
    const intense = makeRaw({
      title: 'We the Living',
      moods: ['Intense'],
      themes: ['Totalitarianism'],
    });
    // Each tag needs a second book to reach the rail at all (LOS-192): a tag
    // held by one book is a link to it, not a filter.
    const alsoScientific = makeRaw({ title: 'Pale Blue Dot', themes: ['Scientific discovery'] });
    const alsoTotalitarian = makeRaw({ title: 'Anthem', themes: ['Totalitarianism'] });
    const tagged = [reflective, intense, alsoScientific, alsoTotalitarian];
    const untagged = makeRaw({ title: 'Untagged Book' });

    // Moods need a second book too, for the same reason.
    const alsoReflective = makeRaw({ title: 'Pale Blue Dot II', moods: ['Reflective'] });

    it('filters the grid when a mood pill is picked', async () => {
      mockLibrary([reflective, alsoReflective, intense, untagged], { queued: 4 });
      renderLibrary();

      const rail = await screen.findByLabelText('Library filters');
      fireEvent.click(within(rail).getByText('Reflective'));

      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /We the Living/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Untagged Book/ })).not.toBeInTheDocument();

      fireEvent.click(within(rail).getByText('Reflective'));
      expect(screen.getByRole('button', { name: /Untagged Book/ })).toBeInTheDocument();
    });

    it('filters the grid when a theme pill is picked', async () => {
      mockLibrary([...tagged, untagged], { queued: 5 });
      renderLibrary();

      const rail = await screen.findByLabelText('Library filters');
      fireEvent.click(within(rail).getByText('Totalitarianism'));

      expect(screen.getByRole('button', { name: /We the Living/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Anthem/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cosmos/ })).not.toBeInTheDocument();
    });

    it('leaves out a theme only one book carries', async () => {
      const loner = makeRaw({ title: 'Solaris', themes: ['Contact with the alien'] });
      mockLibrary([...tagged, loner], { queued: 5 });
      renderLibrary();

      const rail = await screen.findByLabelText('Library filters');
      expect(within(rail).getByText('Totalitarianism')).toBeInTheDocument();
      expect(within(rail).queryByText('Contact with the alien')).not.toBeInTheDocument();
    });

    // The pill stays visibly selected, so it has to be the way back out.
    it('clears the theme when the active pill is clicked again', async () => {
      mockLibrary(tagged, { queued: 4 });
      renderLibrary();

      const rail = await screen.findByLabelText('Library filters');
      const pill = within(rail).getByText('Totalitarianism');
      fireEvent.click(pill);
      expect(pill).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(pill);
      expect(pill).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    });

    // One attribute at a time: category, mood and theme are one axis, so
    // picking any of them releases the last.
    it('replaces a mood filter when a theme is picked', async () => {
      mockLibrary([...tagged, alsoReflective], { queued: 5 });
      renderLibrary();

      const rail = await screen.findByLabelText('Library filters');
      fireEvent.click(within(rail).getByText('Reflective'));
      expect(within(rail).getByText('Reflective')).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(within(rail).getByText('Scientific discovery'));

      expect(within(rail).getByText('Reflective')).toHaveAttribute('aria-pressed', 'false');
      expect(within(rail).getByText('Scientific discovery')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    });

    it('offers no mood or theme group when nothing has been tagged yet', async () => {
      mockLibrary([untagged], { queued: 1 });
      renderLibrary();

      await screen.findByRole('button', { name: /Untagged Book/ });
      const rail = screen.getByLabelText('Library filters');
      expect(within(rail).queryByText('Mood')).not.toBeInTheDocument();
      expect(within(rail).queryByText('Theme')).not.toBeInTheDocument();
      // Status is always there — every book has one.
      expect(within(rail).getByText('Status')).toBeInTheDocument();
    });
  });

  // Filtering happens over the entries already in memory, so the box narrows the
  // grid without a request (LOS-183).
  describe('search box', () => {
    async function search(value: string) {
      const input = await screen.findByLabelText('Search');
      fireEvent.change(input, { target: { value } });
      return input;
    }

    it('filters the grid by author without refetching', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });
      const callsBefore = mockedGetLibrary.mock.calls.length;

      await search('herbert');

      expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sapiens/ })).not.toBeInTheDocument();
      expect(mockedGetLibrary.mock.calls).toHaveLength(callsBefore);
    });

    it('filters by title and by subject', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });

      await search('sapiens');
      expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();

      await search('history');
      expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clockwork/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    });

    it('keeps the query in the URL so a filtered library stays shareable', async () => {
      mockLibrary([dune, sapiens], { reading: 1, finished: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });

      await search('dune');

      expect(screen.getByTestId('location')).toHaveTextContent('q=dune');
    });

    it('applies a query already in the URL on first render', async () => {
      mockLibrary([dune, sapiens], { reading: 1, finished: 1 });
      renderLibrary('/library?q=sapiens');

      expect(await screen.findByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    });

    it('narrows alongside a status pill rather than replacing it', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      fireEvent.click(await screen.findByRole('button', { name: /^Finished/ }));

      await search('sapiens');
      expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();

      await search('dune');
      // Dune is 'reading', so the Finished pill still excludes it.
      expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    });

    it('says so when nothing matches', async () => {
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });

      await search('nothingmatchesthis');

      expect(screen.getByText(/No books in your library match/)).toBeInTheDocument();
    });

    // The rail describes the whole library, not the current filter -- narrowing
    // to one book must not leave you with one pill and no way back.
    it('leaves the rail reporting the whole library', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });

      await search('dune');

      const rail = screen.getByLabelText('Library filters');
      expect(within(rail).getByText('Finished 1')).toBeInTheDocument();
      expect(within(rail).getByText('History')).toBeInTheDocument();
    });
  });

  describe('removing books', () => {
    /** The menu trigger for one card, found via the group named after the book. */
    function menuFor(title: string) {
      const card = screen.getByRole('group', { name: title });
      return within(card).getByRole('button', { name: 'Book actions' });
    }

    it('removes a single book once the confirmation is accepted', async () => {
      mockLibrary([dune, sapiens], { reading: 1, finished: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '2 books' });

      fireEvent.click(menuFor('Dune'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from library' }));

      // Names the book, and says what removal costs beyond the entry itself.
      expect(await screen.findByRole('dialog')).toHaveTextContent('Remove this book?');
      expect(screen.getByRole('dialog')).toHaveTextContent(/rating, review and notes/);

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));

      await screen.findByText(/Removed .Dune. from your library/);
      expect(mockedRemoveEntry).toHaveBeenCalledWith(dune.book_id);
    });

    it('does not call the api when the confirmation is cancelled', async () => {
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      fireEvent.click(menuFor('Dune'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from library' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockedRemoveEntry).not.toHaveBeenCalled();
    });

    it('selects several books and removes them in one request', async () => {
      mockedRemoveEntries.mockResolvedValue({ removed: 2, requested: 2 });
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '3 books' });

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Dune' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Sapiens' }));

      expect(screen.getByText('2 selected')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Remove 2' }));

      expect(await screen.findByRole('dialog')).toHaveTextContent('Remove 2 books?');
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));

      await screen.findByText('Removed 2 books from your library');
      expect(mockedRemoveEntries).toHaveBeenCalledTimes(1);
      expect(mockedRemoveEntries).toHaveBeenCalledWith([dune.book_id, sapiens.book_id]);
    });

    // Select all means what is on screen. A reader who has filtered to one
    // status should not be selecting the books that filter is hiding.
    it('limits select all to the filtered set', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '3 books' });

      fireEvent.click(await screen.findByRole('button', { name: /^Finished/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select all 1' }));

      expect(screen.getByText('1 selected')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Remove 1' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));

      await screen.findByText(/Removed/);
      expect(mockedRemoveEntries).toHaveBeenCalledWith([sapiens.book_id]);
    });

    it('offers the menu again after leaving selection mode', async () => {
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByRole('checkbox', { name: 'Select Dune' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Book actions' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.queryByRole('checkbox', { name: 'Select Dune' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Book actions' })).toBeInTheDocument();
    });
  });

  describe('format', () => {
    const kindleDune = { ...dune, is_ebook: true };

    it('badges an ebook on the card', async () => {
      mockLibrary([kindleDune], { reading: 1 });
      renderLibrary();

      const card = await screen.findByRole('group', { name: 'Dune' });
      expect(within(card).getByText('Ebook')).toBeInTheDocument();
    });

    // The eyebrow is one line and two flags can be true at once, so it says
    // both rather than letting the first one win.
    it('badges a hidden ebook as both', async () => {
      mockLibrary([{ ...kindleDune, is_hidden: true }], { reading: 1 });
      renderLibrary();

      const card = await screen.findByRole('group', { name: 'Dune' });
      expect(within(card).getByText('Ebook · Hidden from your public page')).toBeInTheDocument();
    });

    it('marks the copy as an ebook from the card menu', async () => {
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      const card = screen.getByRole('group', { name: 'Dune' });
      fireEvent.click(within(card).getByRole('button', { name: 'Book actions' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Mark as ebook' }));

      expect(mockedSetEbook).toHaveBeenCalledWith(dune.book_id, true);
      // Optimistic: the badge is there before any refetch.
      expect(await within(card).findByText('Ebook')).toBeInTheDocument();
    });

    it('narrows the grid to one format and keeps it in the url', async () => {
      mockLibrary([kindleDune, sapiens], { reading: 1, finished: 1 });
      const router = renderLibrary();
      await screen.findByRole('heading', { name: '2 books' });

      fireEvent.click(screen.getByRole('button', { name: 'Ebook 1' }));

      expect(screen.getByRole('group', { name: 'Dune' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Sapiens' })).not.toBeInTheDocument();
      expect(router.state.location.search).toContain('format=ebook');
    });
  });
  // The answer to Import, and it sits beside it (LOS-302).
  describe('exporting the library', () => {
    const emptyExport = {
      exportedAt: '2026-08-21T00:00:00.000Z',
      books: [],
      favorites: { books: [], authors: [], users: [] },
    };

    it('hands the reader a dated zip', async () => {
      mockedExport.mockResolvedValue(emptyExport);
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      fireEvent.click(screen.getByRole('button', { name: 'Export' }));

      await waitFor(() => expect(mockedDownload).toHaveBeenCalled());
      const [filename, blob] = mockedDownload.mock.calls[0];
      expect(filename).toMatch(/^bookhunt-library-\d{4}-\d{2}-\d{2}\.zip$/);
      // What is in it is export-zip's business, and tested there. This only
      // asks that the page handed over a zip at all.
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/zip');
    });

    // A library of a few hundred books is not instant, and a second click
    // would spend another of the ten the API allows in an hour.
    it('disables the button while the export is in flight', async () => {
      let release: (value: typeof emptyExport) => void = () => {};
      mockedExport.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      fireEvent.click(screen.getByRole('button', { name: 'Export' }));

      const button = await screen.findByRole('button', { name: 'Exporting…' });
      expect(button).toBeDisabled();

      release(emptyExport);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled());
    });

    it('says so when the export fails, and offers the button again', async () => {
      mockedExport.mockRejectedValue(new Error('network'));
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      fireEvent.click(screen.getByRole('button', { name: 'Export' }));

      expect(await screen.findByText(/Could not export your library/)).toBeInTheDocument();
      expect(mockedDownload).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    });

    // Worth telling apart from a failure: it says to wait, not that something
    // is broken.
    it('names the rate limit rather than blaming the export', async () => {
      mockedExport.mockRejectedValue(new ApiError(429, 'Too many requests'));
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('heading', { name: '1 book' });

      fireEvent.click(screen.getByRole('button', { name: 'Export' }));

      expect(await screen.findByText(/Too many exports just now/)).toBeInTheDocument();
    });
  });
});
