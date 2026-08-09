import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';
import { AuthProvider } from './AuthContext';
import { ApiError } from '../../api/client';
import { postRegister } from '../../api/auth/register';
import { postResendVerification } from '../../api/auth/resend-verification';

vi.mock('../../api/auth/register');
vi.mock('../../api/auth/resend-verification');

const mockedPostRegister = vi.mocked(postRegister);
const mockedPostResend = vi.mocked(postResendVerification);

const user = { id: 7, email: 'reader@example.com', displayName: 'Ada Reader' };

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
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'b00kW0rm!' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

beforeEach(() => {
  localStorage.clear();
  mockedPostRegister.mockReset();
  mockedPostResend.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe('RegisterPage', () => {
  it('registers and shows the check-your-email panel', async () => {
    mockedPostRegister.mockResolvedValue({ user, verificationRequired: true });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(mockedPostRegister).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'b00kW0rm!',
      displayName: 'Ada Reader',
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
});
