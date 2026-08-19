import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { AuthProvider } from '../auth/AuthContext';
import { ApiError } from '../../api/client';
import { getProfile } from '../../api/users/get-profile';
import { getPublicLibrary } from '../../api/users/get-public-library';
import { getLibrary } from '../../api/library/get-library';
import {
  getMyFavoriteAuthors,
  getPublicFavoriteAuthors,
} from '../../api/users/get-favorite-authors';
import { setHidden } from '../../api/library/set-hidden';
import { setAuthorHidden } from '../../api/users/set-author-hidden';
import { updateMe } from '../../api/users/update-me';

vi.mock('../../api/users/get-profile');
vi.mock('../../api/users/get-public-library');
vi.mock('../../api/library/get-library');
vi.mock('../../api/users/get-favorite-authors');
vi.mock('../../api/library/set-hidden');
vi.mock('../../api/users/set-author-hidden');
vi.mock('../../api/users/update-me');

const mockedProfile = vi.mocked(getProfile);
const mockedPublicLibrary = vi.mocked(getPublicLibrary);
const mockedLibrary = vi.mocked(getLibrary);
const mockedMyAuthors = vi.mocked(getMyFavoriteAuthors);
const mockedPublicAuthors = vi.mocked(getPublicFavoriteAuthors);
const mockedSetHidden = vi.mocked(setHidden);
const mockedSetAuthorHidden = vi.mocked(setAuthorHidden);
const mockedUpdateMe = vi.mocked(updateMe);

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

function signInAsOwner() {
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
}

function renderProfile(path = '/ada') {
  const router = createMemoryRouter([{ path: '/:handle', element: <ProfilePage /> }], {
    initialEntries: [path],
  });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  // Returned so a test can read the URL the page navigated to.
  return router;
}

beforeEach(() => {
  localStorage.clear();
  mockedProfile.mockReset();
  mockedPublicLibrary.mockReset();
  mockedLibrary.mockReset();
  mockedMyAuthors.mockReset();
  mockedPublicAuthors.mockReset();
  mockedSetHidden.mockReset();
  mockedSetAuthorHidden.mockReset();
  mockedUpdateMe.mockReset();
  mockedSetHidden.mockResolvedValue(undefined as never);
  mockedSetAuthorHidden.mockResolvedValue(undefined as never);
  mockedProfile.mockResolvedValue({ profile });
  mockedPublicLibrary.mockResolvedValue({
    entries: [rawEntry(1, 'Cosmos')] as never,
    total: 1,
    page: 1,
    pageSize: 24,
  });
});

afterEach(() => localStorage.clear());

