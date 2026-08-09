import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { clearStoredUser, setStoredUser } from '../../api/auth/stored-user';

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <div>Login page from={state?.from ?? 'none'}</div>;
}

function renderGuarded() {
  const router = createMemoryRouter(
    [
      {
        path: '/library',
        element: (
          <RequireAuth>
            <div>Library content</div>
          </RequireAuth>
        ),
      },
      { path: '/login', element: <LoginProbe /> },
    ],
    { initialEntries: ['/library'] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('RequireAuth', () => {
  afterEach(() => clearStoredUser());

  it('redirects unauthenticated visitors to /login', () => {
    renderGuarded();
    expect(screen.getByText(/Login page/)).toBeInTheDocument();
    expect(screen.queryByText('Library content')).not.toBeInTheDocument();
  });

  it('passes the blocked path so signing in returns there', () => {
    // LoginPage has always read state.from, but nothing set it, so a reader
    // bounced off /library landed on Discover after signing in.
    renderGuarded();
    expect(screen.getByText('Login page from=/library')).toBeInTheDocument();
  });

  it('renders the protected content when authenticated', () => {
    setStoredUser({ id: 1, email: 'reader@example.com', displayName: 'Reader' });
    renderGuarded();
    expect(screen.getByText('Library content')).toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
  });
});
