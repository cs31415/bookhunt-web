import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { AuthProvider } from '../auth/AuthContext';
import { ThemeProvider } from '../../shared/theme/ThemeContext';
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
  preferences: {},
};

function renderSettings() {
  const router = createMemoryRouter([{ path: '/settings', element: <SettingsPage /> }], {
    initialEntries: ['/settings'],
  });
  render(
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
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
  });

  it('leaves the public page to the profile, switch and all', () => {
    // What a page shows is chosen where the page is (LOS-287). Settings holds
    // the things a reader changes and leaves.
    renderSettings();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('bookhunt.net/ada')).not.toBeInTheDocument();
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

  describe('the appearance control', () => {
    it('offers System as a real choice, not just light and dark', () => {
      // A two-state toggle can only say light or dark, which quietly freezes a
      // reader to whichever the machine happens to be today.
      renderSettings();

      expect(screen.getByLabelText('Light')).toBeInTheDocument();
      expect(screen.getByLabelText('Dark')).toBeInTheDocument();
      expect(screen.getByLabelText('System')).toBeChecked();
    });

    it('applies the choice to the document and saves it', async () => {
      mockedUpdateMe.mockResolvedValue({
        user: { ...storedUser, preferences: { theme: 'dark' } },
      });

      renderSettings();
      fireEvent.click(screen.getByLabelText('Dark'));

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('bookhunt_theme')).toBe('dark');
      await waitFor(() => {
        expect(mockedUpdateMe).toHaveBeenCalledWith({ preferences: { theme: 'dark' } });
      });
    });

    it('keeps the choice applied even when the save fails', async () => {
      // It costs the reader the choice on another browser, nothing more. An
      // error about a setting they can plainly see applied would be noise.
      mockedUpdateMe.mockRejectedValue(new ApiError(500, 'Internal server error'));

      renderSettings();
      fireEvent.click(screen.getByLabelText('Dark'));

      await waitFor(() => expect(mockedUpdateMe).toHaveBeenCalled());
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(screen.getByLabelText('Dark')).toBeChecked();
    });

    it('adopts the theme stored against the signed-in reader', async () => {
      localStorage.setItem(
        'bookhunt_user',
        JSON.stringify({ ...storedUser, preferences: { theme: 'dark' } }),
      );
      renderSettings();

      // What carries a choice to a second browser.
      await waitFor(() => {
        expect(screen.getByLabelText('Dark')).toBeChecked();
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