describe('ProfilePage as a visitor', () => {
  it('shows the header and the shelf', async () => {
    renderProfile();

    expect(await screen.findByText('Ada Reader')).toBeInTheDocument();
    expect(screen.getByText('@ada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
  });

  it('reads the public endpoints, never the private library', async () => {
    renderProfile();

    await screen.findByText('Ada Reader');
    expect(mockedPublicLibrary).toHaveBeenCalled();
    expect(mockedLibrary).not.toHaveBeenCalled();
  });

  it('says the profile does not exist rather than falling back to Discover', async () => {
    // A 404 covers an unknown handle and a private page alike, and the page
    // must not guess which.
    mockedProfile.mockRejectedValue(new ApiError(404, 'No such profile'));
    mockedPublicLibrary.mockRejectedValue(new ApiError(404, 'No such profile'));

    renderProfile('/nobody');

    expect(await screen.findByText('No such profile')).toBeInTheDocument();
  });

  it('asks the API for the tab rather than filtering in the browser', async () => {
    renderProfile('/ada?tab=favorites');

    await screen.findByText('Ada Reader');
    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ handle: 'ada', favorites: true }),
      expect.any(AbortSignal),
    );
  });

  it('shows no owner controls', async () => {
    renderProfile();

    await screen.findByText('Ada Reader');
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('shows none of them to a signed-in reader either, on someone else’s page', async () => {
    // Signed in is not the same as being the owner. The split is on the handle.
    localStorage.setItem(
      'bookhunt_user',
      JSON.stringify({ id: 9, email: 'b@c.com', displayName: 'Bo', handle: 'bo' }),
    );
    renderProfile('/ada');

    await screen.findByText('Ada Reader');
    expect(mockedLibrary).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
  });
});

describe('ProfilePage as the owner', () => {
  beforeEach(() => {
    signInAsOwner();
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos'), rawEntry(2, 'Secret', { is_hidden: true })] as never,
      total: 2,
      stats: undefined,
      page: 1,
      pageSize: 60,
    } as never);
  });

  it('reads the private library, so a private page still renders', async () => {
    // The public endpoint 404s while the page is off. Reading it would lock the
    // owner out of their own profile with no way back except publishing.
    renderProfile();

    expect(await screen.findByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    expect(mockedLibrary).toHaveBeenCalled();
    expect(mockedPublicLibrary).not.toHaveBeenCalled();
  });

  it('ticks what is public and leaves a hidden book unticked', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: /Secret/ })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Show Cosmos on your public page' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Show Secret on your public page' }),
    ).not.toBeChecked();
  });

  it('stages a tick rather than writing it, until Save', async () => {
    renderProfile();
    const tick = await screen.findByRole('checkbox', {
      name: 'Show Cosmos on your public page',
    });

    await userEvent.click(tick);

    expect(tick).not.toBeChecked();
    expect(mockedSetHidden).not.toHaveBeenCalled();
    expect(screen.getByText('1 unsaved')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedSetHidden).toHaveBeenCalledWith(1, true);
    await waitFor(() => expect(screen.queryByText('1 unsaved')).not.toBeInTheDocument());
  });

  it('offers no Save until something is staged', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('drops the staged ticks on Cancel, writing nothing', async () => {
    renderProfile();
    const tick = await screen.findByRole('checkbox', {
      name: 'Show Cosmos on your public page',
    });
    await userEvent.click(tick);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(tick).toBeChecked();
    expect(mockedSetHidden).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('forgets a tick moved back to where it started', async () => {
    renderProfile();
    const tick = await screen.findByRole('checkbox', {
      name: 'Show Cosmos on your public page',
    });

    await userEvent.click(tick);
    await userEvent.click(tick);

    // Saving a no-op is still a request, so it must not count as a change.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('puts the tick back when the server refuses the save', async () => {
    mockedSetHidden.mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderProfile();
    const tick = await screen.findByRole('checkbox', {
      name: 'Show Cosmos on your public page',
    });

    await userEvent.click(tick);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Falls back to whatever the server last said, never claiming a state it
    // refused.
    await waitFor(() => expect(tick).toBeChecked());
  });

  it('reaches the whole tab from Show all, not the page on screen', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.click(screen.getByRole('button', { name: 'Show all 2' }));
    // One book of the two is hidden, so only that one is a change to save.
    expect(screen.getByText('1 unsaved')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedSetHidden).toHaveBeenCalledTimes(1);
    expect(mockedSetHidden).toHaveBeenCalledWith(2, false);
  });

  it('offers the other direction when every book already agrees', async () => {
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos')] as never,
      total: 1,
      page: 1,
      pageSize: 60,
    } as never);
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    expect(screen.getByRole('button', { name: 'Hide all 1' })).toBeInTheDocument();
  });

  it('publishes the page from the switch, on the spot', async () => {
    mockedUpdateMe.mockResolvedValue({ user: { isDiscoverable: true } } as never);
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.click(
      screen.getByRole('checkbox', { name: /Anyone with the link can see this page/ }),
    );

    expect(mockedUpdateMe).toHaveBeenCalledWith({ isDiscoverable: true });
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('bookhunt_user')!).isDiscoverable).toBe(true);
    });
  });

  it('puts the switch back when the server refuses', async () => {
    mockedUpdateMe.mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    const swtch = screen.getByRole('checkbox', {
      name: /Anyone with the link can see this page/,
    });

    await userEvent.click(swtch);

    await waitFor(() => expect(swtch).not.toBeChecked());
  });

  it('disables the copy button while the page is private', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    // The address is still shown: the reader should know what it would be.
    expect(screen.getByText('bookhunt.net/ada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });
});

describe('the Authors tab', () => {
  beforeEach(() => {
    mockedMyAuthors.mockResolvedValue({ authors: [] });
    mockedPublicAuthors.mockResolvedValue({
      authors: [{ name: 'Carl Sagan', slug: 'carl-sagan', bookCount: 2 }],
    });
  });

  it('reads the public list for a visitor', async () => {
    renderProfile('/ada?tab=favorites&sub=authors');

    expect(await screen.findByRole('link', { name: 'Carl Sagan' })).toHaveAttribute(
      'href',
      '/authors/carl-sagan',
    );
    expect(mockedPublicAuthors).toHaveBeenCalledWith('ada', expect.any(AbortSignal));
    expect(mockedMyAuthors).not.toHaveBeenCalled();
  });

  it('reads the owner’s own list instead, so a private page still shows it', async () => {
    signInAsOwner();
    mockedLibrary.mockResolvedValue({
      entries: [] as never,
      total: 0,
      page: 1,
      pageSize: 60,
    } as never);
    mockedMyAuthors.mockResolvedValue({
      authors: [{ name: 'Ursula Le Guin', slug: 'ursula-le-guin', bookCount: 4 }],
    });

    renderProfile('/ada?tab=favorites&sub=authors');

    expect(await screen.findByRole('link', { name: 'Ursula Le Guin' })).toBeInTheDocument();
    expect(mockedMyAuthors).toHaveBeenCalled();
    expect(mockedPublicAuthors).not.toHaveBeenCalled();
  });

  it('gives the owner a tick per author, and the visitor none', async () => {
    renderProfile('/ada?tab=favorites&sub=authors');

    await screen.findByRole('link', { name: 'Carl Sagan' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('stages an author tick until Save, like the shelf does', async () => {
    signInAsOwner();
    mockedLibrary.mockResolvedValue({
      entries: [] as never,
      total: 0,
      page: 1,
      pageSize: 60,
    } as never);
    mockedMyAuthors.mockResolvedValue({
      authors: [{ name: 'Ursula Le Guin', slug: 'ursula-le-guin', bookCount: 4 }],
    });

    renderProfile('/ada?tab=favorites&sub=authors');
    const tick = await screen.findByRole('checkbox', {
      name: 'Show Ursula Le Guin on your public page',
    });

    await userEvent.click(tick);

    expect(tick).not.toBeChecked();
    expect(mockedSetAuthorHidden).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedSetAuthorHidden).toHaveBeenCalledWith('ursula-le-guin', true);
    await waitFor(() => expect(tick).not.toBeChecked());
  });
});

describe('the Favourites sub-tabs', () => {
  beforeEach(() => {
    mockedPublicAuthors.mockResolvedValue({
      authors: [{ name: 'Carl Sagan', slug: 'carl-sagan', bookCount: 2 }],
    });
  });

  it('shows books under Favourites by default', async () => {
    renderProfile('/ada?tab=favorites');

    expect(await screen.findByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    // Favourites, not the whole shelf: the filter reaches the API.
    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ favorites: true }),
      expect.any(AbortSignal),
    );
  });

  it('switches to authors and says so in the URL, so the link survives sharing', async () => {
    const router = renderProfile('/ada?tab=favorites');
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.click(screen.getByRole('tab', { name: 'Authors' }));

    expect(await screen.findByRole('link', { name: 'Carl Sagan' })).toBeInTheDocument();
    expect(router.state.location.search).toContain('sub=authors');
  });

  it('offers no sub-tabs outside Favourites', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByRole('tab', { name: 'Books' })).not.toBeInTheDocument();
  });

  it('never offers People — a follow list is not public', async () => {
    renderProfile('/ada?tab=favorites');

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByRole('tab', { name: 'People' })).not.toBeInTheDocument();
  });
});
