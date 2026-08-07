import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DiscoverPage } from './DiscoverPage';
import { ApiError } from '../../api/client';
import { getLibrary } from '../../api/library/get-library';
import { getRecommendations } from '../../api/recommendations/get-recommendations';

vi.mock('../../api/library/get-library');
// Still mocked, but only so the "no recommendations request" test below can
// assert it stays untouched (LOS-211).
vi.mock('../../api/recommendations/get-recommendations');

const mockedGetLibrary = vi.mocked(getLibrary);
const mockedGetRecommendations = vi.mocked(getRecommendations);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderDiscoverPage() {
  const discoverElement = (
    <>
      <DiscoverPage />
      <LocationProbe />
    </>
  );
  const router = createMemoryRouter(
    [
      { path: '/', element: discoverElement },
      { path: '/search', element: <LocationProbe /> },
      { path: '/library', element: <LocationProbe /> },
      { path: '/books/:slug', element: <LocationProbe /> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const readingEntry = {
  book_id: 1,
  status: 'reading' as const,
  notes: 'Slow start but picking up',
  review: null,
  title: 'Dune',
  book_slug: 'dune',
  author_name: 'Frank Herbert',
  author_slug: 'frank-herbert',
  year: 1965,
  rating: 4.5,
  cover_url: null,
  hue: '#6f7a55',
};

describe('DiscoverPage', () => {
  it('shows Currently Reading when the library has reading-status entries', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [readingEntry],
      total: 4,
      stats: { total: 4, by_status: { reading: 1, finished: 3 } },
    });

    renderDiscoverPage();

    expect(await screen.findByText('Currently reading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
  });

  // LOS-211 pared the page back to the hero, the pills, and Currently Reading.
  it('renders neither Recommended nor the Library snapshot', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [readingEntry],
      total: 4,
      stats: { total: 4, by_status: { reading: 1, finished: 3 } },
    });

    renderDiscoverPage();

    await screen.findByText('Currently reading');
    expect(screen.queryByText('Recommended for you')).not.toBeInTheDocument();
    expect(screen.queryByText('See more')).not.toBeInTheDocument();
    expect(screen.queryByText('4 books, and counting')).not.toBeInTheDocument();
    expect(screen.queryByText('Your reading breakdown appears here')).not.toBeInTheDocument();
  });

  // The section is gone, so the request backing it should be too — otherwise
  // every Discover load pays for a response nothing renders.
  it('makes no recommendations request', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [readingEntry],
      total: 1,
      stats: { total: 1, by_status: { reading: 1 } },
    });

    renderDiscoverPage();

    await screen.findByText('Currently reading');
    expect(mockedGetRecommendations).not.toHaveBeenCalled();
  });

  it('hides Currently Reading when there are no reading-status books', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [],
      total: 0,
      stats: { total: 0, by_status: {} },
    });

    renderDiscoverPage();

    // The hero is all that is left, so wait on it rather than on a section.
    await waitFor(() =>
      expect(screen.getByText('where should I start with Dostoevsky')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Currently reading')).not.toBeInTheDocument();
  });

  it('navigates to the book detail page when a BookCard is clicked', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [readingEntry],
      total: 1,
      stats: { total: 1, by_status: { reading: 1 } },
    });

    renderDiscoverPage();

    fireEvent.click(await screen.findByRole('button', { name: /Dune/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/books/dune');
  });

  // /search stays routable after LOS-211 dropped it from the nav; the pills and
  // the hero search bar are now the way in.
  it('navigates to Search with the query when an example pill is clicked', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], total: 0, stats: { total: 0, by_status: {} } });

    renderDiscoverPage();

    fireEvent.click(await screen.findByText('where should I start with Dostoevsky'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?q=where%20should%20I%20start%20with%20Dostoevsky',
    );
  });

  it('shows an error message when the data fails to load', async () => {
    mockedGetLibrary.mockRejectedValue(new Error('network error'));

    renderDiscoverPage();

    expect(await screen.findByText(/Could not load your Discover page/)).toBeInTheDocument();
  });

  it('stays quiet (no error banner) when the call 401s because the visitor is logged out', async () => {
    mockedGetLibrary.mockRejectedValue(new ApiError(401, 'Authentication required'));

    renderDiscoverPage();

    await screen.findByText('where should I start with Dostoevsky');
    expect(screen.queryByText(/Could not load your Discover page/)).not.toBeInTheDocument();
  });
});
