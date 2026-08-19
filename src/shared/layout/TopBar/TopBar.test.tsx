import { useLocation } from 'react-router-dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';
import { AuthProvider } from '../../../features/auth/AuthContext';

// Logging out is a call to the BFF now — only it can clear the httpOnly session
// cookie (LOS-119). Stubbed so this stays a unit test of the menu.
vi.mock('../../../api/auth/logout', () => ({
  postLogout: vi.fn().mockResolvedValue(undefined),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function Shell() {
  return (
    <>
      <TopBar />
      <LocationProbe />
    </>
  );
}

function renderAt(initialEntry: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Shell /> },
      { path: '/search', element: <Shell /> },
      { path: '/books/:slug', element: <Shell /> },
      { path: '/library', element: <Shell /> },
      { path: '/login', element: <Shell /> },
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

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('TopBar', () => {
  it('marks Search active on /search and renders no header search field', () => {
    renderAt('/search?q=dune');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });

  it('marks Library active on /library', () => {
    renderAt('/library');
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
  });

  // Discover lost its nav entry (LOS-213): the index route is what the brand
  // link goes to, so nothing in the nav is active while you are on it.
  it('offers no Discover link, and marks nothing active on the index route', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'Discover' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current');
  });

  // Nothing to go back to until a search has been run, and the Discover hero is
  // the way in, so a Search entry before then would only lead to a blank page.
  it('hides Search until a search has been run, then keeps it', async () => {
    const router = renderAt('/');
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();

    await act(() => router.navigate('/search?q=dune'));
    expect(screen.getByRole('link', { name: 'Search' })).toBeInTheDocument();

    // Still offered once the reader has moved on to a book: that is the point
    // of it — the way back to the results they came from.
    await act(() => router.navigate('/books/dune'));
    expect(screen.getByRole('link', { name: 'Search' })).toBeInTheDocument();
  });

  // A bare /search has no results behind it, so there is nothing to return to.
  it('does not count a query-less /search as a search having been run', () => {
    renderAt('/search');
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('returns to the last search, filters and all, when Search is clicked', async () => {
    const router = renderAt('/');
    await act(() => router.navigate('/search?q=dune&sort=rating'));
    await act(() => router.navigate('/books/dune'));

    fireEvent.click(screen.getByRole('link', { name: 'Search' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=dune&sort=rating');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('returns to Discover from the brand link', () => {
    renderAt('/search?q=dune');
    fireEvent.click(screen.getByRole('link', { name: /BookHunt/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('shows a Sign in link to /login when logged out', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('offers Sign up beside it, in second place', () => {
    renderAt('/');
    const links = screen.getAllByRole('link', { name: /^Sign (in|up)$/ });
    expect(links.map((link) => link.textContent)).toEqual(['Sign in', 'Sign up']);
    expect(links[1]).toHaveAttribute('href', '/register');
  });

  it('shows an account menu with logout when logged in', async () => {
    localStorage.setItem(
      'bookhunt_user',
      JSON.stringify({ id: 7, email: 'reader@example.com', displayName: 'Ada Reader' }),
    );
    renderAt('/');

    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByText('Hello, Ada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByText('Ada Reader')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    // Awaited rather than synchronous: signing out waits on the BFF dropping
    // the cookie before the local state clears.
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('bookhunt_user')).toBeNull();
  });

  it('offers Profile and Favourites in the account menu, not in the nav', () => {
    localStorage.setItem(
      'bookhunt_user',
      JSON.stringify({ id: 7, email: 'reader@example.com', displayName: 'Ada Reader', handle: 'ada' }),
    );
    renderAt('/');

    // Neither is a nav entry: both are the reader's own things.
    expect(screen.queryByRole('link', { name: 'Favourites' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/ada');
    expect(screen.getByRole('menuitem', { name: 'Favourites' })).toHaveAttribute(
      'href',
      '/favorites',
    );
  });

  it('offers Favourites even to a reader with no handle, which Profile needs', () => {
    localStorage.setItem(
      'bookhunt_user',
      JSON.stringify({ id: 7, email: 'reader@example.com', displayName: 'Ada Reader' }),
    );
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.queryByRole('menuitem', { name: 'Profile' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Favourites' })).toBeInTheDocument();
  });

  it('walks back through history via the Back button', () => {
    const router = renderAt('/');
    router.navigate('/search');
    router.navigate('/books/dune');

    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByTestId('location')).toHaveTextContent('/search');

    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});

/**
 * The burger replaced the fixed bottom tab bar (LOS-235). It is the only primary
 * nav below 640px — .nav is hidden there — so these cover what MobileNav's tests
 * used to, plus the open/close behaviour a tab bar never needed.
 *
 * The visibility itself is a media query and so is not observable in jsdom; what
 * is testable is that the control exists, opens, lists the right destinations,
 * marks the current one, and closes again.
 */
describe('TopBar mobile menu', () => {
  it('keeps the menu shut until asked', () => {
    renderAt('/library');

    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens on click and offers Library', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
    const menus = screen.getAllByRole('navigation', { name: 'Primary' });
    const panel = menus[menus.length - 1];
    expect(panel).toHaveTextContent('Library');
  });

  it('marks the current destination, like the tab bar it replaced', () => {
    sessionStorage.setItem('bookhunt_last_search', '/search?q=dune');
    renderAt('/library');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const links = screen.getAllByRole('link', { name: 'Library' });
    expect(links.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('closes on Escape', () => {
    renderAt('/library');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when a destination is chosen, so it does not hang over the new page', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const links = screen.getAllByRole('link', { name: 'Library' });
    fireEvent.click(links[links.length - 1]);

    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
