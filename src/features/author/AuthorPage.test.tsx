import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorPage } from './AuthorPage';
import { AuthProvider } from '../auth/AuthContext';
import { getAuthor } from '../../api/authors/get-author';
import { ApiError } from '../../api/client';
import type { RawAuthorWork, RawGetAuthorResponse } from '../../normalize/author';

vi.mock('../../api/authors/get-author');

const mockedGetAuthor = vi.mocked(getAuthor);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function makeWork(overrides: Partial<RawAuthorWork> = {}): RawAuthorWork {
  return {
    bookId: 95,
    slug: 'night-watch',
    title: 'Night Watch',
    year: 2026,
    rating: null,
    coverUrl: null,
    inLibrary: false,
    libraryStatus: null,
    ...overrides,
  };
}

function makeResponse(overrides: Partial<RawGetAuthorResponse> = {}): RawGetAuthorResponse {
  return {
    author: {
      id: 96,
      slug: 'lucille-fletcher',
      name: 'Lucille Fletcher',
      birth_year: 1912,
      bio: 'An American screenwriter and novelist.',
    },
    books: [makeWork()],
    ...overrides,
  };
}

function renderAuthorPage(initialEntry = '/authors/lucille-fletcher') {
  const router = createMemoryRouter(
    [
      {
        path: '/authors/:slug',
        element: (
          <>
            <AuthorPage />
            <LocationProbe />
          </>
        ),
      },
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

describe('AuthorPage', () => {
  beforeEach(() => {
    mockedGetAuthor.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the hero with name, bio, meta line and bibliography', async () => {
    mockedGetAuthor.mockResolvedValue(
      makeResponse({
        books: [
          makeWork({ bookId: 1, slug: 'night-watch', title: 'Night Watch' }),
          makeWork({ bookId: 2, slug: 'the-daughters', title: 'The Daughters' }),
          makeWork({ bookId: 3, slug: 'blindfold', title: 'Blindfold' }),
        ],
      }),
    );

    renderAuthorPage();

    expect(await screen.findByRole('heading', { name: 'Lucille Fletcher' })).toBeInTheDocument();
    expect(screen.getByText('An American screenwriter and novelist.')).toBeInTheDocument();
    expect(screen.getByText('b. 1912')).toBeInTheDocument();
    expect(screen.getByText('3 books')).toBeInTheDocument();
    expect(screen.getByText('Books by Lucille Fletcher')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Night Watch/ })).toBeInTheDocument();
  });

  it('uses the singular "book" for a one-book author', async () => {
    mockedGetAuthor.mockResolvedValue(makeResponse({ books: [makeWork()] }));

    renderAuthorPage();

    expect(await screen.findByText('1 book')).toBeInTheDocument();
  });

  it('renders an ancient author with a CE birth year', async () => {
    mockedGetAuthor.mockResolvedValue(
      makeResponse({
        author: {
          id: 7,
          slug: 'marcus-aurelius',
          name: 'Marcus Aurelius',
          birth_year: 121,
          bio: 'Roman emperor and Stoic philosopher.',
        },
        books: [makeWork({ bookId: 10, slug: 'meditations', title: 'Meditations' })],
      }),
    );

    renderAuthorPage('/authors/marcus-aurelius');

    expect(await screen.findByText('b. 121 CE')).toBeInTheDocument();
  });

  it('shows "Author not found." on a 404', async () => {
    mockedGetAuthor.mockRejectedValue(new ApiError(404, 'Not found'));

    renderAuthorPage('/authors/nope');

    expect(await screen.findByText('Author not found.')).toBeInTheDocument();
  });

  it('navigates to Book Detail when a bibliography card is clicked', async () => {
    mockedGetAuthor.mockResolvedValue(makeResponse());

    renderAuthorPage();

    fireEvent.click(await screen.findByRole('button', { name: /Night Watch/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/books/night-watch?a=lucille-fletcher');
  });
});
