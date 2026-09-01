import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';
import { AuthProvider } from './AuthContext';
import { ApiError } from '../../api/client';
import { postRegister } from '../../api/auth/register';
import { postResendVerification } from '../../api/auth/resend-verification';
import { getHandleAvailability } from '../../api/users/check-handle';

vi.mock('../../api/auth/register');
vi.mock('../../api/auth/resend-verification');
vi.mock('../../api/users/check-handle');

const mockedPostRegister = vi.mocked(postRegister);
const mockedPostResend = vi.mocked(postResendVerification);
const mockedHandleCheck = vi.mocked(getHandleAvailability);

const user = {
  id: 7,
  email: 'reader@example.com',
  displayName: 'Ada Reader',
  handle: 'ada',
};

function renderRegisterPage() {
  const router = createMemoryRouter(
    [
      { path: '/register', element: <RegisterPage /> },
      { path: '/login', element: <div>Sign in page</div> },
    ],
    { initialEntries: ['/register'] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Reader' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } });
  fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'ada' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'b00kW0rm!' } });
  // Required since LOS-376. Without it the browser blocks the submit and every
  // assertion below waits for a request that is never made.
  fireEvent.change(screen.getByLabelText('Invite code'), {
    target: { value: 'GNRU-XC5B-QGXT' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

beforeEach(() => {
  localStorage.clear();
  mockedPostRegister.mockReset();
  mockedPostResend.mockReset();
  mockedHandleCheck.mockReset();
  mockedHandleCheck.mockResolvedValue({ handle: 'ada', available: true, reason: null });
});

afterEach(() => {
  localStorage.clear();
});

describe('RegisterPage', () => {
  it('reveals the password on request', () => {
    renderRegisterPage();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('registers and shows the check-your-email panel', async () => {
    mockedPostRegister.mockResolvedValue({ user, verificationRequired: true });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(mockedPostRegister).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'b00kW0rm!',
      displayName: 'Ada Reader',
      handle: 'ada',
      inviteCode: 'GNRU-XC5B-QGXT',
    });
    // The address is named back so a typo in it is visible.
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
  });

  it('does not sign the reader in', async () => {
    mockedPostRegister.mockResolvedValue({ user, verificationRequired: true });

    renderRegisterPage();
    fillAndSubmit();

    await screen.findByText('Check your email');
    // The whole point of the hard gate: a new account has no session until its
    // address is confirmed.
    expect(localStorage.getItem('bookhunt_user')).toBeNull();
    expect(localStorage.getItem('bookhunt_user')).toBeNull();
  });

  it('shows an inline error when the address is already registered', async () => {
    mockedPostRegister.mockRejectedValue(new ApiError(409, 'Email already registered'));

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email is already registered.',
    );
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it('surfaces the API message for a rejected field', async () => {
    // The backend writes its 400s to be read by the person filling in the form.
    mockedPostRegister.mockRejectedValue(
      new ApiError(400, 'Password must be at least 8 characters.'),
    );

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.',
    );
  });

  it('falls back to a generic message for an unexpected failure', async () => {
    mockedPostRegister.mockRejectedValue(new Error('network down'));

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('re-enables the submit button after a failed attempt', async () => {
    mockedPostRegister.mockRejectedValue(new ApiError(409, 'Email already registered'));

    renderRegisterPage();
    fillAndSubmit();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  it('resends the verification email from the panel', async () => {
    mockedPostRegister.mockResolvedValue({ user, verificationRequired: true });
    mockedPostResend.mockResolvedValue({ ok: true });

    renderRegisterPage();
    fillAndSubmit();

    fireEvent.click(await screen.findByRole('button', { name: /resend the email/i }));

    await waitFor(() => {
      expect(mockedPostResend).toHaveBeenCalledWith({ email: 'reader@example.com' });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Sent again.');
  });

  it('reports a failed resend without losing the panel', async () => {
    mockedPostRegister.mockResolvedValue({ user, verificationRequired: true });
    mockedPostResend.mockRejectedValue(new ApiError(429, 'Too many requests'));

    renderRegisterPage();
    fillAndSubmit();

    fireEvent.click(await screen.findByRole('button', { name: /resend the email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not resend just now.');
    expect(screen.getByText('Check your email')).toBeInTheDocument();
  });

  describe('the handle field', () => {
    it('reports a free handle once the check answers', async () => {
      renderRegisterPage();
      fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'ada' } });

      expect(await screen.findByText('@ada is free.')).toBeInTheDocument();
      expect(mockedHandleCheck).toHaveBeenCalledWith('ada', expect.any(AbortSignal));
    });

    it('shows the API reason when the handle cannot be used', async () => {
      // Malformed, reserved and taken all arrive the same way, which is why
      // the form carries no copy of those rules.
      mockedHandleCheck.mockResolvedValue({
        handle: 'settings',
        available: false,
        reason: 'That handle is reserved.',
      });

      renderRegisterPage();
      fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'settings' } });

      expect(await screen.findByText('That handle is reserved.')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByLabelText('Handle')).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('asks nothing for a handle too short to be valid', async () => {
      renderRegisterPage();
      fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'ab' } });

      await waitFor(() => {
        expect(screen.getByText(/bookhunt.net\/your-handle/)).toBeInTheDocument();
      });
      expect(mockedHandleCheck).not.toHaveBeenCalled();
    });

    it('debounces rather than asking once per keystroke', async () => {
      renderRegisterPage();
      const field = screen.getByLabelText('Handle');
      fireEvent.change(field, { target: { value: 'ada' } });
      fireEvent.change(field, { target: { value: 'adar' } });
      fireEvent.change(field, { target: { value: 'adare' } });

      await screen.findByText('@adare is free.');
      // Three keystrokes, one request: the last value wins.
      expect(mockedHandleCheck).toHaveBeenCalledTimes(1);
      expect(mockedHandleCheck).toHaveBeenCalledWith('adare', expect.any(AbortSignal));
    });

    it('does not call a handle unavailable because the check failed', async () => {
      // A network hiccup is not a verdict, and the server re-checks on submit.
      mockedHandleCheck.mockRejectedValue(new ApiError(500, 'Internal server error'));

      renderRegisterPage();
      fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'ada' } });

      await waitFor(() => {
        expect(screen.getByText(/bookhunt.net\/your-handle/)).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Handle')).toHaveAttribute('aria-invalid', 'false');
    });

    it('names the handle when it is taken between the check and the submit', async () => {
      // The race the live check cannot close, and the reason the 409 carries a
      // code: without it the reader is told to change their email address.
      mockedPostRegister.mockRejectedValue(
        new ApiError(409, 'That handle is taken.', 'HANDLE_TAKEN'),
      );

      renderRegisterPage();
      fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent('That handle is taken.');
    });

    it('still reports a taken email as an email problem', async () => {
      mockedPostRegister.mockRejectedValue(new ApiError(409, 'Email already registered'));

      renderRegisterPage();
      fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That email is already registered.',
      );
    });
  });

  /*
   * Registration is invite-only (LOS-376). It was open, and 64 of the 66
   * accounts it produced were bots.
   */
  describe('the invite code', () => {
    it('says why it is being asked for', () => {
      renderRegisterPage();

      expect(screen.getByLabelText('Invite code')).toBeRequired();
      // A link, not a sentence. It shipped as plain text first, which told
      // people to do something the page gave them no way to do (LOS-381).
      const ask = screen.getByRole('link', { name: 'Request an invite code.' });
      expect(ask).toHaveAttribute('href', '/request-invite');
    });

    it('sits above the rest, since nothing else matters without it', () => {
      renderRegisterPage();

      const fields = screen.getAllByRole('textbox').map((el) => el.getAttribute('name'));
      expect(fields.indexOf('inviteCode')).toBeLessThan(fields.indexOf('displayName'));
    });

    // A refused code comes back 403, and the server's wording is written to be
    // read by whoever is filling the form in.
    it('shows the API message when the code is refused', async () => {
      mockedPostRegister.mockRejectedValue(
        new ApiError(403, 'That invite code is not valid.'),
      );
      renderRegisterPage();

      fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That invite code is not valid.',
      );
    });

    it('lets the reader try again after a refusal', async () => {
      mockedPostRegister.mockRejectedValue(
        new ApiError(403, 'That invite code is not valid.'),
      );
      renderRegisterPage();

      fillAndSubmit();

      await screen.findByRole('alert');
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    });
  });
});
