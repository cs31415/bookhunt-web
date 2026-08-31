import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { AuthProvider } from '../auth/AuthContext';
import { ToastHost } from '../../shared/toast/ToastHost';
import { clearToasts } from '../../shared/toast/toast-store';
import { ApiError } from '../../api/client';
import { getProfile } from '../../api/users/get-profile';
import { getPublicLibrary, getPublicLibraryFacets } from '../../api/users/get-public-library';
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
// The rail's values come from their own endpoint for a visitor. Stubbed empty
// unless a test says otherwise: FilterGroup renders nothing for an empty facet,
// so the rail simply does not appear and the shelf assertions are untouched.
const mockedFacets = vi.mocked(getPublicLibraryFacets);
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

/** The ticks live behind Edit (LOS-346), so most owner tests start by pressing it. */
async function enterEdit() {
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
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
  mockedFacets.mockReset();
  mockedFacets.mockResolvedValue({ subject: [], mood: [], theme: [], status: [] });
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

/*
 * A visitor's shelf is served a page at a time, so growing it is a fetch rather
 * than a wider slice (LOS-345). The pages have to stack up: replacing them, as
 * this hook used to, would have made "load more" mean "show a different 24".
 */
describe('a visitor’s shelf grows a page at a time (LOS-345)', () => {
  /** A shelf of `total` books, served in pages of 24, as the API would. */
  function mockPagedShelf(total: number) {
    mockedPublicLibrary.mockImplementation(async ({ page = 1, limit = 24 }) => {
      const start = (page - 1) * limit;
      return {
        entries: Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) =>
          rawEntry(start + i + 1, `Book ${start + i + 1}`),
        ) as never,
        total,
        page,
        pageSize: limit,
      };
    });
  }

  it('keeps the first page on screen when the second arrives', async () => {
    mockPagedShelf(30);
    renderProfile();

    await screen.findByText('Ada Reader');
    expect(await screen.findByText('24 of 30 books')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('All 30 books')).toBeInTheDocument();
    // The first page is still there: this is one shelf getting longer, not a
    // window moving down it.
    // getAllByText: a book with no cover art draws its title into the
    // procedural cover as well, so each one appears twice.
    expect(screen.getAllByText('Book 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Book 30').length).toBeGreaterThan(0);
  });

  it('asks the API for the next page, not the same one again', async () => {
    mockPagedShelf(30);
    renderProfile();

    await screen.findByText('24 of 30 books');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('All 30 books');

    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.any(AbortSignal),
    );
  });

  it('offers nothing more when the shelf fits in one page', async () => {
    mockPagedShelf(3);
    renderProfile();

    expect(await screen.findByText('All 3 books')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  /*
   * The race the ticket warns about. A filter change while a later page is in
   * flight must not staple that page under the new shelf -- the reader would be
   * looking at a filtered shelf with unfiltered books beneath it.
   */
  it('drops a page that lands after the filter under it changed', async () => {
    const total = 60;
    let releaseSecondPage: (() => void) | null = null;

    mockedPublicLibrary.mockImplementation(async ({ page = 1, limit = 24, q }) => {
      const answer = {
        entries: Array.from({ length: Math.min(limit, total - (page - 1) * limit) }, (_, i) =>
          rawEntry((page - 1) * limit + i + 1, q ? `Match ${i + 1}` : `Book ${(page - 1) * limit + i + 1}`),
        ) as never,
        total: q ? 1 : total,
        page,
        pageSize: limit,
      };
      // Page 2 of the unfiltered shelf is held open until the test lets it go.
      if (page === 2 && !q) {
        await new Promise<void>((resolve) => {
          releaseSecondPage = resolve;
        });
      }
      return answer;
    });

    renderProfile();
    await screen.findByText('24 of 60 books');

    // Ask for page 2, then change the question before it can answer.
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(releaseSecondPage).not.toBeNull());

    /*
     * fireEvent.change rather than userEvent.type: this only needs the query
     * committed once, and typing it character by character adds a delay per
     * keystroke on top of the 300ms debounce underneath.
     *
     * The waits are generous for the same reason. What is being watched for sits
     * behind that debounce and a request, which is comfortably past the default
     * second under full-suite load -- and a timeout here reads as this test
     * failing rather than as the wait being too short.
     */
    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: 'match' } });
    await screen.findByText('All 1 book', {}, { timeout: 5000 });

    releaseSecondPage!();

    // The stale page never joins the filtered shelf.
    await waitFor(() => expect(screen.queryAllByText('Book 25')).toHaveLength(0), {
      timeout: 5000,
    });
    expect(screen.getByText('All 1 book')).toBeInTheDocument();
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

    // Not scoped to a card group: outside edit mode a card carries no action,
    // so BookCard has nothing to group and does not.
    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('Your rating 5.0')).toBeInTheDocument();
  });

  it('says nothing about a rating the reader never gave', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByText(/Your rating/)).not.toBeInTheDocument();
  });

  it('ticks what is public and leaves a hidden book unticked', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: /Secret/ })).toBeInTheDocument();
    await enterEdit();
    expect(tickFor('Cosmos')).toBeChecked();
    expect(tickFor('Cosmos')).toHaveAccessibleName('Hide from public profile');
    expect(tickFor('Secret')).not.toBeChecked();
    // The label names the click, not the state.
    expect(tickFor('Secret')).toHaveAccessibleName('Display on public profile');
  });

  it('stages a tick rather than writing it, until Save', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();
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
    await enterEdit();

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  // Cancel now also leaves the mode, which is the one meaning of backing out.
  it('drops the staged ticks on Cancel, writing nothing', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();
    await userEvent.click(tickFor('Cosmos'));

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedSetHidden).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

    // Back in, the tick is where the shelf says it is rather than where it was left.
    await enterEdit();
    expect(tickFor('Cosmos')).toBeChecked();
  });

  it('forgets a tick moved back to where it started', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();
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
    await enterEdit();

    await userEvent.click(tickFor('Cosmos'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Falls back to whatever the server last said, never claiming a state it
    // refused. Saving ends the mode, so this looks again from outside it.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    await enterEdit();
    expect(tickFor('Cosmos')).toBeChecked();
  });

  it('reaches the whole tab from Show all, not the page on screen', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();

    await userEvent.click(screen.getByRole('button', { name: 'Show all 2' }));
    // One book of the two is hidden, so only that one is a change to save.
    expect(screen.getByText('1 unsaved')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedSetHidden).toHaveBeenCalledTimes(1);
    expect(mockedSetHidden).toHaveBeenCalledWith(2, false);
  });

  /*
   * Two buttons now, not one that flips (LOS-346). Each says what it does and
   * goes quiet when there is nothing left for it to do, so neither is ever an
   * instruction that would be a no-op.
   */
  it('offers both directions, and disables the one with nothing to do', async () => {
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos')] as never,
      total: 1,
      page: 1,
      pageSize: 60,
    } as never);
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();

    expect(screen.getByRole('button', { name: 'Show all 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide all 1' })).toBeEnabled();
  });

  it('disables Hide when every book is already hidden', async () => {
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos', { is_hidden: true })] as never,
      total: 1,
      page: 1,
      pageSize: 60,
    } as never);
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();

    expect(screen.getByRole('button', { name: 'Hide all 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show all 1' })).toBeEnabled();
  });

  // The point of the mode: a shelf being read is not a shelf being edited.
  it('keeps the ticks out of sight until Edit is pressed', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    expect(screen.queryByRole('checkbox', { name: /public profile/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Hide all/ })).not.toBeInTheDocument();

    await enterEdit();

    expect(tickFor('Cosmos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide all 2' })).toBeInTheDocument();
    // Edit has handed over to them rather than sitting alongside.
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('leaves the mode on Done when nothing is staged', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /public profile/ })).not.toBeInTheDocument();
  });

  // Escape is the way out of every other transient state on these pages.
  it('leaves the mode on Escape, dropping what was staged', async () => {
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });
    await enterEdit();
    await userEvent.click(tickFor('Cosmos'));

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(mockedSetHidden).not.toHaveBeenCalled();
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

  // An address that would 404 is not worth showing, let alone copying.
  it('hides the public address while the page is not listed', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByText('bookhunt.net/ada')).not.toBeInTheDocument();
  });

  it('shows the public address once the page is listed', async () => {
    mockedUpdateMe.mockResolvedValue({ user: { isDiscoverable: true } } as never);
    renderProfile();
    await screen.findByRole('button', { name: /Cosmos/ });

    await userEvent.click(screen.getByRole('checkbox', { name: /List profile publicly/ }));

    expect(await screen.findByText('bookhunt.net/ada')).toBeInTheDocument();
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
    // The author ticks sit behind Edit too (LOS-346): the two lists share the
    // bar, so they share the mode rather than disagreeing about it.
    expect(screen.queryByRole('checkbox', { name: /public profile/ })).not.toBeInTheDocument();
    await enterEdit();
    const tick = screen.getByRole('checkbox', { name: 'Hide from public profile' });

    await userEvent.click(tick);

    expect(tick).not.toBeChecked();
    expect(mockedSetAuthorHidden).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedSetAuthorHidden).toHaveBeenCalledWith('ursula-le-guin', true);
    // Saving leaves the mode, so the ticks go with it.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
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

describe('filtering the shelf by category (LOS-304, LOS-357)', () => {
  const withSubjects = {
    entries: [rawEntry(1, 'Cosmos', { subjects: ['Science', 'Astronomy', 'Essays', 'History'] })],
    total: 1,
    page: 1,
    pageSize: 24,
  };

  /*
   * The per-card pills are gone (LOS-357). They were a filter control, and the
   * rail does the same job in one place instead of once per book -- which only
   * became true for a visitor when LOS-359 put the facets route in the
   * forwarding manifest, so this test is the pair to that one.
   */
  it('offers no pills under a book', async () => {
    mockedPublicLibrary.mockResolvedValue(withSubjects as never);

    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByRole('button', { name: 'Science' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Astronomy' })).not.toBeInTheDocument();
  });

  // The job the pills were doing, done by the rail: same URL, same request.
  it('filters to a category from the rail', async () => {
    mockedPublicLibrary.mockResolvedValue(withSubjects as never);
    mockedFacets.mockResolvedValue({
      subject: ['Science', 'History'],
      mood: [],
      theme: [],
    } as never);
    const router = renderProfile();

    const rail = await screen.findByLabelText('Shelf filters');
    await userEvent.click(within(rail).getByText('Science'));

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

  it('says the switch makes the page findable, not merely linkable', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(
      screen.getByRole('checkbox', { name: /List profile publicly/ }),
    ).toBeInTheDocument();
  });

  // One switch, reading whichever thing it would do next.
  it('offers Enable when there is no link', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  });

  // Standing text, not a confirmation: it says what Enable would do before it
  // is pressed (LOS-311).
  it('says what Enable would do, before it is pressed', async () => {
    renderProfile();

    await screen.findByRole('button', { name: 'Enable' });
    expect(screen.getByText('Generate a new share link')).toBeInTheDocument();
  });

  it('shows the address and turns into Disable once enabled', async () => {
    mockedCreateShareLink.mockResolvedValue({ token: 'tok-abc' });
    renderProfile();
    await screen.findByRole('button', { name: 'Enable' });

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));

    expect(await screen.findByText(/\/s\/tok-abc$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
  });

  // The line follows the button rather than belonging to one state, so each
  // says what pressing it would do.
  it('swaps the hint once the link is on', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-existing' });
    renderProfile();

    await screen.findByRole('button', { name: 'Disable' });
    expect(
      screen.getByText('Permanently remove access to this link'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Generate a new share link')).not.toBeInTheDocument();
  });

  it('shows an existing link on arrival', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-existing' });
    renderProfile();

    expect(await screen.findByText(/\/s\/tok-existing$/)).toBeInTheDocument();
  });

  it('throws the link away on Disable, and offers Enable again', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    mockedDeleteShareLink.mockResolvedValue({ token: null });
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));

    expect(await screen.findByRole('button', { name: 'Enable' })).toBeInTheDocument();
    expect(screen.queryByText(/\/s\/tok-old$/)).not.toBeInTheDocument();
  });

  // Enable mints a fresh token rather than reviving the one just discarded --
  // which is why the hint says "a new link".
  it('gives a different link after a disable and enable', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    mockedDeleteShareLink.mockResolvedValue({ token: null });
    mockedCreateShareLink.mockResolvedValue({ token: 'tok-new' });
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Enable' }));

    expect(await screen.findByText(/\/s\/tok-new$/)).toBeInTheDocument();
    expect(screen.queryByText(/\/s\/tok-old$/)).not.toBeInTheDocument();
  });

  it('says so when the link cannot be created', async () => {
    mockedCreateShareLink.mockRejectedValue(new ApiError(500, 'boom'));
    renderProfile();
    await screen.findByRole('button', { name: 'Enable' });

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));

    expect(await screen.findByText(/Could not create a share link/)).toBeInTheDocument();
  });

  it('says so when the link cannot be disabled', async () => {
    mockedGetShareLink.mockResolvedValue({ token: 'tok-old' });
    mockedDeleteShareLink.mockRejectedValue(new ApiError(500, 'boom'));
    renderProfile();
    await screen.findByText(/\/s\/tok-old$/);

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }));

    expect(await screen.findByText(/Could not disable the share link/)).toBeInTheDocument();
    // The link is still there: a failed write must not look like a success.
    expect(screen.getByText(/\/s\/tok-old$/)).toBeInTheDocument();
  });

  // A visitor is not the owner, and has nothing to share here.
  it('never shows the share controls to a visitor', async () => {
    localStorage.clear();
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
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

describe('shelf facets (LOS-342)', () => {
  /*
   * beforeEach already serves a one-book shelf; this only widens the total, so
   * the page on screen is plainly a slice of something larger. The profile and
   * library mocks are left alone -- their shapes are set up there.
   */
  function shelfOfOne() {
    mockedPublicLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos', { subjects: ['Fiction'] })] as never,
      total: 30,
      page: 1,
      pageSize: 24,
    });
  }

  // The whole reason the facets have an endpoint of their own. A visitor holds
  // one page; a rail derived from it would offer whatever landed on that page,
  // and would change under the reader as they paged.
  it('offers values no book on the page carries', async () => {
    shelfOfOne();
    mockedFacets.mockResolvedValue({
      subject: ['Fiction', 'History'],
      mood: ['Bleak'],
      theme: [],
      status: [],
    });

    renderProfile();

    expect(await screen.findByRole('button', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bleak' })).toBeInTheDocument();
  });

  it('drops a facet the shelf has nothing for, rather than heading an empty row', async () => {
    shelfOfOne();
    mockedFacets.mockResolvedValue({ subject: ['Fiction'], mood: [], theme: [], status: [] });

    renderProfile();

    expect(await screen.findByText('Category')).toBeInTheDocument();
    expect(screen.queryByText('Mood')).not.toBeInTheDocument();
    expect(screen.queryByText('Theme')).not.toBeInTheDocument();
  });

  it('asks the server for the mood, and keeps it in the url so a filtered shelf can be linked', async () => {
    const user = userEvent.setup();
    shelfOfOne();
    mockedFacets.mockResolvedValue({ subject: [], mood: ['Bleak'], theme: [], status: [] });

    renderProfile();

    await user.click(await screen.findByRole('button', { name: 'Bleak' }));

    await waitFor(() =>
      expect(mockedPublicLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ mood: 'Bleak' }),
        expect.anything(),
      ),
    );
  });

  // Status comes back from the endpoint, but the tabs above the shelf already
  // are the status filter. Two controls for one job would come to disagree.
  it('offers no Status group, since the tabs are that', async () => {
    shelfOfOne();
    mockedFacets.mockResolvedValue({
      subject: ['Fiction'],
      mood: [],
      theme: [],
      status: ['finished', 'reading'],
    });

    renderProfile();

    expect(await screen.findByText('Category')).toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });
});
