import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { AuthProvider } from '../auth/AuthContext';
import { ToastHost } from '../../shared/toast/ToastHost';
import { clearToasts } from '../../shared/toast/toast-store';
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
import {
  createShareLink,
  deleteShareLink,
  getShareLink,
} from '../../api/users/share-link';

vi.mock('../../api/users/get-profile');
vi.mock('../../api/users/get-public-library');
vi.mock('../../api/library/get-library');
vi.mock('../../api/users/get-favorite-authors');
vi.mock('../../api/library/set-hidden');
vi.mock('../../api/users/set-author-hidden');
vi.mock('../../api/users/update-me');
vi.mock('../../api/users/share-link');

const mockedProfile = vi.mocked(getProfile);
const mockedPublicLibrary = vi.mocked(getPublicLibrary);
const mockedLibrary = vi.mocked(getLibrary);
const mockedMyAuthors = vi.mocked(getMyFavoriteAuthors);
const mockedPublicAuthors = vi.mocked(getPublicFavoriteAuthors);
const mockedSetHidden = vi.mocked(setHidden);
const mockedSetAuthorHidden = vi.mocked(setAuthorHidden);
const mockedUpdateMe = vi.mocked(updateMe);
const mockedGetShareLink = vi.mocked(getShareLink);
const mockedCreateShareLink = vi.mocked(createShareLink);
const mockedDeleteShareLink = vi.mocked(deleteShareLink);

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

/**
 * The tick on a named card. Its label says what pressing it would do, so it
 * reads the same on every card -- the group around each card is what tells
 * them apart.
 */
function tickFor(title: string) {
  return within(screen.getByRole('group', { name: title })).getByRole('checkbox');
}

function renderProfile(path = '/ada') {
  const router = createMemoryRouter([{ path: '/:handle', element: <ProfilePage /> }], {
    initialEntries: [path],
  });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
      {/* App renders this, not the page -- without it a toast has nowhere to
          appear and the assertions below cannot see one. */}
      <ToastHost />
    </AuthProvider>,
  );
  // Returned so a test can read the URL the page navigated to.
  return router;
}

