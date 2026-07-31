import { useLocation } from 'react-router-dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopBar } from './TopBar';
import { AuthProvider } from '../../../features/auth/AuthContext';

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
});

afterEach(() => {
  localStorage.clear();
});

describe('TopBar', () => {
  it('marks Discover active on the index route', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Discover' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Search' })).not.toHaveAttribute('aria-current');
  });

  it('marks Search active on /search and renders no header search field', () => {
    renderAt('/search');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Discover' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });

  it('navigates to /search when the Search nav link is clicked', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'Search' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/search');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a Sign in link to /login when logged out', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('shows an account menu with logout when logged in', () => {
    localStorage.setItem('bookhunt_token', 'jwt-123');
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
    // Menu closes and the avatar reverts to the logged-out Sign in link.
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('bookhunt_token')).toBeNull();
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
