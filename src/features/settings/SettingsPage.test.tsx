import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { AuthProvider } from '../auth/AuthContext';
import { ApiError } from '../../api/client';
import { updateMe } from '../../api/users/update-me';

vi.mock('../../api/users/update-me');

const mockedUpdateMe = vi.mocked(updateMe);

const storedUser = {
  id: 7,
  email: 'reader@example.com',
  displayName: 'Ada Reader',
  handle: 'ada',
  isDiscoverable: false,
};

function renderSettings() {
  const router = createMemoryRouter([{ path: '/settings', element: <SettingsPage /> }], {
    initialEntries: ['/settings'],
  });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem('bookhunt_user', JSON.stringify(storedUser));
  mockedUpdateMe.mockReset();
  mockedUpdateMe.mockResolvedValue({
    user: { ...storedUser, isDiscoverable: false },
  });
});

afterEach(() => {
  localStorage.clear();
});

describe('SettingsPage', () => {
  it('opens with the reader’s current values', () => {
    renderSettings();

    expect(screen.getByLabelText('Name')).toHaveValue('Ada Reader');
    expect(screen.getByLabelText('Handle')).toHaveValue('ada');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows the switch already on when the page is public', () => {
    // There is no who-am-I endpoint, so this can only come from the cached
    // session payload — which is why the API sends isDiscoverable with it.
    localStorage.setItem(
      'bookhunt_user',
      JSON.stringify({ ...storedUser, isDiscoverable: true }),
    );
    renderSettings();

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('saves the profile and adopts what came back', async () => {
    mockedUpdateMe.mockResolvedValue({
      user: { ...storedUser, displayName: 'Ada R.', handle: 'ada_r' },
    });

    renderSettings();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada R.' } });
    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'Ada_R' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Saved.');
    expect(mockedUpdateMe).toHaveBeenCalledWith({ displayName: 'Ada R.', handle: 'Ada_R' });
    // Normalized server-side; the field shows what was actually stored.
    expect(screen.getByLabelText('Handle')).toHaveValue('ada_r');
    expect(JSON.parse(localStorage.getItem('bookhunt_user')!).handle).toBe('ada_r');
  });

  it('reports a taken handle without clearing the field', async () => {
    mockedUpdateMe.mockRejectedValue(
      new ApiError(409, 'That handle is taken.', 'HANDLE_TAKEN'),
    );

    renderSettings();
    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'taken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That handle is taken.');
    expect(screen.getByLabelText('Handle')).toHaveValue('taken');
  });

  it('saves the public-page switch on the spot, not with the form', async () => {
    // Pairing it with Save invites a reader to flip it, walk away, and believe
    // their library is public when it is not.
    mockedUpdateMe.mockResolvedValue({ user: { ...storedUser, isDiscoverable: true } });

    renderSettings();
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedUpdateMe).toHaveBeenCalledWith({ isDiscoverable: true });
    });
    expect(screen.getByRole('checkbox')).toBeChecked();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('bookhunt_user')!).isDiscoverable).toBe(true);
    });
  });

  it('puts the switch back when the server refuses', async () => {
    mockedUpdateMe.mockRejectedValue(new ApiError(500, 'Internal server error'));

    renderSettings();
    fireEvent.click(screen.getByRole('checkbox'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Never claims a state the server denied.
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows the address the public page would have', () => {
    renderSettings();
    expect(screen.getByText('bookhunt.net/ada')).toBeInTheDocument();
  });
});