beforeEach(() => {
  localStorage.clear();
  clearToasts();
  mockedProfile.mockReset();
  mockedPublicLibrary.mockReset();
  mockedLibrary.mockReset();
  mockedMyAuthors.mockReset();
  mockedPublicAuthors.mockReset();
  mockedSetHidden.mockReset();
  mockedSetAuthorHidden.mockReset();
  mockedUpdateMe.mockReset();
  mockedGetShareLink.mockReset();
  mockedCreateShareLink.mockReset();
  mockedDeleteShareLink.mockReset();
  // No share link until a test says otherwise, which is the default state.
  mockedGetShareLink.mockResolvedValue({ token: null });
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

    expect(
      await screen.findByText('User not found or no public profile listed.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Are you sure you have the right user handle?')).toBeInTheDocument();
  });

  // The two cases must read identically. A message that named the handle for
  // one and not the other would say which, and the API deliberately will not.
  it('gives an unknown handle and a private page the same answer', async () => {
    mockedProfile.mockRejectedValue(new ApiError(404, 'No such profile'));
    mockedPublicLibrary.mockRejectedValue(new ApiError(404, 'No such profile'));

    renderProfile('/nobody');

    await screen.findByText('User not found or no public profile listed.');
    // The handle is not echoed back, so nothing on the page varies with it.
    expect(screen.queryByText(/@nobody/)).not.toBeInTheDocument();
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

  it('shows the reader’s own rating beside the catalog’s', async () => {
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos', { rating: 4.2, user_rating: 5 })] as never,
      total: 1,
      page: 1,
      pageSize: 60,
    } as never);
    renderProfile();

    const card = within(await screen.findByRole('group', { name: 'Cosmos' }));
    expect(card.getByText('4.2')).toBeInTheDocument();
    expect(card.getByText('Your rating 5.0')).toBeInTheDocument();
  });

  it('says nothing about a rating the reader never gave', async () => {
    renderProfile();

    const card = within(await screen.findByRole('group', { name: 'Cosmos' }));
    expect(card.queryByText(/Your rating/)).not.toBeInTheDocument();
  });

  it('ticks what is public and leaves a hidden book unticked', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: /Secret/ })).toBeInTheDocument();
    expect(tickFor('Cosmos')).toBeChecked();
    expect(tickFor('Cosmos')).toHaveAccessibleName('Hide from public profile');
    expect(tickFor('Secret')).not.toBeChecked();
    // The label names the click, not the state.
    expect(tickFor('Secret')).toHaveAccessibleName('Display on public profile');
  });

  it('stages a tick rather than writing it, until Save', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    const tick = tickFor('Cosmos');

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
    await screen.findByRole('button', { name: /Cosmos/ });
    const tick = tickFor('Cosmos');
    await userEvent.click(tick);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(tick).toBeChecked();
    expect(mockedSetHidden).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('forgets a tick moved back to where it started', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    const tick = tickFor('Cosmos');

    await userEvent.click(tick);
    await userEvent.click(tick);

    // Saving a no-op is still a request, so it must not count as a change.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('puts the tick back when the server refuses the save', async () => {
    mockedSetHidden.mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    const tick = tickFor('Cosmos');

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
      screen.getByRole('checkbox', { name: /List profile publicly/ }),
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
      name: /List profile publicly/,
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
    await screen.findByRole('link', { name: 'Ursula Le Guin' });
    const tick = screen.getByRole('checkbox', { name: 'Hide from public profile' });

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

describe('searching a profile (LOS-304)', () => {
  it('asks the server rather than filtering the page in the browser', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'sagan');

    await waitFor(() =>
      expect(mockedPublicLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ handle: 'ada', q: 'sagan' }),
        expect.anything(),
      ),
    );
  });

  // So a filtered shelf can be linked, and Back behaves.
  it('keeps the search in the query string', async () => {
    const router = renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'sagan');

    await waitFor(() => expect(router.state.location.search).toContain('q=sagan'));
  });

  it('reads a search out of the url on arrival', async () => {
    renderProfile('/ada?q=cosmos');

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'cosmos' }),
      expect.anything(),
    );
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('cosmos');
  });

  // A request per keystroke would be five for one word.
  it('debounces rather than asking on every keystroke', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    const before = mockedPublicLibrary.mock.calls.length;

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'sagan');
    await waitFor(() => expect(mockedPublicLibrary.mock.calls.length).toBeGreaterThan(before));

    expect(mockedPublicLibrary.mock.calls.length - before).toBeLessThan(5);
  });

  it('carries the search alongside the tab rather than replacing it', async () => {
    renderProfile('/ada?tab=reading&q=sagan');

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reading', q: 'sagan' }),
      expect.anything(),
    );
  });

  it('does not offer the box on the authors list, which is not a shelf', async () => {
    mockedPublicAuthors.mockResolvedValue({ authors: [] } as never);

    renderProfile('/ada?tab=favorites&sub=authors');

    await waitFor(() => expect(mockedPublicAuthors).toHaveBeenCalled());
    expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument();
  });
});

