import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookDetailPage } from './BookDetailPage';
import { getBook } from '../../api/books/get-book';
import { getAuthor } from '../../api/authors/get-author';
import { getBooksByIds } from '../../api/books/get-books-by-ids';
import { getSummary } from '../../api/ai/get-summary';
import { generateThemes } from '../../api/ai/generate-themes';
import { getLibrary } from '../../api/library/get-library';
import { addToLibrary } from '../../api/library/add-to-library';
import { updateEntry } from '../../api/library/update-entry';
import { removeEntry } from '../../api/library/remove-entry';
import { ApiError } from '../../api/client';

vi.mock('../../api/books/get-book');
vi.mock('../../api/authors/get-author');
vi.mock('../../api/books/get-books-by-ids');
vi.mock('../../api/ai/get-summary');
vi.mock('../../api/ai/generate-themes');
vi.mock('../../api/library/get-library');
vi.mock('../../api/library/add-to-library');
vi.mock('../../api/library/update-entry');
vi.mock('../../api/library/remove-entry');
vi.mock('../../api/library/add-related');
vi.mock('../../api/library/remove-related');

const mockedGetBook = vi.mocked(getBook);
const mockedGetAuthor = vi.mocked(getAuthor);
const mockedGetBooksByIds = vi.mocked(getBooksByIds);
const mockedGetSummary = vi.mocked(getSummary);
const mockedGenerateThemes = vi.mocked(generateThemes);
const mockedGetLibrary = vi.mocked(getLibrary);
const mockedAddToLibrary = vi.mocked(addToLibrary);
const mockedUpdateEntry = vi.mocked(updateEntry);
const mockedRemoveEntry = vi.mocked(removeEntry);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderBookDetailPage(slug: string) {
  const element = (
    <>
      <BookDetailPage />
      <LocationProbe />
    </>
  );
  const router = createMemoryRouter(
    [
      { path: '/books/:slug', element },
      { path: '/search', element: <LocationProbe /> },
      { path: '/authors/:slug', element: <LocationProbe /> },
    ],
    { initialEntries: [`/books/${slug}`] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const rawBook = {
  id: 95,
  slug: 'night-watch',
  title: 'Night Watch',
  author_id: 96,
  year: 2026,
  publisher: 'Dramatists Play Service Inc',
  pages: 80,
  rating: null,
  subjects: ['Fiction'],
  moods: ['Tense'],
  genres: ['Thriller'],
  themes: ['Suspense'],
  hue: '#6f7a55',
  blurb: 'An outstanding Broadway success…',
  cover_url: null,
  google_books_id: 'iD_Pg6P6gt0C',
  isbn13: '9780822208266',
  language: 'en',
  related: [],
  author_name: 'Lucille Fletcher',
  author_slug: 'lucille-fletcher',
};

const rawAuthor = {
  author: {
    id: 96,
    slug: 'lucille-fletcher',
    name: 'Lucille Fletcher',
    birth_year: 1912,
    country: 'United States',
    bio: 'An American screenwriter and novelist…',
  },
  books: [{ bookId: 95, slug: 'night-watch', title: 'Night Watch', year: 2026, rating: null, coverUrl: null, inLibrary: false, libraryStatus: null }],
};

function setupHappyPathMocks() {
  mockedGetBook.mockResolvedValue({ book: rawBook, inLibrary: false });
  mockedGetAuthor.mockResolvedValue(rawAuthor);
  mockedGetBooksByIds.mockResolvedValue({ books: [] });
  mockedGetSummary.mockResolvedValue({ bookId: 95, summary: 'A gripping summary.', generatedAt: null });
  mockedGenerateThemes.mockResolvedValue({ genres: [], themes: [], moods: [] });
  mockedGetLibrary.mockResolvedValue({ entries: [], stats: { total: 0, by_status: {} } });
  mockedAddToLibrary.mockResolvedValue({ entry: {} });
  mockedUpdateEntry.mockResolvedValue({ entry: {} });
  mockedRemoveEntry.mockResolvedValue(undefined);
}

describe('BookDetailPage', () => {
  beforeEach(() => {
    setupHappyPathMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the hero with title and author for a catalog book', async () => {
    renderBookDetailPage('night-watch');

    expect(await screen.findByRole('heading', { name: 'Night Watch' })).toBeInTheDocument();
    expect(screen.getAllByText('Lucille Fletcher').length).toBeGreaterThan(0);
  });

  it('shows "Book not found." for an unknown slug', async () => {
    mockedGetBook.mockRejectedValue(new ApiError(404, 'Book not found'));

    renderBookDetailPage('missing-book');

    expect(await screen.findByText('Book not found.')).toBeInTheDocument();
  });

  it('shows the AI summary once loaded on the Summary tab', async () => {
    renderBookDetailPage('night-watch');

    expect(await screen.findByText('A gripping summary.')).toBeInTheDocument();
  });

  it('switches to the My Notes tab and shows the rating control', async () => {
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(screen.getByRole('button', { name: 'My notes' }));

    expect(await screen.findByText('Your rating')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Quotes, page references/)).toBeInTheDocument();
  });

  it('navigates to search with the theme flag when a theme pill is clicked', async () => {
    // rawBook already has genres/themes populated, so useThemes uses them
    // directly without calling generateThemes (matches the "already
    // populated" fast path — see useThemes.ts).
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(await screen.findByRole('button', { name: 'Thriller' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=Thriller&theme=true');
  });

  it('backfills moods via generateThemes when genres/themes exist but moods is empty (pre-feature data)', async () => {
    mockedGetBook.mockResolvedValue({ book: { ...rawBook, moods: [] }, inLibrary: false });
    mockedGenerateThemes.mockResolvedValue({ genres: ['Thriller'], themes: ['Suspense'], moods: ['Tense'] });

    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    expect(await screen.findByRole('button', { name: 'Tense' })).toBeInTheDocument();
    expect(mockedGenerateThemes).toHaveBeenCalledWith(95);
  });

  it('navigates to search with a translated text query when a mood pill is clicked', async () => {
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(await screen.findByRole('button', { name: 'Tense' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/search?q=${encodeURIComponent('books that feel Tense')}&mood=Tense`,
    );
  });

  it('adds the book to the library when the cover +/- button is clicked', async () => {
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(screen.getByTitle('Add to library'));

    await waitFor(() => expect(mockedAddToLibrary).toHaveBeenCalledWith(95, 'queued'));
  });

  it('adds the book to the library before saving a note (AC12), in order', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(screen.getByRole('button', { name: 'My notes' }));
    const textarea = await screen.findByPlaceholderText(/Quotes, page references/);
    fireEvent.change(textarea, { target: { value: 'A note' } });

    await vi.advanceTimersByTimeAsync(600);

    await waitFor(() => expect(mockedUpdateEntry).toHaveBeenCalledWith(95, { notes: 'A note' }));
    const addOrder = mockedAddToLibrary.mock.invocationCallOrder[0];
    const updateOrder = mockedUpdateEntry.mock.invocationCallOrder[mockedUpdateEntry.mock.calls.length - 1];
    expect(addOrder).toBeLessThan(updateOrder);
  });
});
