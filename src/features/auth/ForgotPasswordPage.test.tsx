import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('../../api/auth/forgot-password', () => ({
  postForgotPassword: vi.fn(),
}));

import { postForgotPassword } from '../../api/auth/forgot-password';

const mockedForgot = vi.mocked(postForgotPassword);

function renderPage() {
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

async function submit(email: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    mockedForgot.mockReset();
    mockedForgot.mockResolvedValue({ ok: true });
  });

  it('sends the address and confirms, reading it back so a typo is visible', async () => {
    renderPage();
    await submit('reader@example.com');

    await waitFor(() => expect(mockedForgot).toHaveBeenCalledWith({ email: 'reader@example.com' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('reader@example.com')).toBeInTheDocument();
  });

  /**
   * The API answers { ok: true } for an unknown address on purpose, so that this
   * form cannot be used to discover who has an account. The page has to hold
   * that line: anything that distinguished the two cases here would hand back
   * exactly what the API withholds.
   */
  it('says the same thing for an address with no account', async () => {
    renderPage();
    await submit('nobody@example.com');

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.queryByText(/no account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });

  it('offers a way back when the address was mistyped', async () => {
    renderPage();
    await submit('typo@example.com');
    await screen.findByRole('heading', { name: 'Check your email' });

    fireEvent.click(screen.getByRole('button', { name: 'Try another address' }));

    expect(screen.getByRole('button', { name: 'Send the link' })).toBeInTheDocument();
  });

  it('reports a genuine failure, which a 200 for an unknown address is not', async () => {
    mockedForgot.mockRejectedValue(new Error('network down'));
    renderPage();
    await submit('reader@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not send/i);
  });
});