describe('category pills on the shelf (LOS-304)', () => {
  const withSubjects = {
    entries: [rawEntry(1, 'Cosmos', { subjects: ['Science', 'Astronomy', 'Essays', 'History'] })],
    total: 1,
    page: 1,
    pageSize: 24,
  };

  it('says what a book is about, which the shelf did not before', async () => {
    mockedPublicLibrary.mockResolvedValue(withSubjects as never);

    renderProfile();

    expect(await screen.findByRole('button', { name: 'Science' })).toBeInTheDocument();
  });

  // Fewer than the book page's ten: a shelf row has less space than a detail
  // card, and three carry the sense.
  it('shows three, not the whole list', async () => {
    mockedPublicLibrary.mockResolvedValue(withSubjects as never);

    renderProfile();

    await screen.findByRole('button', { name: 'Science' });
    expect(screen.getByRole('button', { name: 'Astronomy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Essays' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument();
  });

  it('filters the shelf to that category when a pill is clicked', async () => {
    mockedPublicLibrary.mockResolvedValue(withSubjects as never);
    const router = renderProfile();
    await screen.findByRole('button', { name: 'Science' });

    await userEvent.click(screen.getByRole('button', { name: 'Science' }));

    await waitFor(() => expect(router.state.location.search).toContain('subject=Science'));
    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Science' }),
      expect.anything(),
    );
  });

  // A shelf that has quietly dropped to a fraction of itself has to say why,
  // and offer the way back in the same place.
  it('shows the filter as a chip that clears it', async () => {
    mockedPublicLibrary.mockResolvedValue(withSubjects as never);
    const router = renderProfile('/ada?subject=Science');
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.click(screen.getByRole('button', { name: 'Clear the Science filter' }));

    await waitFor(() => expect(router.state.location.search).not.toContain('subject'));
  });
});

describe('searching your own profile (LOS-304)', () => {
  beforeEach(() => {
    signInAsOwner();
    mockedMyAuthors.mockResolvedValue({ authors: [] } as never);
    mockedLibrary.mockResolvedValue({
      entries: [
        rawEntry(1, 'Cosmos', { subjects: ['Science'] }),
        rawEntry(2, 'Dune', { author_name: 'Frank Herbert', subjects: ['Fiction'] }),
      ] as never,
      total: 2,
      stats: { total: 2, by_status: { reading: 2 } },
    });
  });

  // The owner already holds the whole shelf, so this really is the library
  // being searched -- a request would ask for what is already in hand.
  it('filters in memory without a second request', async () => {
    renderProfile('/ada');
    await screen.findByRole('button', { name: /Cosmos/ });
    const calls = mockedLibrary.mock.calls.length;

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'dune');

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Cosmos/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(mockedLibrary.mock.calls.length).toBe(calls);
    expect(mockedPublicLibrary).not.toHaveBeenCalled();
  });

  it('matches an author as well as a title, the way the server does', async () => {
    renderProfile('/ada?q=herbert');

    await screen.findByRole('button', { name: /Dune/ });
    expect(screen.queryByRole('button', { name: /Cosmos/ })).not.toBeInTheDocument();
  });

  it('filters by category from the url', async () => {
    renderProfile('/ada?subject=Fiction');

    await screen.findByRole('button', { name: /Dune/ });
    expect(screen.queryByRole('button', { name: /Cosmos/ })).not.toBeInTheDocument();
  });
});

describe('the unlisted share link (LOS-305)', () => {
  beforeEach(() => {
    signInAsOwner();
    mockedMyAuthors.mockResolvedValue({ authors: [] } as never);
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos')] as never,
      total: 1,
      stats: { total: 1, by_status: { reading: 1 } },
    });
  });

  // The old label said "anyone with the link", which is now precisely what the
  // OTHER state means. Naming them apart is the point of the copy change.
  it('offers the discoverable switch to the owner', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(
      screen.getByRole('checkbox', { name: /List profile publicly/ }),
    ).toBeInTheDocument();
  });

  it('offers to create a link when there is none', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: 'Create link' })).toBeInTheDocument();
  });

  it('shows the address once a link is made', async () => {
    mockedCreateShareLink.mockResolvedValue({ token: 'tok-abc' });
    renderProfile();
    await screen.findByRole('button', { name: 'Create link' });

    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    expect(await screen.findByText(/\/s\/tok-abc$/)).toBeInTheDocument();
  });

  it('shows an existing link on arrival', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-existing' });
    renderProfile();

    expect(await screen.findByText(/\/s\/tok-existing$/)).toBeInTheDocument();
  });

  // The one action here that cannot be undone: a misclick would silently break
  // every link already sent.
  it('asks before replacing a link that may have spread', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh link' }));

    expect(await screen.findByText(/stops working for everyone/)).toBeInTheDocument();
    expect(mockedCreateShareLink).not.toHaveBeenCalled();
  });

  it('replaces the link once confirmed, and shows the new one', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    mockedCreateShareLink.mockResolvedValue({ token: 'tok-new' });
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh link' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh it' }));

    expect(await screen.findByText(/\/s\/tok-new$/)).toBeInTheDocument();
    expect(screen.queryByText(/\/s\/tok-old$/)).not.toBeInTheDocument();
  });

  it('keeps the link when the reader backs out', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh link' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Keep it' }));

    expect(mockedCreateShareLink).not.toHaveBeenCalled();
    expect(screen.getByText(/\/s\/tok-old$/)).toBeInTheDocument();
  });

  // Turning it off is what returns the page to private.
  it('turns the link off and offers to make a new one', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    mockedDeleteShareLink.mockResolvedValue({ token: null });
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    expect(await screen.findByRole('button', { name: 'Create link' })).toBeInTheDocument();
    expect(screen.queryByText(/\/s\/tok-old$/)).not.toBeInTheDocument();
  });

  it('says so when the link cannot be created', async () => {
    mockedCreateShareLink.mockRejectedValue(new ApiError(500, 'boom'));
    renderProfile();
    await screen.findByRole('button', { name: 'Create link' });

    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));

    expect(await screen.findByText(/Could not create a share link/)).toBeInTheDocument();
  });

  // A visitor is not the owner, and has nothing to share here.
  it('never shows the share controls to a visitor', async () => {
    localStorage.clear();
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument();
    expect(mockedGetShareLink).not.toHaveBeenCalled();
  });
});

