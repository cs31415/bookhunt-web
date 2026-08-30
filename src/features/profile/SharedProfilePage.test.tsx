import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedProfilePage } from './SharedProfilePage';
import { AuthProvider } from '../auth/AuthContext';
import { ApiError } from '../../api/client';
import { getLibraryByToken, getProfileByToken, getLibraryFacetsByToken } from '../../api/users/get-by-token';

vi.mock('../../api/users/get-by-token');

const mockedProfile = vi.mocked(getProfileByToken);
const mockedLibrary = vi.mocked(getLibraryByToken);
// The unlisted shelf's rail values, by token. Empty unless a test says
// otherwise, so an empty rail renders nothing and the shelf assertions stand.
const mockedFacets = vi.mocked(getLibraryFacetsByToken);

const profile = {
  handle: 'ada',
  displayName: 'Ada Reader',
  joinedAt: '2026-01-01T00:00:00Z',
  counts: { total: 2, reading: 1, finished: 1, favorites: 1 },
};

function rawEntry(id: number, title: string, extra: Record<string, unknown> = {}) {
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
    ...extra,
  };
}

function renderShared(path = '/s/tok-abc') {
  const router = createMemoryRouter(
    [
      { path: '/s/:token', element: <SharedProfilePage /> },
      { path: '/', element: <div>Discover</div> },
      { path: '/books/:slug', element: <div /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

beforeEach(() => {
  mockedFacets.mockReset();
  mockedFacets.mockResolvedValue({ subject: [], mood: [], theme: [], status: [] });
  localStorage.clear();
  mockedProfile.mockReset();
  mockedLibrary.mockReset();
  mockedProfile.mockResolvedValue({ profile });
  mockedLibrary.mockResolvedValue({
    entries: [rawEntry(1, 'Cosmos')] as never,
    total: 1,
    page: 1,
    pageSize: 24,
  });
});

describe('a profile at its unlisted address', () => {
  it('serves the same shelf the handle would', async () => {
    renderShared();

    expect(await screen.findByText('Ada Reader')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
  });

  it('reads the token endpoints, and passes the token from the url', async () => {
    renderShared('/s/tok-xyz');

    await screen.findByText('Ada Reader');
    expect(mockedProfile).toHaveBeenCalledWith('tok-xyz', expect.anything());
    expect(mockedLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-xyz' }),
      expect.anything(),
    );
  });

  // The page must not be indexed, and the tag must not outlive the route --
  // this is a single-page app, and a tag left behind would go on telling
  // crawlers not to index whatever the reader navigated to next.
  it('carries noindex while it is on screen', async () => {
    renderShared();

    await screen.findByText('Ada Reader');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
  });

  it('takes the tag away when the page goes', async () => {
    const { unmount } = render(
      <AuthProvider>
        <RouterProvider
          router={createMemoryRouter([{ path: '/s/:token', element: <SharedProfilePage /> }], {
            initialEntries: ['/s/tok-abc'],
          })}
        />
      </AuthProvider>,
    );
    await screen.findByText('Ada Reader');

    unmount();

    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  // An unknown token and a revoked one give the same answer, so the page says
  // the link no longer works rather than guessing which happened.
  it('says the link is dead rather than that the profile does not exist', async () => {
    mockedProfile.mockRejectedValue(new ApiError(404, 'No such profile'));
    mockedLibrary.mockRejectedValue(new ApiError(404, 'No such profile'));

    renderShared();

    expect(await screen.findByText('This link no longer works')).toBeInTheDocument();
  });

  // Someone holding a link is not necessarily signed in, and this page is for
  // reading a shelf rather than acting on it.
  it('offers no owner controls and no favourite heart', async () => {
    renderShared();

    await screen.findByText('Ada Reader');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /favourite/i })).not.toBeInTheDocument();
  });

  it('searches and filters the shared shelf the way the public one does', async () => {
    renderShared();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'sagan');

    await waitFor(() =>
      expect(mockedLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'sagan' }),
        expect.anything(),
      ),
    );
  });

  it('keeps the tabs, and asks the server for the right one', async () => {
    renderShared('/s/tok-abc?tab=reading');

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(mockedLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reading' }),
      expect.anything(),
    );
  });
});
