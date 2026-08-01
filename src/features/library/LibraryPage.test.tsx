import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LibraryPage } from './LibraryPage';
import { getLibrary } from '../../api/library/get-library';
import type { RawLibraryEntry } from '../../normalize/library';
import type { LibraryStatus } from '../../shared/types/library-status';

vi.mock('../../api/library/get-library');

const mockedGetLibrary = vi.mocked(getLibrary);

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
    // Stubbed rather than inherited: two tests below assert the photo-import
    // button is offered, so without this the suite passes or fails according to
    // whichever way the developer's own .env has the flag set.
    vi.stubEnv('VITE_ENABLE_PHOTO_IMPORT', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders header, charts, status tabs, and the book grid', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    expect(await screen.findByText('Your library')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add from a photo' })).toBeInTheDocument();

    expect(screen.getByText('By Status')).toBeInTheDocument();
    expect(screen.getByText('By Subject')).toBeInTheDocument();
    expect(screen.getByText('By Author')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument();
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
    expect(screen.getByRole('tab', { name: 'All 64' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'New 64' })).toBeInTheDocument();
    expect(mockedGetLibrary).toHaveBeenCalledWith({ page: 1, limit: 60 });
    expect(mockedGetLibrary).toHaveBeenCalledWith({ page: 2, limit: 60 });
  });

  it('filters the grid to finished books when the Finished tab is clicked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    fireEvent.click(await screen.findByRole('tab', { name: /Finished/ }));

    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Finished/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('filters by subject and shows a dismissible pill when a subject slice is picked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    const charts = await screen.findByLabelText('Library breakdown');
    fireEvent.click(within(charts).getByText('History'));

    // History books: Sapiens + Clockwork; Dune (Evolution only) is filtered out.
    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clockwork/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();

    const pill = screen.getByText('subject:').closest('div')!;
    expect(within(pill).getByText('History')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear subject filter/ }));
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.queryByText('subject:')).not.toBeInTheDocument();
  });

  it('activates the Reading tab when the By Status Reading slice is picked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    const charts = await screen.findByLabelText('Library breakdown');
    fireEvent.click(within(charts).getByText('Reading'));

    expect(screen.getByRole('tab', { name: /Reading/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sapiens/ })).not.toBeInTheDocument();
  });

  it('shows pagination controls when results exceed the page size', async () => {
    const many = Array.from({ length: 61 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(many, { queued: 61 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
  });

  it('shows the empty state for a library with no books', async () => {
    mockLibrary([], {});
    renderLibrary();

    expect(await screen.findByText('Your shelves are empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add from a photo' })).toBeInTheDocument();
    expect(screen.queryByText('By Status')).not.toBeInTheDocument();
  });

  it('hides status tabs that have no books', async () => {
    const allQueued = Array.from({ length: 3 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(allQueued, { queued: 3 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByRole('tab', { name: /New/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Finished/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Reading/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Abandoned/ })).not.toBeInTheDocument();
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
    const untagged = makeRaw({ title: 'Untagged Book' });

    it('filters the grid when a mood slice is picked, and shows a dismissible pill', async () => {
      mockLibrary([reflective, intense, untagged], { queued: 3 });
      renderLibrary();

      const charts = await screen.findByLabelText('Library breakdown');
      fireEvent.click(within(charts).getByText('Reflective'));

      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /We the Living/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Untagged Book/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Clear mood filter/ }));
      expect(screen.getByRole('button', { name: /Untagged Book/ })).toBeInTheDocument();
    });

    it('filters the grid when a theme chip is picked', async () => {
      mockLibrary([reflective, intense, untagged], { queued: 3 });
      renderLibrary();

      const themes = await screen.findByLabelText('Filter by theme');
      fireEvent.click(within(themes).getByText('Totalitarianism'));

      expect(screen.getByRole('button', { name: /We the Living/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cosmos/ })).not.toBeInTheDocument();
    });

    // The chip stays visibly selected, so it has to be the way back out.
    it('clears the theme when the active chip is clicked again', async () => {
      mockLibrary([reflective, intense], { queued: 2 });
      renderLibrary();

      const themes = await screen.findByLabelText('Filter by theme');
      const chip = within(themes).getByText('Totalitarianism');
      fireEvent.click(chip);
      expect(chip).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(chip);
      expect(chip).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    });

    // One attribute at a time: subject, author, mood and theme share a pill.
    it('replaces a mood filter when a theme is picked', async () => {
      mockLibrary([reflective, intense], { queued: 2 });
      renderLibrary();

      const charts = await screen.findByLabelText('Library breakdown');
      fireEvent.click(within(charts).getByText('Intense'));
      expect(screen.getByText('mood:')).toBeInTheDocument();

      const themes = await screen.findByLabelText('Filter by theme');
      fireEvent.click(within(themes).getByText('Scientific discovery'));

      expect(screen.queryByText('mood:')).not.toBeInTheDocument();
      expect(screen.getByText('theme:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    });

    it('shows neither control when nothing has been tagged yet', async () => {
      mockLibrary([untagged], { queued: 1 });
      renderLibrary();

      await screen.findByRole('button', { name: /Untagged Book/ });
      expect(screen.queryByLabelText('Filter by theme')).not.toBeInTheDocument();
      const charts = screen.getByLabelText('Library breakdown');
      expect(within(charts).queryByText('By Mood')).not.toBeInTheDocument();
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

    it('narrows alongside a status tab rather than replacing it', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      fireEvent.click(await screen.findByRole('tab', { name: /Finished/ }));

      await search('sapiens');
      expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();

      await search('dune');
      // Dune is 'reading', so the Finished tab still excludes it.
      expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    });

    it('says so when nothing matches', async () => {
      mockLibrary([dune], { reading: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });

      await search('nothingmatchesthis');

      expect(screen.getByText(/No books in your library match/)).toBeInTheDocument();
    });

    // Charts and tabs describe the whole library, not the current filter.
    it('leaves the charts and tab counts reporting the whole library', async () => {
      mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
      renderLibrary();
      await screen.findByRole('button', { name: /Dune/ });

      await search('dune');

      expect(screen.getByRole('tab', { name: /Finished/ })).toBeInTheDocument();
      const charts = await screen.findByLabelText('Library breakdown');
      expect(within(charts).getByText('History')).toBeInTheDocument();
    });
  });
});
