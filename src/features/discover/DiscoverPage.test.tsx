import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverPage } from './DiscoverPage';
import { ApiError } from '../../api/client';
import { getLibrary } from '../../api/library/get-library';
import { getRecommendations } from '../../api/recommendations/get-recommendations';
import { getCannedSearches } from '../../api/canned-searches/get-canned-searches';
import { pinCannedSearch, saveCannedSearch } from '../../api/canned-searches/pin-canned-search';
import { AuthProvider } from '../auth/AuthContext';

vi.mock('../../api/library/get-library');
// Still mocked, but only so the "no recommendations request" test below can
// assert it stays untouched (LOS-211).
vi.mock('../../api/recommendations/get-recommendations');
vi.mock('../../api/canned-searches/get-canned-searches');
vi.mock('../../api/canned-searches/pin-canned-search');

const mockedGetLibrary = vi.mocked(getLibrary);
const mockedGetRecommendations = vi.mocked(getRecommendations);
const mockedGetCannedSearches = vi.mocked(getCannedSearches);
const mockedPinCannedSearch = vi.mocked(pinCannedSearch);
const mockedSaveCannedSearch = vi.mocked(saveCannedSearch);

const DOSTOEVSKY = 'where should I start with Dostoevsky';

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
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
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
  beforeEach(() => {
    localStorage.clear();
    mockedGetCannedSearches.mockResolvedValue({
      pinned: [],
      suggested: [{ id: 41, query: DOSTOEVSKY, category: 'entry-point' }],
      history: [],
    });
  });

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
      expect(screen.getByText(DOSTOEVSKY)).toBeInTheDocument(),
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

    fireEvent.click(await screen.findByText(DOSTOEVSKY));
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

    await screen.findByText(DOSTOEVSKY);
    expect(screen.queryByText(/Could not load your Discover page/)).not.toBeInTheDocument();
  });

  describe('the canned search pills (LOS-212)', () => {
    beforeEach(() => {
      mockedGetLibrary.mockResolvedValue({
        entries: [],
        total: 0,
        stats: { total: 0, by_status: {} },
      });
    });

    it('draws them from the catalog, pinned ones first', async () => {
      mockedGetCannedSearches.mockResolvedValue({
        pinned: [{ id: 9, query: 'books about fungi', category: 'science' }],
        suggested: [{ id: 41, query: DOSTOEVSKY, category: 'literature' }],
        history: [],
      });

      renderDiscoverPage();

      await screen.findByText('books about fungi');
      expect(screen.getByText(DOSTOEVSKY)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Unpin books about fungi' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    // The pills are the only content on a logged-out Discover page, so losing
    // the catalog must not leave a bare search box.
    it('falls back to the built-in queries when the catalog cannot be reached', async () => {
      mockedGetCannedSearches.mockRejectedValue(new Error('network error'));

      renderDiscoverPage();

      await screen.findByText(DOSTOEVSKY);
      // Nothing real to pin against or redraw from, so both controls go.
      expect(screen.queryByRole('button', { name: /^Pin / })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Show different searches' }),
      ).not.toBeInTheDocument();
    });

    it('sends a guest the pins held in their browser', async () => {
      localStorage.setItem('bookhunt_guest_pinned_searches', JSON.stringify([12, 88]));

      renderDiscoverPage();

      await screen.findByText(DOSTOEVSKY);
      expect(mockedGetCannedSearches).toHaveBeenCalledWith(
        expect.objectContaining({ pinnedIds: [12, 88] }),
      );
    });

    it('saves a guest pin to the browser rather than the server', async () => {
      renderDiscoverPage();

      fireEvent.click(await screen.findByRole('button', { name: `Pin ${DOSTOEVSKY}` }));

      await waitFor(() =>
        expect(localStorage.getItem('bookhunt_guest_pinned_searches')).toBe('[41]'),
      );
      expect(mockedPinCannedSearch).not.toHaveBeenCalled();
    });

    it('keeps an unpinned pill in the row as a suggestion, so a misclick is one click back', async () => {
      renderDiscoverPage();

      fireEvent.click(await screen.findByRole('button', { name: `Pin ${DOSTOEVSKY}` }));
      fireEvent.click(await screen.findByRole('button', { name: `Unpin ${DOSTOEVSKY}` }));

      expect(screen.getByText(DOSTOEVSKY)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Pin ${DOSTOEVSKY}` })).toBeInTheDocument();
    });

    // The row used to redraw on every page load, so a reader who spotted
    // something, followed a link and came back could never find it again.
    it('restores the current row rather than asking for a new one on load', async () => {
      renderDiscoverPage();

      await screen.findByText(DOSTOEVSKY);
      expect(mockedGetCannedSearches).toHaveBeenCalledWith(
        expect.objectContaining({ refresh: false }),
      );
    });

    it('sends a guest the row they were looking at, so a reload does not change it', async () => {
      localStorage.setItem('bookhunt_guest_current_draw', JSON.stringify([41, 42]));

      renderDiscoverPage();

      await screen.findByText(DOSTOEVSKY);
      expect(mockedGetCannedSearches).toHaveBeenCalledWith(
        expect.objectContaining({ drawIds: [41, 42] }),
      );
    });

    it('asks for a new row only when the refresh glyph is clicked', async () => {
      renderDiscoverPage();
      await screen.findByText(DOSTOEVSKY);

      fireEvent.click(screen.getByRole('button', { name: 'Show different searches' }));

      await waitFor(() =>
        expect(mockedGetCannedSearches).toHaveBeenCalledWith(
          expect.objectContaining({ refresh: true }),
        ),
      );
    });

    // A transient failure used to swap in the fallback list, which looked like
    // a successful refresh while silently removing the pin and refresh controls.
    it('keeps the current row and its controls when a refresh fails', async () => {
      renderDiscoverPage();
      await screen.findByText(DOSTOEVSKY);

      mockedGetCannedSearches.mockRejectedValueOnce(new Error('network error'));
      fireEvent.click(screen.getByRole('button', { name: 'Show different searches' }));

      expect(await screen.findByText(/Could not load new searches/)).toBeInTheDocument();
      expect(screen.getByText(DOSTOEVSKY)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show different searches' }),
      ).toBeInTheDocument();
    });

    describe('walking the draw history', () => {
      it('steps back to the previous row and forward again without refetching', async () => {
        mockedGetCannedSearches.mockResolvedValue({
          pinned: [],
          suggested: [{ id: 41, query: DOSTOEVSKY, category: 'literature' }],
          history: [[{ id: 7, query: 'books about lighthouses', category: 'nature' }]],
        });

        renderDiscoverPage();
        await screen.findByText(DOSTOEVSKY);
        const callsAfterLoad = mockedGetCannedSearches.mock.calls.length;

        fireEvent.click(screen.getByRole('button', { name: 'Previous searches' }));

        expect(await screen.findByText('books about lighthouses')).toBeInTheDocument();
        expect(screen.queryByText(DOSTOEVSKY)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Next searches' }));

        expect(await screen.findByText(DOSTOEVSKY)).toBeInTheDocument();
        // Walking history is a view over rows already fetched.
        expect(mockedGetCannedSearches.mock.calls.length).toBe(callsAfterLoad);
      });

      it('marks the ends of the history without going anywhere', async () => {
        renderDiscoverPage();
        await screen.findByText(DOSTOEVSKY);

        // No earlier draws, so both directions are spent from the start.
        expect(screen.getByRole('button', { name: 'Previous searches' })).toHaveAttribute(
          'aria-disabled',
          'true',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Previous searches' }));
        expect(screen.getByText(DOSTOEVSKY)).toBeInTheDocument();
      });
    });

    // Regression: the mounted ref was cleared by StrictMode's first cleanup and
    // never restored, so every update behind an awaited request was skipped and
    // a save that succeeded server-side left the UI untouched.
    it('shows a saved search as a pinned pill', async () => {
      localStorage.setItem(
        'bookhunt_user',
        JSON.stringify({ id: 4, email: 'a@b.com', displayName: 'A' }),
      );
      mockedSaveCannedSearch.mockResolvedValue({
        id: 900,
        query: 'novels about map makers who lied',
        category: 'saved',
      });

      renderDiscoverPage();
      await screen.findByText(DOSTOEVSKY);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'novels about map makers who lied' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Keep this search as a pill/ }));

      expect(
        await screen.findByRole('button', { name: 'Unpin novels about map makers who lied' }),
      ).toBeInTheDocument();
      expect(mockedSaveCannedSearch).toHaveBeenCalledWith('novels about map makers who lied');
    });

    it('offers no save affordance to a guest, who has nowhere to keep one', async () => {
      renderDiscoverPage();
      await screen.findByText(DOSTOEVSKY);

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novels about bees' } });

      expect(
        screen.queryByRole('button', { name: /Keep this search as a pill/ }),
      ).not.toBeInTheDocument();
    });

    it('draws a new sample when the refresh glyph is clicked', async () => {
      renderDiscoverPage();
      await screen.findByText(DOSTOEVSKY);

      mockedGetCannedSearches.mockResolvedValue({
        pinned: [],
        suggested: [{ id: 7, query: 'books about lighthouses', category: 'nature' }],
        history: [],
      });
      fireEvent.click(screen.getByRole('button', { name: 'Show different searches' }));

      expect(await screen.findByText('books about lighthouses')).toBeInTheDocument();
      expect(screen.queryByText(DOSTOEVSKY)).not.toBeInTheDocument();
    });
  });
});
