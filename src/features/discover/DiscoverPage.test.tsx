import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DiscoverPage } from './DiscoverPage';
import { getLibrary } from '../../api/library/get-library';
import { getRecommendations } from '../../api/recommendations/get-recommendations';

vi.mock('../../api/library/get-library');
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

const recommendation = {
  reason: 'More from Herbert',
  book: {
    id: 2,
    slug: 'the-left-hand-of-darkness',
    title: 'The Left Hand of Darkness',
    authorName: 'Ursula K. Le Guin',
    authorSlug: 'ursula-k-le-guin',
    year: 1969,
    rating: 4,
    coverUrl: null,
    hue: '#4a6670',
  },
};

describe('DiscoverPage', () => {
  it('shows Currently Reading, Recommended, and Library Snapshot when the library has entries', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [readingEntry],
      stats: { total: 4, by_status: { reading: 1, finished: 3 } },
    });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [recommendation] });

    renderDiscoverPage();

    expect(await screen.findByText('Currently reading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.getByText('Recommended for you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Left Hand of Darkness/ })).toBeInTheDocument();
    expect(screen.getByText('More from Herbert')).toBeInTheDocument();
    expect(screen.getByText('4 books, and counting')).toBeInTheDocument();
  });

  it('hides Currently Reading when there are no reading-status books', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [],
      stats: { total: 0, by_status: {} },
    });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [] });

    renderDiscoverPage();

    await waitFor(() => expect(screen.getByText('Start your library')).toBeInTheDocument());
    expect(screen.queryByText('Currently reading')).not.toBeInTheDocument();
  });

  it('shows the empty Library Snapshot state for a new user', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [] });

    renderDiscoverPage();

    expect(await screen.findByText('Start your library')).toBeInTheDocument();
    expect(screen.getByText('Your reading breakdown appears here')).toBeInTheDocument();
  });

  it('navigates to the book detail page when a BookCard is clicked', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [readingEntry],
      stats: { total: 1, by_status: { reading: 1 } },
    });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [] });

    renderDiscoverPage();

    fireEvent.click(await screen.findByRole('button', { name: /Dune/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/books/dune');
  });

  it('navigates to Search with the query when an example pill is clicked', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [] });

    renderDiscoverPage();

    fireEvent.click(await screen.findByText('where should I start with Dostoevsky'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?q=where%20should%20I%20start%20with%20Dostoevsky',
    );
  });

  it('navigates to Search in recommendations mode when See more is clicked', async () => {
    mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [recommendation] });

    renderDiscoverPage();

    fireEvent.click(await screen.findByText('See more'));
    expect(screen.getByTestId('location')).toHaveTextContent('/search?mode=recommendations');
  });

  it('navigates to Library filtered by status when a pie slice is picked', async () => {
    mockedGetLibrary.mockResolvedValue({
      entries: [],
      stats: { total: 3, by_status: { finished: 3 } },
    });
    mockedGetRecommendations.mockResolvedValue({ recommendations: [] });

    renderDiscoverPage();

    fireEvent.click(await screen.findByText('Finished'));
    expect(screen.getByTestId('location')).toHaveTextContent('/library?status=finished');
  });

  it('shows an error message when the data fails to load', async () => {
    mockedGetLibrary.mockRejectedValue(new Error('network error'));
    mockedGetRecommendations.mockResolvedValue({ recommendations: [] });

    renderDiscoverPage();

    expect(await screen.findByText(/Could not load your Discover page/)).toBeInTheDocument();
  });
});
