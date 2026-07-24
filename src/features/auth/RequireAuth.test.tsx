import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { clearSession, setSession } from '../../api/auth/token';

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
      { path: '/login', element: <div>Login page</div> },
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
  afterEach(() => clearSession());

  it('redirects unauthenticated visitors to /login', () => {
    renderGuarded();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Library content')).not.toBeInTheDocument();
  });

  it('renders the protected content when authenticated', () => {
    setSession('token-123', { id: 1, email: 'reader@example.com', displayName: 'Reader' });
    renderGuarded();
    expect(screen.getByText('Library content')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
