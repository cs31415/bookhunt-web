import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';
import { aiSearch } from '../../api/ai/search';
import { getMetadata } from '../../api/search/get-metadata';
import { getBooksByGoogleIds } from '../../api/books/get-books-by-ids';
import type { RawAiSearchBook } from '../../normalize/search';

vi.mock('../../api/ai/search');
vi.mock('../../api/search/get-metadata');
vi.mock('../../api/books/get-books-by-ids');

const mockedAiSearch = vi.mocked(aiSearch);
const mockedGetMetadata = vi.mocked(getMetadata);
const mockedGetBooksByGoogleIds = vi.mocked(getBooksByGoogleIds);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
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
  render(<RouterProvider router={router} />);
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
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books',
    ...overrides,
  };
}

describe('SearchPage', () => {
  beforeEach(() => {
    mockedAiSearch.mockReset();
    mockedGetMetadata.mockReset();
    mockedGetBooksByGoogleIds.mockReset();
    mockedGetBooksByGoogleIds.mockResolvedValue({ books: [] });
  });

  afterEach(() => {
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
      expect.objectContaining({ query: 'thriller', inLibraryOnly: false }),
    );
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
      ),
    );
  });

  it('shows the empty state when there are no results', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: 'zzz' });

    renderSearchPage('/search?q=zzz');

    expect(await screen.findByText('No books match.')).toBeInTheDocument();
  });

  it('passes inLibraryOnly through when the toggle is on', async () => {
    mockedAiSearch.mockResolvedValue({ books: [], query: 'thriller' });

    renderSearchPage('/search?q=thriller');
    await waitFor(() => expect(mockedAiSearch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('In my library only'));

    await waitFor(() =>
      expect(mockedAiSearch).toHaveBeenCalledWith(expect.objectContaining({ inLibraryOnly: true })),
    );
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

  it('resolves Claude-suggested results (no id) via the metadata endpoint for covers/click targets', async () => {
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
    mockedGetMetadata.mockResolvedValue({
      books: [
        makeBook({
          googleBooksId: 'resolved123',
          title: 'Meditations',
          authors: ['Marcus Aurelius'],
          coverUrl: 'https://covers.example.com/meditations.jpg',
        }),
      ],
    });

    renderSearchPage('/search?q=stoicism');

    await screen.findByRole('button', { name: /Meditations/ });
    expect(mockedGetMetadata).toHaveBeenCalledWith([{ title: 'Meditations', author: 'Marcus Aurelius' }]);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: /Meditations/ }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://books.google.com/books?id=resolved123',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('skips the metadata call entirely when all results already have an id', async () => {
    mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'thriller' });

    renderSearchPage('/search?q=thriller');
    await screen.findByRole('button', { name: /Night Watch/ });

    expect(mockedGetMetadata).not.toHaveBeenCalled();
  });

  it('falls back to the unresolved suggestion when metadata lookup fails', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [makeBook({ googleBooksId: null, openLibraryId: null, title: 'Meditations' })],
      query: 'stoicism',
    });
    mockedGetMetadata.mockRejectedValue(new Error('rate limited'));

    renderSearchPage('/search?q=stoicism');

    expect(await screen.findByRole('button', { name: /Meditations/ })).toBeInTheDocument();
  });

  it('navigates internally when the result resolves to a catalog slug', async () => {
    mockedAiSearch.mockResolvedValue({ books: [makeBook({ googleBooksId: 'abc123' })], query: 'thriller' });
    mockedGetBooksByGoogleIds.mockResolvedValue({
      books: [
        {
          id: 4,
          slug: 'night-watch',
          title: 'Night Watch',
          authorName: 'Lucille Fletcher',
          authorSlug: 'lucille-fletcher',
          year: 2026,
          rating: null,
          coverUrl: null,
          hue: '#6f7a55',
          googleBooksId: 'abc123',
        },
      ],
    });

    renderSearchPage('/search?q=thriller');

    expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
    await waitFor(() => expect(mockedGetBooksByGoogleIds).toHaveBeenCalledWith(['abc123']));

    fireEvent.click(screen.getByRole('button', { name: /Night Watch/ }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/books/night-watch');
  });

  it('opens the Google Books page when a result is clicked', async () => {
    mockedAiSearch.mockResolvedValue({ books: [makeBook()], query: 'thriller' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderSearchPage('/search?q=thriller');

    fireEvent.click(await screen.findByRole('button', { name: /Night Watch/ }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://books.google.com/books?id=abc123',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('shows an error message when the search fails', async () => {
    mockedAiSearch.mockRejectedValue(new Error('network error'));

    renderSearchPage('/search?q=x');

    expect(await screen.findByText(/Could not load search results/)).toBeInTheDocument();
  });
});
