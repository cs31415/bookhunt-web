import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookDetailPage } from './BookDetailPage';
import { getBook } from '../../api/books/get-book';
import { setFavorite } from '../../api/library/set-favorite';
import { getAuthor } from '../../api/authors/get-author';
import { getBooksByIds } from '../../api/books/get-books-by-ids';
import { generateThemes, generateThemesExternal } from '../../api/ai/generate-themes';
import { getLibrary } from '../../api/library/get-library';
import { addToLibrary } from '../../api/library/add-to-library';
import { updateEntry } from '../../api/library/update-entry';
import { removeEntry } from '../../api/library/remove-entry';
import { ApiError } from '../../api/client';

vi.mock('../../api/books/get-book');
vi.mock('../../api/library/set-favorite');
vi.mock('../../api/authors/get-author');
vi.mock('../../api/books/get-books-by-ids');
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
const mockedGenerateThemes = vi.mocked(generateThemes);
const mockedGenerateThemesExternal = vi.mocked(generateThemesExternal);
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
  cataloged: true,
};

const rawAuthor = {
  author: {
    id: 96,
    slug: 'lucille-fletcher',
    name: 'Lucille Fletcher',
    birth_year: 1912,
    bio: 'An American screenwriter and novelist…',
  },
  books: [{ bookId: 95, slug: 'night-watch', title: 'Night Watch', year: 2026, rating: null, coverUrl: null, inLibrary: false, libraryStatus: null }],
};

function setupHappyPathMocks() {
  mockedGetBook.mockResolvedValue({ book: rawBook, inLibrary: false });
  mockedGetAuthor.mockResolvedValue(rawAuthor);
  mockedGetBooksByIds.mockResolvedValue({ books: [] });
  mockedGenerateThemes.mockResolvedValue({ genres: [], themes: [], moods: [] });
  mockedGetLibrary.mockResolvedValue({ entries: [], total: 0, stats: { total: 0, by_status: {} } });
  mockedAddToLibrary.mockResolvedValue({ entry: {}, book: { id: 95, slug: 'night-watch' } });
  mockedUpdateEntry.mockResolvedValue({ entry: {} });
  mockedRemoveEntry.mockResolvedValue(undefined);
}

