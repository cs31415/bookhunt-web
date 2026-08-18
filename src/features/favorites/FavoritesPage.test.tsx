import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesPage } from './FavoritesPage';
import { AuthProvider } from '../auth/AuthContext';
import { getLibrary } from '../../api/library/get-library';
import { getMyFavoriteAuthors } from '../../api/users/get-favorite-authors';
import { getFavoriteUsers } from '../../api/users/get-favorite-users';

vi.mock('../../api/library/get-library');
vi.mock('../../api/users/get-favorite-authors');
vi.mock('../../api/users/get-favorite-users');

const mockedLibrary = vi.mocked(getLibrary);
const mockedAuthors = vi.mocked(getMyFavoriteAuthors);
const mockedUsers = vi.mocked(getFavoriteUsers);

function rawEntry(id: number, title: string, isFavorite: boolean) {
  return {
    book_id: id,
    status: 'reading',
    title,
    book_slug: `book-${id}`,
    author_name: 'Carl Sagan',
    author_slug: 'carl-sagan',
    year: 1980,
    rating: null,
    cover_url: null,
    hue: '#000',
    is_favorite: isFavorite,
  };
}

function renderFavorites(path = '/favorites') {
  const router = createMemoryRouter([{ path: '/favorites', element: <FavoritesPage /> }], {
    initialEntries: [path],
  });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    'bookhunt_user',
    JSON.stringify({
      id: 7,
      email: 'a@b.com',
      displayName: 'Ada Reader',
      handle: 'ada',
      isDiscoverable: false,
    }),
  );
  mockedLibrary.mockReset();
  mockedAuthors.mockReset();
  mockedUsers.mockReset();
  mockedLibrary.mockResolvedValue({
    entries: [rawEntry(1, 'Cosmos', true), rawEntry(2, 'Contact', false)] as never,
    total: 2,
    page: 1,
    pageSize: 60,
  } as never);
  mockedAuthors.mockResolvedValue({
    authors: [{ name: 'Ursula Le Guin', slug: 'ursula-le-guin', bookCount: 4 }],
  });
  mockedUsers.mockResolvedValue({
    users: [{ handle: 'bo', displayName: 'Bo Reader', isMutual: true }],
  });
});

afterEach(() => localStorage.clear());

describe('FavoritesPage', () => {
  it('shows favourite books only, not the whole library', async () => {
    renderFavorites();

    // By role rather than text: the procedural cover draws the title into the
    // artwork too, so the bare string matches twice.
    expect(await screen.findByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Contact/ })).not.toBeInTheDocument();
  });

  it('says so plainly when nothing is favourited', async () => {
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(2, 'Contact', false)] as never,
      total: 1,
      page: 1,
      pageSize: 60,
    } as never);

    renderFavorites();

    expect(await screen.findByText(/No favourite books yet/)).toBeInTheDocument();
  });

  it('opens on the tab the URL names', async () => {
    renderFavorites('/favorites?tab=authors');

    expect(await screen.findByRole('link', { name: 'Ursula Le Guin' })).toBeInTheDocument();
    // The owner's own list, never the public endpoint: this page is not public.
    expect(mockedAuthors).toHaveBeenCalled();
  });

  it('switches to the people tab, which no visitor ever sees', async () => {
    renderFavorites();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.click(screen.getByRole('tab', { name: 'People' }));

    expect(await screen.findByRole('link', { name: /Bo Reader/ })).toBeInTheDocument();
    expect(mockedUsers).toHaveBeenCalled();
  });

  it('marks the open tab for assistive tech', async () => {
    renderFavorites();
    await screen.findByRole('button', { name: /Cosmos/ });

    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Authors' })).toHaveAttribute('aria-selected', 'false');
  });
});
