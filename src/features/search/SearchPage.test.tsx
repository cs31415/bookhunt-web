import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';
import { aiSearch } from '../../api/ai/search';
import type { RawAiSearchBook } from '../../normalize/search';

vi.mock('../../api/ai/search');

const mockedAiSearch = vi.mocked(aiSearch);

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
    moods: [],
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books',
    ...overrides,
  };
}

describe('SearchPage', () => {
  beforeEach(() => {
    mockedAiSearch.mockReset();
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
      expect.anything(),
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
        expect.anything(),
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
      expect(mockedAiSearch).toHaveBeenCalledWith(
        expect.objectContaining({ inLibraryOnly: true }),
        expect.anything(),
      ),
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

  it('renders a Claude-suggested result (no id, no cover) without an extra metadata fetch', async () => {
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

  it('navigates synchronously to a slugified book/author reference when a result is clicked', async () => {
    mockedAiSearch.mockResolvedValue({
      books: [makeBook({ title: 'Night Watch', authors: ['Lucille Fletcher'] })],
      query: 'thriller',
    });

    renderSearchPage('/search?q=thriller');

    fireEvent.click(await screen.findByRole('button', { name: /Night Watch/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/books/night-watch?a=lucille-fletcher');
  });

  it('shows an error message when the search fails', async () => {
    mockedAiSearch.mockRejectedValue(new Error('network error'));

    renderSearchPage('/search?q=x');

    expect(await screen.findByText(/Could not load search results/)).toBeInTheDocument();
  });
});
