import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { AuthProvider } from './AuthContext';
import { ApiError } from '../../api/client';
import { postLogin } from '../../api/auth/login';

vi.mock('../../api/auth/login');

const mockedPostLogin = vi.mocked(postLogin);

const user = { id: 7, email: 'reader@example.com', displayName: 'Ada Reader' };

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLoginPage() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <LocationProbe /> },
    ],
    { initialEntries: ['/login'] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'reader@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'b00kW0rm!' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
  localStorage.clear();
  mockedPostLogin.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe('LoginPage', () => {
  it('logs in and navigates home on success', async () => {
    mockedPostLogin.mockResolvedValue({ user, token: 'jwt-123' });
    renderLoginPage();

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    expect(mockedPostLogin).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'b00kW0rm!',
    });
    expect(localStorage.getItem('bookhunt_token')).toBe('jwt-123');
  });

  it('shows an inline error and stays on the page when credentials are rejected', async () => {
    mockedPostLogin.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
    renderLoginPage();

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(localStorage.getItem('bookhunt_token')).toBeNull();
  });

  it('re-enables the submit button after a failed attempt', async () => {
    mockedPostLogin.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
    renderLoginPage();

    fillAndSubmit();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });
});
