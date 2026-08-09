import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmailPage } from './VerifyEmailPage';
import { AuthProvider } from './AuthContext';
import { ApiError } from '../../api/client';
import { postVerifyEmail } from '../../api/auth/verify-email';
import { postResendVerification } from '../../api/auth/resend-verification';
import { mergeGuestPins } from '../../api/canned-searches/merge-guest-pins';

vi.mock('../../api/auth/verify-email');
vi.mock('../../api/auth/resend-verification');
vi.mock('../../api/canned-searches/merge-guest-pins');

const mockedPostVerifyEmail = vi.mocked(postVerifyEmail);
const mockedPostResend = vi.mocked(postResendVerification);
const mockedMergeGuestPins = vi.mocked(mergeGuestPins);

const user = { id: 7, email: 'reader@example.com', displayName: 'Ada Reader' };

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderVerifyPage(search = '?token=tok-1', { strict = false } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/', element: <LocationProbe /> },
      { path: '/login', element: <div>Sign in page</div> },
    ],
    { initialEntries: [`/verify-email${search}`] },
  );
  const tree = (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  localStorage.clear();
  mockedPostVerifyEmail.mockReset();
  mockedPostResend.mockReset();
  mockedMergeGuestPins.mockReset();
  mockedMergeGuestPins.mockResolvedValue(undefined as never);
});

afterEach(() => {
  localStorage.clear();
});

describe('VerifyEmailPage', () => {
  it('verifies the token, signs the reader in and lands on Discover', async () => {
    mockedPostVerifyEmail.mockResolvedValue({ user });

    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    expect(mockedPostVerifyEmail).toHaveBeenCalledWith({ token: 'tok-1' });
    expect(JSON.parse(localStorage.getItem('bookhunt_user')!)).toEqual(user);
  });

  it('carries guest pins into the new account', async () => {
    mockedPostVerifyEmail.mockResolvedValue({ user });

    renderVerifyPage();

    await waitFor(() => {
      expect(mockedMergeGuestPins).toHaveBeenCalled();
    });
  });

  it('signs the reader in even when merging guest pins fails', async () => {
    mockedPostVerifyEmail.mockResolvedValue({ user });
    mockedMergeGuestPins.mockRejectedValue(new Error('pins down'));

    renderVerifyPage();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    expect(JSON.parse(localStorage.getItem('bookhunt_user')!)).toEqual(user);
  });

  it('spends the token only once under StrictMode', async () => {
    // StrictMode double-invokes effects in development. Verification tokens are
    // single-use, so an unguarded effect burns the token on its first run and
    // then reports a perfectly good link as invalid.
    mockedPostVerifyEmail.mockResolvedValue({ user });

    renderVerifyPage('?token=tok-1', { strict: true });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    expect(mockedPostVerifyEmail).toHaveBeenCalledTimes(1);
  });

  it('explains an expired link and offers a new one', async () => {
    mockedPostVerifyEmail.mockRejectedValue(
      new ApiError(400, 'This verification link is invalid or has expired.'),
    );

    renderVerifyPage();

    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
    expect(localStorage.getItem('bookhunt_user')).toBeNull();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('shows the expired state when the URL carries no token at all', async () => {
    renderVerifyPage('');

    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
    expect(mockedPostVerifyEmail).not.toHaveBeenCalled();
  });

  it('sends a new link from the failure state', async () => {
    mockedPostVerifyEmail.mockRejectedValue(new ApiError(400, 'expired'));
    mockedPostResend.mockResolvedValue({ ok: true });

    renderVerifyPage();

    await screen.findByText('This link has expired');
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send a new link/i }));

    await waitFor(() => {
      expect(mockedPostResend).toHaveBeenCalledWith({ email: 'reader@example.com' });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If that address needs confirming, a new link is on its way.',
    );
  });
});
