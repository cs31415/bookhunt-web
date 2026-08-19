import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage';
import { ApiError } from '../../api/client';

vi.mock('../../api/auth/reset-password', () => ({
  postResetPassword: vi.fn(),
}));

import { postResetPassword } from '../../api/auth/reset-password';

const mockedReset = vi.mocked(postResetPassword);

function renderAt(entry: string) {
  const router = createMemoryRouter(
    [
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/login', element: <div>Sign in page</div> },
      { path: '/forgot-password', element: <div>Forgot page</div> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function submitPassword(value: string) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and sign in' }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockedReset.mockReset();
    mockedReset.mockResolvedValue({ ok: true });
  });

  it('reveals the password on request', () => {
    renderAt('/reset-password?token=abc123');
    const password = screen.getByLabelText('New password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('sends the token with the new password and lands on sign-in', async () => {
    const router = renderAt('/reset-password?token=abc123');
    submitPassword('correct-horse-battery');

    await waitFor(() =>
      expect(mockedReset).toHaveBeenCalledWith({ token: 'abc123', password: 'correct-horse-battery' }),
    );
    // A reset does not sign the reader in — the API returns no token — so the
    // end of this flow is the login page, not Discover.
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  /**
   * The API returns 400 with a message written to be read for a token that is
   * invalid, already spent, or expired. Showing it beats a generic failure: the
   * reader's next step differs (request a new link) from a transient error.
   */
  it('shows the API message when the token is expired or already used', async () => {
    mockedReset.mockRejectedValue(new ApiError(400, 'Invalid or expired reset token'));
    renderAt('/reset-password?token=stale');
    submitPassword('correct-horse-battery');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired reset token');
  });

  it('offers a new link rather than a dead end when the token is missing', () => {
    renderAt('/reset-password');

    expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send another link' })).toBeInTheDocument();
    // Nothing to submit: without a token there is no request worth making.
    expect(screen.queryByRole('button', { name: 'Save and sign in' })).not.toBeInTheDocument();
  });

  it('falls back to a generic message when the failure carries none', async () => {
    mockedReset.mockRejectedValue(new Error('network down'));
    renderAt('/reset-password?token=abc123');
    submitPassword('correct-horse-battery');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reset/i);
  });
});
