import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';
import { getSearch } from '../../api/search/get-search';
import { getFacets } from '../../api/search/get-facets';

vi.mock('../../api/search/get-search');
vi.mock('../../api/search/get-facets');

const mockedGetSearch = vi.mocked(getSearch);
const mockedGetFacets = vi.mocked(getFacets);

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

const rawBook = {
  book_id: 95,
  slug: 'night-watch',
  title: 'Night Watch',
  author_name: 'Lucille Fletcher',
  author_slug: 'lucille-fletcher',
  year: 2026,
  rating: null,
  cover_url: null,
  hue: '#6f7a55',
  in_library: false,
  library_status: null,
};

describe('SearchPage', () => {
  beforeEach(() => {
    mockedGetFacets.mockResolvedValue({ subjects: ['History', 'Fiction'], moods: ['Lyrical'] });
  });

  it('shows results and count for a query', async () => {
    mockedGetSearch.mockResolvedValue({ books: [rawBook], total: 1, page: 1, pageSize: 24, query: 'thriller' });

    renderSearchPage('/search?q=thriller');

    expect(await screen.findByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
    expect(screen.getByText(/Results for/)).toBeInTheDocument();
    expect(screen.getByText('1 book')).toBeInTheDocument();
    expect(mockedGetSearch).toHaveBeenCalledWith(expect.objectContaining({ q: 'thriller', page: 1 }));
  });

  it('shows the theme heading when arriving via a theme pill', async () => {
    mockedGetSearch.mockResolvedValue({ books: [], total: 0, page: 1, pageSize: 24, query: '' });

    renderSearchPage('/search?q=guilt+and+redemption&theme=true');

    expect(await screen.findByText(/Books on the theme of/)).toBeInTheDocument();
  });

  it('shows the mood heading when arriving via a mood pill', async () => {
    mockedGetSearch.mockResolvedValue({ books: [], total: 0, page: 1, pageSize: 24, query: '' });

    renderSearchPage('/search?mood=Lyrical');

    const heading = await screen.findByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Books that feel Lyrical');
    await waitFor(() =>
      expect(mockedGetSearch).toHaveBeenCalledWith(expect.objectContaining({ moods: ['Lyrical'] })),
    );
  });

  it('shows the empty state when there are no results', async () => {
    mockedGetSearch.mockResolvedValue({ books: [], total: 0, page: 1, pageSize: 24, query: 'zzz' });

    renderSearchPage('/search?q=zzz');

    expect(await screen.findByText('No books match.')).toBeInTheDocument();
  });

  it('applies a category filter and shows Clear filters', async () => {
    mockedGetSearch.mockResolvedValue({ books: [rawBook], total: 1, page: 1, pageSize: 24, query: '' });

    renderSearchPage('/search');

    fireEvent.click(await screen.findByText('History'));

    await waitFor(() =>
      expect(mockedGetSearch).toHaveBeenCalledWith(expect.objectContaining({ subjects: ['History'] })),
    );
    expect(await screen.findByText('Clear filters')).toBeInTheDocument();
  });

  it('sorts by highest rated', async () => {
    mockedGetSearch.mockResolvedValue({ books: [rawBook], total: 1, page: 1, pageSize: 24, query: '' });

    renderSearchPage('/search');
    await screen.findByRole('button', { name: /Night Watch/ });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rating' } });

    await waitFor(() =>
      expect(mockedGetSearch).toHaveBeenCalledWith(expect.objectContaining({ sort: 'rating' })),
    );
  });

  it('navigates to book detail when a result is clicked', async () => {
    mockedGetSearch.mockResolvedValue({ books: [rawBook], total: 1, page: 1, pageSize: 24, query: '' });

    renderSearchPage('/search');

    fireEvent.click(await screen.findByRole('button', { name: /Night Watch/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/books/night-watch');
  });

  it('shows an error message when the search fails', async () => {
    mockedGetSearch.mockRejectedValue(new Error('network error'));

    renderSearchPage('/search?q=x');

    expect(await screen.findByText(/Could not load search results/)).toBeInTheDocument();
  });
});
