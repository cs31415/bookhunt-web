import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { AuthProvider } from './AuthContext';
import { ApiError } from '../../api/client';
import { postLogin } from '../../api/auth/login';
import { postResendVerification } from '../../api/auth/resend-verification';

vi.mock('../../api/auth/login');
vi.mock('../../api/auth/resend-verification');

const mockedPostLogin = vi.mocked(postLogin);
const mockedPostResend = vi.mocked(postResendVerification);

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
  mockedPostResend.mockReset();
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

  it('offers a route to sign up', async () => {
    // Until LOS-219 nothing in the app linked to /register at all.
    renderLoginPage();
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  describe('when the address has not been verified', () => {
    it('explains the 403 rather than showing a credentials error', async () => {
      mockedPostLogin.mockRejectedValue(new ApiError(403, 'Please verify your email address'));
      renderLoginPage();

      fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Confirm your email address before signing in.',
      );
      expect(screen.queryByTestId('location')).not.toBeInTheDocument();
      expect(localStorage.getItem('bookhunt_token')).toBeNull();
    });

    it('resends the verification email', async () => {
      mockedPostLogin.mockRejectedValue(new ApiError(403, 'Please verify your email address'));
      mockedPostResend.mockResolvedValue({ ok: true });
      renderLoginPage();

      fillAndSubmit();
      fireEvent.click(await screen.findByRole('button', { name: /send it again/i }));

      await waitFor(() => {
        expect(mockedPostResend).toHaveBeenCalledWith({ email: 'reader@example.com' });
      });
      expect(await screen.findByRole('status')).toHaveTextContent('A new link is on its way.');
    });

    it('clears the notice on the next attempt', async () => {
      mockedPostLogin.mockRejectedValue(new ApiError(403, 'unverified'));
      renderLoginPage();
      fillAndSubmit();
      await screen.findByRole('alert');

      mockedPostLogin.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
      fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
      expect(screen.queryByRole('button', { name: /send it again/i })).not.toBeInTheDocument();
    });
  });
});
