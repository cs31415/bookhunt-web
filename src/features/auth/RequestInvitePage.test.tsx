import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestInvitePage } from './RequestInvitePage';
import { postRequestInvite } from '../../api/auth/request-invite';

vi.mock('../../api/auth/request-invite');

const mockedRequest = vi.mocked(postRequestInvite);

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/request-invite', element: <RequestInvitePage /> },
      { path: '/register', element: <div>Register page</div> },
    ],
    { initialEntries: ['/request-invite'] },
  );
  render(<RouterProvider router={router} />);
}

function submit(email = 'sam@example.com') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Request an invite' }));
}

beforeEach(() => {
  mockedRequest.mockReset();
  mockedRequest.mockResolvedValue({ received: true });
});

describe('RequestInvitePage', () => {
  it('sends the address', async () => {
    renderPage();
    submit();

    expect(await screen.findByText('Request received')).toBeInTheDocument();
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sam@example.com' }),
    );
  });

  it('carries the optional note when there is one', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Anything to add'), {
      target: { value: 'I read a lot of physics' },
    });
    submit();

    await screen.findByText('Request received');
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'I read a lot of physics' }),
    );
  });

  it('omits the note when it is blank rather than sending an empty one', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Anything to add'), { target: { value: '   ' } });
    submit();

    await screen.findByText('Request received');
    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({ note: undefined }));
  });

  /*
   * The same confirmation whatever happened, like the forgotten-password page.
   * The API answers 202 for a well-formed address whether or not it has an
   * account, and saying anything different here would give away exactly what
   * the API withholds.
   */
  it('reads the address back, since a typo looks like success', async () => {
    renderPage();
    submit('typo@example.com');

    expect(await screen.findByText('typo@example.com')).toBeInTheDocument();
  });

  it('offers a way back to try another address', async () => {
    renderPage();
    submit('typo@example.com');

    fireEvent.click(await screen.findByRole('button', { name: 'Try another address' }));

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  // Said plainly: an invitation nobody promised, arriving on no schedule, is
  // better than a wait the page invented.
  it('does not promise an invite or a time', async () => {
    renderPage();
    submit();

    expect(await screen.findByText(/not instant and it is not/)).toBeInTheDocument();
  });

  it('shows an error only when the request itself failed', async () => {
    mockedRequest.mockRejectedValue(new Error('offline'));
    renderPage();
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/try again shortly/);
    expect(screen.queryByText('Request received')).not.toBeInTheDocument();
  });

  describe('the honeypot', () => {
    // Hidden from people, and from anyone who cannot see it: aria-hidden and
    // tabIndex -1 keep it away from screen readers and the keyboard.
    it('is hidden from assistive technology', () => {
      renderPage();

      // By role, not by label: getByLabelText ignores aria-hidden, so it finds
      // the field even though assistive technology never would. getByRole is
      // the query that reflects the accessibility tree.
      expect(screen.queryByRole('textbox', { name: 'Website' })).not.toBeInTheDocument();
      const field = document.querySelector('input[name="website"]') as HTMLInputElement;
      expect(field).not.toBeNull();
      expect(field.tabIndex).toBe(-1);
      expect(field.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    // A browser autofilling it would turn a real person into a bot.
    it('opts out of autofill', () => {
      renderPage();

      const field = document.querySelector('input[name="website"]') as HTMLInputElement;
      expect(field.getAttribute('autocomplete')).toBe('off');
    });

    it('is sent empty by a person', async () => {
      renderPage();
      submit();

      await screen.findByText('Request received');
      expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({ website: '' }));
    });
  });
});