describe('profile search speed (LOS-310)', () => {
  it('does not refetch the header when only the search changes', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    const headerCalls = mockedProfile.mock.calls.length;
    const shelfCalls = mockedPublicLibrary.mock.calls.length;

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'sagan');

    // The shelf is asked again; who this reader is cannot have changed.
    await waitFor(() =>
      expect(mockedPublicLibrary.mock.calls.length).toBeGreaterThan(shelfCalls),
    );
    expect(mockedProfile.mock.calls.length).toBe(headerCalls);
  });

  // Blanking the page unmounted the search box along with everything else,
  // which threw away focus mid-word.
  it('keeps the search box mounted and focused while a search is in flight', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    const box = screen.getByRole('textbox', { name: 'Search' });
    box.focus();
    await userEvent.type(box, 'sagan');

    await waitFor(() =>
      expect(mockedPublicLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'sagan' }),
        expect.anything(),
      ),
    );

    // Same node throughout: not merely present again, but never replaced.
    expect(screen.getByRole('textbox', { name: 'Search' })).toBe(box);
    expect(box).toHaveFocus();
  });

  it('keeps the previous results on screen rather than showing a spinner', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'sagan');

    // The shelf that was already there is still readable while the next lands.
    expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
  });

  it('shows a spinner on the very first load, when there is nothing to show', async () => {
    let release: (v: unknown) => void = () => {};
    mockedPublicLibrary.mockReturnValue(new Promise((r) => (release = r)) as never);

    renderProfile();

    expect(await screen.findByRole('status', { name: /loading/i })).toBeInTheDocument();
    release({ entries: [rawEntry(1, 'Cosmos')], total: 1, page: 1, pageSize: 24 });
    expect(await screen.findByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
  });
});

describe('owner search is instant (LOS-310)', () => {
  beforeEach(() => {
    signInAsOwner();
    mockedMyAuthors.mockResolvedValue({ authors: [] } as never);
    mockedLibrary.mockResolvedValue({
      entries: [
        rawEntry(1, 'Cosmos'),
        rawEntry(2, 'Dune', { author_name: 'Frank Herbert' }),
      ] as never,
      total: 2,
      stats: { total: 2, by_status: { reading: 2 } },
    });
  });

  // The books are already in memory, so waiting on the 300ms debounce made the
  // profile slower than /library at the identical job.
  it('filters before the debounced url write has happened', async () => {
    const router = renderProfile('/ada');
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'dune');

    // Filtered already...
    expect(screen.queryByRole('button', { name: /Cosmos/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    // ...while the URL has not yet caught up.
    expect(router.state.location.search).not.toContain('q=dune');

    // It still gets there, so the shelf stays linkable.
    await waitFor(() => expect(router.state.location.search).toContain('q=dune'));
  });
});
