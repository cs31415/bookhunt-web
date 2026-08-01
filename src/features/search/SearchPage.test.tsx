import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';
import { clearSuggestionCache } from './hooks/useSearchResults';
import { AuthProvider } from '../auth/AuthContext';
import { setSession } from '../../api/auth/token';
import { aiSearch } from '../../api/ai/search';
import { searchLibrary } from '../../api/library/search-library';
import type { RawAiSearchBook } from '../../normalize/search';
import type { RawLibraryEntry } from '../../normalize/library';

vi.mock('../../api/ai/search');
vi.mock('../../api/library/search-library');

const mockedAiSearch = vi.mocked(aiSearch);
const mockedSearchLibrary = vi.mocked(searchLibrary);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/** AuthProvider hydrates from localStorage, so seeding it is enough to sign in. */
function signIn() {
  setSession('test-token', { id: 1, email: 'reader@example.com', displayName: 'Reader' });
}

function renderSearchPage(initialEntry: string) {
  const searchElement = (
    <>
      <SearchPage />
      <LocationProbe />
    </>
  );
  const router = createMemoryRouter(
    [
      { path: '/search', element: searchElement },
      { path: '/books/:slug', element: <LocationProbe /> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

function makeBook(overrides: Partial<RawAiSearchBook> = {}): RawAiSearchBook {
  return {
    googleBooksId: 'abc123',
    openLibraryId: null,
    title: 'Night Watch',
    authors: ['Lucille Fletcher'],
    year: 2026,
    publisher: null,
    pages: 80,
    rating: null,
    coverUrl: null,
    isbn13: null,
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

describe('SearchPage', () => {
  beforeEach(() => {
    // Module-level and deliberately session-lived (LOS-184), so each case has to
    // start from empty or it inherits the previous one's suggestions.
    clearSuggestionCache();
    mockedAiSearch.mockReset();
    mockedSearchLibrary.mockReset();
    // Most cases are about the AI results; an empty shelf keeps the library
    // section out of the way unless a case opts into it.
    mockedSearchLibrary.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      pageSize: 24,
      query: '',
    });
    localStorage.clear();
    // Most cases exercise the signed-in path; the library-filter cases below
    // override this by clearing storage before rendering.
    signIn();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('prompts for a query when there is none yet, and does not fetch', async () => {
    renderSearchPage('/search');

    expect(await screen.findByText(/Type a query above/)).toBeInTheDocument();
    expect(mockedAiSearch).not.toHaveBeenCalled();
  });

  it('shows results and count for a query', async () => {
    mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'thriller' });

    renderSearchPage('/search?q=thriller');

    expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
    expect(screen.getByText(/Results for/)).toBeInTheDocument();
    expect(screen.getByText('1 book')).toBeInTheDocument();
    expect(mockedAiSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'thriller' }),
      expect.anything(),
    );
    // Never sent any more: it did not reach the prompt, so the server only ever
    // used it to post-filter something the client can filter itself (LOS-184).
    expect(mockedAiSearch.mock.calls[0][0]).not.toHaveProperty('inLibraryOnly');
  });

  it('shows the theme heading when arriving via a theme pill', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: '' });

    renderSearchPage('/search?q=guilt+and+redemption&theme=true');

    expect(await screen.findByText(/Books on the theme of/)).toBeInTheDocument();
  });

  it('shows the mood heading and translated query when arriving via a mood pill', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: '' });

    renderSearchPage('/search?q=books+that+feel+Lyrical&mood=Lyrical');

    const heading = await screen.findByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Books that feel Lyrical');
    await waitFor(() =>
      expect(mockedAiSearch).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'books that feel Lyrical' }),
        expect.anything(),
      ),
    );
  });

  it('shows the empty state when there are no results', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: 'zzz' });

    renderSearchPage('/search?q=zzz');

    expect(await screen.findByText('No books match.')).toBeInTheDocument();
  });

  // It used to refetch, for a prompt the server built identically either way.
  it('applies inLibraryOnly client-side without refetching', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({ title: 'Owned Book', inLibrary: true, libraryStatus: 'finished' }),
        makeBook({ title: 'Unowned Book', googleBooksId: 'xyz789' }),
      ],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');
    await screen.findByRole('button', { name: /Unowned Book/ });
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('In my library only'));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Unowned Book/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Owned Book/ })).toBeInTheDocument();
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  describe('when signed out', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('disables the "In my library only" toggle', async () => {
      mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });
      renderSearchPage('/search?q=thriller');

      const toggle = await screen.findByRole('switch', { name: /In my library only/ });
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute('title', 'Sign in to filter by your library');
    });

    it('does not toggle the filter when the disabled control is clicked', async () => {
      mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });
      renderSearchPage('/search?q=thriller');
      await waitFor(() => expect(mockedAiSearch).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByText('In my library only'));

      expect(screen.getByRole('switch', { name: /In my library only/ })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(mockedAiSearch).toHaveBeenCalledTimes(1);
    });

    // Otherwise the filter strands them: every result is filtered away and the
    // only control that could undo it is disabled.
    it('ignores inLibraryOnly arriving in the URL', async () => {
      mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });
      renderSearchPage('/search?q=thriller&inLibraryOnly=true');

      await waitFor(() => expect(mockedAiSearch).toHaveBeenCalledTimes(1));
      expect(mockedAiSearch.mock.calls[0][0]).not.toHaveProperty('inLibraryOnly');
      expect(screen.getByRole('switch', { name: /In my library only/ })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    it('leaves the param in the URL so signing in restores the intent', async () => {
      mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });
      renderSearchPage('/search?q=thriller&inLibraryOnly=true');

      await waitFor(() => expect(mockedAiSearch).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('location')).toHaveTextContent('inLibraryOnly=true');
    });
  });

  it('leaves the toggle enabled when signed in', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });
    renderSearchPage('/search?q=thriller');

    const toggle = await screen.findByRole('switch', { name: /In my library only/ });
    expect(toggle).toBeEnabled();
    expect(toggle).not.toHaveAttribute('title');
  });

  it('filters to a status client-side without refetching', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({ googleBooksId: 'a', title: 'Reading Book', inLibrary: true, libraryStatus: 'reading' }),
        makeBook({ googleBooksId: 'b', title: 'Finished Book', inLibrary: true, libraryStatus: 'finished' }),
      ],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');
    await screen.findByRole('button', { name: /Reading Book/ });

    fireEvent.click(screen.getByRole('button', { name: 'Reading' }));

    expect(await screen.findByRole('button', { name: /Reading Book/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finished Book/ })).not.toBeInTheDocument();
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  it('filters to a category client-side without refetching', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({ googleBooksId: 'a', title: 'Memoir Book', categories: ['Memoir'] }),
        makeBook({ googleBooksId: 'b', title: 'Fiction Book', categories: ['Fiction'] }),
      ],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');
    await screen.findByRole('button', { name: /Memoir Book/ });

    fireEvent.click(screen.getByRole('button', { name: 'Memoir' }));

    expect(await screen.findByRole('button', { name: /Memoir Book/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fiction Book/ })).not.toBeInTheDocument();
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  it('filters to a mood client-side without refetching', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({ googleBooksId: 'a', title: 'Rigorous Book', moods: ['Rigorous'] }),
        makeBook({ googleBooksId: 'b', title: 'Tender Book', moods: ['Tender'] }),
      ],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');
    await screen.findByRole('button', { name: /Rigorous Book/ });

    fireEvent.click(screen.getByRole('button', { name: 'Rigorous' }));

    expect(await screen.findByRole('button', { name: /Rigorous Book/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tender Book/ })).not.toBeInTheDocument();
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  it('passes subject/mood params through to aiSearch as seedCategory/seedMood', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: '' });

    renderSearchPage('/search?q=Stoicism+books&subject=Stoicism');

    await waitFor(() =>
      expect(mockedAiSearch).toHaveBeenCalledWith(
        expect.objectContaining({ seedCategory: 'Stoicism', seedMood: undefined }),
        expect.anything(),
      ),
    );
  });

  it('sorts by highest rated client-side without refetching', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({ googleBooksId: 'a', title: 'Low Rated', rating: 2 }),
        makeBook({ googleBooksId: 'b', title: 'High Rated', rating: 4.8 }),
      ],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');
    await screen.findByRole('button', { name: /Low Rated/ });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rating' } });

    const buttons = await screen.findAllByRole('button', { name: /Rated/ });
    expect(buttons[0]).toHaveTextContent('High Rated');
    expect(mockedAiSearch).toHaveBeenCalledTimes(1);
  });

  it('renders an LLM-suggested result (no id, no cover) without an extra metadata fetch', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({
          googleBooksId: null,
          openLibraryId: null,
          title: 'Meditations',
          authors: ['Marcus Aurelius'],
          coverUrl: null,
          source: 'gemini-3.1-flash-lite',
        }),
      ],
      query: 'stoicism',
    });

    renderSearchPage('/search?q=stoicism');

    expect(await screen.findByRole('button', { name: /Meditations/ })).toBeInTheDocument();
  });

  it('navigates synchronously to a slugified book/author reference, with the resolved googleBooksId as pid', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [makeBook({ title: 'Night Watch', authors: ['Lucille Fletcher'], googleBooksId: 'abc123' })],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');

    fireEvent.click(await screen.findByRole('button', { name: /Night Watch/ }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/books/night-watch?a=lucille-fletcher&pid=g%3Aabc123',
    );
  });

  it('encodes an openLibraryId-only result as pid=o:<id>', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({
          title: 'Night Watch',
          authors: ['Lucille Fletcher'],
          googleBooksId: null,
          openLibraryId: 'OL123M',
        }),
      ],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');

    fireEvent.click(await screen.findByRole('button', { name: /Night Watch/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/books/night-watch?a=lucille-fletcher&pid=o%3AOL123M');
  });

  it('omits pid entirely for an unresolved guess with no provider id', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [
        makeBook({
          title: 'Meditations',
          authors: ['Marcus Aurelius'],
          googleBooksId: null,
          openLibraryId: null,
        }),
      ],
      query: 'stoicism',
    });

    renderSearchPage('/search?q=stoicism');

    fireEvent.click(await screen.findByRole('button', { name: /Meditations/ }));

    const location = screen.getByTestId('location').textContent ?? '';
    expect(location).toBe('/books/meditations?a=marcus-aurelius');
    expect(location).not.toContain('pid');
  });

  it('shows an error message when the search fails', async () => {
    mockedAiSearch.mockRejectedValue(new Error('network error'));

    renderSearchPage('/search?q=x');

    expect(await screen.findByText(/Could not load search results/)).toBeInTheDocument();
  });

  // The query lives in the URL and there was no client cache anywhere, so every
  // back, forward and reload was another few seconds of LLM (LOS-184).
  describe('suggestion cache', () => {
    it('serves a repeated query from the cache instead of the LLM', async () => {
      mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'thriller' });

      const router = renderSearchPage('/search?q=thriller');
      await screen.findByRole('button', { name: /Night Watch/ });
      expect(mockedAiSearch).toHaveBeenCalledTimes(1);

      // A distinct answer, so returning to the first query proves the cache was
      // read rather than the mock simply answering the same way twice.
      mockedAiSearch.mockResolvedValue({ books: [makeBook({ title: 'Other Book' })], query: 'other' });
      router.navigate('/search?q=other');
      await screen.findByRole('button', { name: /Other Book/ });
      expect(mockedAiSearch).toHaveBeenCalledTimes(2);

      router.navigate('/search?q=thriller');

      expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
      expect(mockedAiSearch).toHaveBeenCalledTimes(2);
    });

    it('treats case and spacing differences as the same query', async () => {
      mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'thriller' });

      const router = renderSearchPage('/search?q=Carl+Sagan');
      await screen.findByRole('button', { name: /Night Watch/ });
      expect(mockedAiSearch).toHaveBeenCalledTimes(1);

      router.navigate('/search?q=carl++sagan');

      expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
      expect(mockedAiSearch).toHaveBeenCalledTimes(1);
    });

    // The LLM path swallows its own failures and answers [], so caching that
    // would pin a transient outage for the whole session.
    it('does not cache an empty result set', async () => {
      mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });

      const router = renderSearchPage('/search?q=thriller');
      await screen.findByText('No books match.');
      expect(mockedAiSearch).toHaveBeenCalledTimes(1);

      // Wait for each navigation to settle before the next: an in-flight fetch
      // is aborted on unmount, which would muddy the call count.
      mockedAiSearch.mockResolvedValue({ books: [makeBook({ title: 'Other Book' })], query: 'other' });
      router.navigate('/search?q=other');
      await screen.findByRole('button', { name: /Other Book/ });

      mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'thriller' });
      router.navigate('/search?q=thriller');

      // Asked again, rather than served the earlier empty answer.
      expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
      expect(mockedAiSearch).toHaveBeenCalledTimes(3);
    });

    // Pills have always filtered the fetched batch rather than re-querying;
    // keying the cache on them would have turned each click into an LLM call.
    it('does not refetch when a category pill changes', async () => {
      mockedAiSearch.mockResolvedValue({
        books: [makeBook({ categories: ['Popular Science'] })],
        query: 'thriller',
      });

      const router = renderSearchPage('/search?q=thriller');
      await screen.findByRole('button', { name: /Night Watch/ });

      router.navigate('/search?q=thriller&subject=Popular+Science');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Night Watch/ })).toBeInTheDocument(),
      );
      expect(mockedAiSearch).toHaveBeenCalledTimes(1);
    });
  });

  // The reason the ticket exists: "Sagan" should show the Sagan you own without
  // waiting seconds for a model to guess at it.
  describe('library results (LOS-183)', () => {
    function makeEntry(overrides: Partial<RawLibraryEntry> = {}): RawLibraryEntry {
      return {
        book_id: 42,
        status: 'queued',
        notes: null,
        review: null,
        title: 'Cosmos',
        book_slug: 'cosmos',
        author_name: 'Carl Sagan',
        author_slug: 'carl-sagan',
        year: 1980,
        rating: null,
        cover_url: null,
        hue: '#123456',
        subjects: [],
        moods: [],
        date_added: null,
        ...overrides,
      };
    }

    function resolveLibrary(entries: RawLibraryEntry[]) {
      mockedSearchLibrary.mockResolvedValue({
        entries,
        total: entries.length,
        page: 1,
        pageSize: 24,
        query: 'sagan',
      });
    }

    it('renders owned books in their own section, without waiting on the LLM', async () => {
      resolveLibrary([makeEntry()]);
      // Never resolves: the library section must not depend on it.
      mockedAiSearch.mockReturnValue(new Promise(() => {}));

      renderSearchPage('/search?q=sagan');

      expect(await screen.findByText('In your library')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    });

    it('searches the library with the query', async () => {
      resolveLibrary([]);
      mockedAiSearch.mockResolvedValue({ books: [], query: 'sagan' });

      renderSearchPage('/search?q=sagan');

      await waitFor(() =>
        expect(mockedSearchLibrary).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'sagan' }),
          expect.anything(),
        ),
      );
    });

    // A book already shown above, matched against the real catalog row, would
    // otherwise appear twice.
    it('drops AI suggestions the caller already owns once the section is shown', async () => {
      resolveLibrary([makeEntry()]);
      mockedAiSearch.mockResolvedValue({
        books: [
          makeBook({ title: 'Cosmos', inLibrary: true, libraryStatus: 'queued' }),
          makeBook({ title: 'Pale Blue Dot', googleBooksId: 'xyz789' }),
        ],
        query: 'sagan',
      });

      renderSearchPage('/search?q=sagan');

      expect(await screen.findByText('More to discover')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pale Blue Dot/ })).toBeInTheDocument();
      // One card, in the library section — not one in each.
      expect(screen.getAllByRole('button', { name: /Cosmos/ })).toHaveLength(1);
    });

    it('counts both sections together', async () => {
      resolveLibrary([makeEntry()]);
      mockedAiSearch.mockResolvedValue({
        books: [makeBook({ title: 'Pale Blue Dot' })],
        query: 'sagan',
      });

      renderSearchPage('/search?q=sagan');

      expect(await screen.findByText('2 books')).toBeInTheDocument();
    });

    it('leaves the AI results alone when nothing on the shelf matches', async () => {
      resolveLibrary([]);
      mockedAiSearch.mockResolvedValue({
        books: [makeBook({ title: 'Cosmos', inLibrary: true, libraryStatus: 'queued' })],
        query: 'sagan',
      });

      renderSearchPage('/search?q=sagan');

      expect(await screen.findByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
      expect(screen.queryByText('In your library')).not.toBeInTheDocument();
      expect(screen.queryByText('More to discover')).not.toBeInTheDocument();
    });

    // One list, not two sections saying the same thing — and no "no books
    // match" under a section that by definition has nothing to add.
    it('collapses to a single owned list when the toggle is on', async () => {
      resolveLibrary([makeEntry()]);
      mockedAiSearch.mockResolvedValue({
        books: [makeBook({ title: 'Pale Blue Dot' })],
        query: 'sagan',
      });

      renderSearchPage('/search?q=sagan&inLibraryOnly=true');

      expect(await screen.findByText('In your library')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
      expect(screen.queryByText('More to discover')).not.toBeInTheDocument();
      expect(screen.queryByText('No books match.')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Pale Blue Dot/ })).not.toBeInTheDocument();
      // The header total and the section count are the same list, so they agree.
      expect(screen.getAllByText('1 book')).toHaveLength(2);
    });

    // The library search is authoritative, but if it missed one the LLM flagged
    // as owned, the toggle should still surface it rather than show nothing.
    it('falls back to owned suggestions when the shelf search finds none', async () => {
      resolveLibrary([]);
      mockedAiSearch.mockResolvedValue({
        books: [
          makeBook({ title: 'Owned Book', inLibrary: true, libraryStatus: 'finished' }),
          makeBook({ title: 'Unowned Book', googleBooksId: 'xyz789' }),
        ],
        query: 'sagan',
      });

      renderSearchPage('/search?q=sagan&inLibraryOnly=true');

      expect(await screen.findByRole('button', { name: /Owned Book/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Unowned Book/ })).not.toBeInTheDocument();
    });

    it('does not ask about a library when signed out', async () => {
      localStorage.clear();
      mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'sagan' });

      renderSearchPage('/search?q=sagan');

      await screen.findByRole('button', { name: /Night Watch/ });
      expect(mockedSearchLibrary).not.toHaveBeenCalled();
    });

    // The section is supplementary; losing it should not take the page down.
    it('stays quiet when the library search fails', async () => {
      mockedSearchLibrary.mockRejectedValue(new Error('network error'));
      mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'sagan' });

      renderSearchPage('/search?q=sagan');

      expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
      expect(screen.queryByText(/Could not load search results/)).not.toBeInTheDocument();
    });
  });
});