describe('BookDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  /**
   * A catalog book can have no blurb — an import resolved against Open Library
   * often brings back none — and the page used to crash outright on one, because
   * Hero handed null straight to RichText, which calls .replace on it.
   *
   * The types said that could not happen: both the raw and normalized shapes
   * declared `blurb: string` while the API had always been able to return null,
   * so the compiler never questioned the call. Every other nullable field on
   * those interfaces was correctly marked. This test is the runtime half of
   * that fix (LOS-238).
   */
  it('renders a book whose blurb is null instead of crashing', async () => {
    mockedGetBook.mockResolvedValue({ book: { ...rawBook, blurb: null }, inLibrary: false });

    renderBookDetailPage('night-watch');

    expect(await screen.findByRole('heading', { name: 'Night Watch' })).toBeInTheDocument();
    expect(screen.getAllByText('Lucille Fletcher').length).toBeGreaterThan(0);
  });

  it('shows "Book not found." for an unknown slug', async () => {
    mockedGetBook.mockRejectedValue(new ApiError(404, 'Book not found'));

    renderBookDetailPage('missing-book');

    expect(await screen.findByText('Book not found.')).toBeInTheDocument();
  });

  it('shows the notes section with the rating control', async () => {
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    expect(await screen.findByText('Your rating')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Your review of this book/)).toBeInTheDocument();
  });

  /*
   * The hero used to carry a second, interactive rating beside the catalog's,
   * so a reader saw two of their own scores on one screen and could not tell
   * which counted (LOS-349). The notes section keeps it, since that is where
   * they are already saying what they thought.
   */
  it('gives a reader one place to rate, not two', async () => {
    // The fixture has no catalog rating, so this one supplies it: the point is
    // that the two ratings no longer share a screen, which needs both present.
    mockedGetBook.mockResolvedValue({ book: { ...rawBook, rating: 4.2 }, inLibrary: false });
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });
    await screen.findByText('Your rating');

    // The catalog's figure stays, and stays labelled as the catalog's.
    expect(screen.getByText('Average rating')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.queryByText('My rating')).not.toBeInTheDocument();
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

  it('adds the book to the library when the "Add to library" button is clicked', async () => {
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));

    await waitFor(() => expect(mockedAddToLibrary).toHaveBeenCalledWith('night-watch', 'queued', undefined));
  });

  it('disables the "Add to library" button and shows a pending label while the add is in flight', async () => {
    let resolveAdd!: (value: Awaited<ReturnType<typeof addToLibrary>>) => void;
    mockedAddToLibrary.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAdd = resolve;
      }),
    );

    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));

    const pendingButton = await screen.findByRole('button', { name: 'Adding…' });
    expect(pendingButton).toBeDisabled();

    resolveAdd({ entry: {}, book: { id: 95, slug: 'night-watch' } });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add to library' })).not.toBeDisabled(),
    );
  });

  // Saved on the button now, not on a debounce: typing wrote mid-sentence and
  // the reload that followed threw the reader back to the top (LOS-353).
  it('adds the book to the library before saving a note (AC12), in order', async () => {
    renderBookDetailPage('night-watch');
    await screen.findByRole('heading', { name: 'Night Watch' });

    const textarea = await screen.findByPlaceholderText(/Your review of this book/);
    fireEvent.change(textarea, { target: { value: 'A note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedUpdateEntry).toHaveBeenCalledWith(95, { notes: 'A note' }));
    const addOrder = mockedAddToLibrary.mock.invocationCallOrder[0];
    const updateOrder = mockedUpdateEntry.mock.invocationCallOrder[mockedUpdateEntry.mock.calls.length - 1];
    expect(addOrder).toBeLessThan(updateOrder);
  });

  describe('ephemeral (not-yet-cataloged) book', () => {
    const rawEphemeralBook = {
      id: 0,
      slug: 'sapiens',
      title: 'Sapiens',
      author_id: 0,
      year: 2015,
      publisher: 'Harper',
      pages: 443,
      rating: 4.5,
      subjects: ['History'],
      moods: [],
      genres: [],
      themes: [],
      hue: '#6f7a55',
      blurb: 'A brief history of humankind.',
      cover_url: 'https://x/y.jpg',
      google_books_id: 'gid123',
      isbn13: '9780062316097',
      language: 'en',
      related: [],
      author_name: 'Yuval Noah Harari',
      author_slug: 'yuval-noah-harari',
      cataloged: false,
    };

    beforeEach(() => {
      mockedGetBook.mockResolvedValue({ book: rawEphemeralBook, inLibrary: false });
      mockedGenerateThemesExternal.mockResolvedValue({ genres: [], themes: [], moods: [] });
    });

    it('renders using the live-resolved data and skips author/related fetches', async () => {
      renderBookDetailPage('sapiens?a=yuval-noah-harari');

      expect(await screen.findByRole('heading', { name: 'Sapiens' })).toBeInTheDocument();
      // The blurb is rendered in Hero.
      expect((await screen.findAllByText('A brief history of humankind.')).length).toBeGreaterThan(0);
      expect(mockedGetAuthor).not.toHaveBeenCalled();
      expect(mockedGetBooksByIds).not.toHaveBeenCalled();
    });

    it('passes the pid query param through to getBook (LOS-135)', async () => {
      renderBookDetailPage('sapiens?a=yuval-noah-harari&pid=g%3Agid123');
      await screen.findByRole('heading', { name: 'Sapiens' });

      expect(mockedGetBook).toHaveBeenCalledWith('sapiens', {
        authorSlug: 'yuval-noah-harari',
        pid: 'g:gid123',
      });
    });

    it('omits pid when the URL has none', async () => {
      renderBookDetailPage('sapiens?a=yuval-noah-harari');
      await screen.findByRole('heading', { name: 'Sapiens' });

      expect(mockedGetBook).toHaveBeenCalledWith('sapiens', {
        authorSlug: 'yuval-noah-harari',
        pid: undefined,
      });
    });

    it('generates themes via the external endpoint instead of the bookId-based one', async () => {
      renderBookDetailPage('sapiens?a=yuval-noah-harari');
      await screen.findByRole('heading', { name: 'Sapiens' });

      await waitFor(() =>
        expect(mockedGenerateThemesExternal).toHaveBeenCalledWith('Sapiens', 'Yuval Noah Harari'),
      );
      expect(mockedGenerateThemes).not.toHaveBeenCalled();
    });

    it('creates the catalog row on add and canonicalizes the URL to the real slug', async () => {
      mockedAddToLibrary.mockResolvedValue({ entry: {}, book: { id: 42, slug: 'sapiens' } });

      renderBookDetailPage('sapiens?a=yuval-noah-harari');
      await screen.findByRole('heading', { name: 'Sapiens' });

      fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));

      await waitFor(() =>
        expect(mockedAddToLibrary).toHaveBeenCalledWith(
          'sapiens',
          'queued',
          expect.objectContaining({ title: 'Sapiens', authorName: 'Yuval Noah Harari', googleBooksId: 'gid123' }),
        ),
      );
      expect(await screen.findByTestId('location')).toHaveTextContent('/books/sapiens');
    });
  });

  /**
   * A book already in the library had no way off the shelf from its own page:
   * handleToggleLibrary could remove, but the button calling it only rendered
   * when the book was *not* in the library (LOS-206). Remove now stands beside
   * the status menu as its own button rather than inside it (LOS-207).
   */
  describe('removing from the library', () => {
    function inLibrary() {
      mockedGetBook.mockResolvedValue({
        book: rawBook,
        inLibrary: true,
        libraryEntry: { status: 'reading', userRating: 0, notes: '', userRelatedIds: [] },
      } as never);
    }

    it('offers Remove as a button, without opening the status menu', async () => {
      inLibrary();
      renderBookDetailPage('night-watch');

      expect(await screen.findByRole('button', { name: 'Remove from library' })).toBeInTheDocument();
    });

    it('keeps the status menu to statuses only', async () => {
      inLibrary();
      renderBookDetailPage('night-watch');

      fireEvent.click(await screen.findByRole('button', { name: 'Reading' }));
      expect(screen.queryByRole('menuitem', { name: 'Remove from library' })).not.toBeInTheDocument();
    });

    it('confirms before removing, and names what is lost', async () => {
      inLibrary();
      renderBookDetailPage('night-watch');

      fireEvent.click(await screen.findByRole('button', { name: 'Remove from library' }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(/rating, review and notes/);
      expect(mockedRemoveEntry).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
      await waitFor(() => expect(mockedRemoveEntry).toHaveBeenCalledWith(rawBook.id));
    });

    it('does not remove when the confirmation is cancelled', async () => {
      inLibrary();
      renderBookDetailPage('night-watch');

      fireEvent.click(await screen.findByRole('button', { name: 'Remove from library' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockedRemoveEntry).not.toHaveBeenCalled();
    });

    it('offers no Remove for a book not in the library', async () => {
      renderBookDetailPage('night-watch');

      expect(await screen.findByRole('button', { name: /Add to library/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove from library' })).not.toBeInTheDocument();
    });
  });

  /**
   * The heart was specified in LOS-252 and only landed on the library grid; it
   * belongs anywhere a book is shown.
   */
  describe('favouriting from the book page', () => {
    const mockedSetFavorite = vi.mocked(setFavorite);

    function inLibrary(isFavorite = false) {
      mockedSetFavorite.mockReset();
      mockedSetFavorite.mockResolvedValue({
        entry: { user_id: 1, book_id: 1, is_favorite: !isFavorite, is_hidden: false },
      });
      mockedGetBook.mockResolvedValue({
        book: rawBook,
        inLibrary: true,
        libraryEntry: {
          status: 'reading',
          user_rating: 0,
          notes: '',
          user_related: [],
          is_favorite: isFavorite,
        },
      } as never);
    }

    it('offers the heart once the book is owned', async () => {
      inLibrary();
      renderBookDetailPage('night-watch');

      const heart = await screen.findByRole('button', { name: 'Favourite' });
      expect(heart).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows the flag the server already sent', async () => {
      inLibrary(true);
      renderBookDetailPage('night-watch');

      expect(await screen.findByRole('button', { name: 'Favourite' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('answers the click before the request settles', async () => {
      inLibrary();
      renderBookDetailPage('night-watch');

      fireEvent.click(await screen.findByRole('button', { name: 'Favourite' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Favourite' })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      });
      expect(mockedSetFavorite).toHaveBeenCalledWith(rawBook.id, true);
    });

    it('rolls back when the request fails', async () => {
      inLibrary();
      mockedSetFavorite.mockRejectedValue(new Error('network down'));
      renderBookDetailPage('night-watch');

      fireEvent.click(await screen.findByRole('button', { name: 'Favourite' }));

      // Falls through to what the server last said, rather than to a
      // remembered value -- right even if two toggles raced.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Favourite' })).toHaveAttribute(
          'aria-pressed',
          'false',
        );
      });
    });

    it('offers no heart for a book that is not owned', async () => {
      mockedGetBook.mockResolvedValue({ book: rawBook, inLibrary: false } as never);
      renderBookDetailPage('night-watch');

      await screen.findByRole('button', { name: /add to library/i });
      expect(screen.queryByRole('button', { name: 'Favourite' })).not.toBeInTheDocument();
    });
  });
});
