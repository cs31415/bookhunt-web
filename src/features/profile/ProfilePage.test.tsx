import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { AuthProvider } from '../auth/AuthContext';
import { ApiError } from '../../api/client';
import { getProfile } from '../../api/users/get-profile';
import { getPublicLibrary } from '../../api/users/get-public-library';
import { getLibrary } from '../../api/library/get-library';

vi.mock('../../api/users/get-profile');
vi.mock('../../api/users/get-public-library');
vi.mock('../../api/library/get-library');

const mockedProfile = vi.mocked(getProfile);
const mockedPublicLibrary = vi.mocked(getPublicLibrary);
const mockedLibrary = vi.mocked(getLibrary);

const profile = {
  handle: 'ada',
  displayName: 'Ada Reader',
  joinedAt: '2026-01-01T00:00:00Z',
  counts: { total: 2, reading: 1, finished: 1, favorites: 1 },
};

function rawEntry(id: number, title: string, extra: Record<string, unknown> = {}) {
  return {
    book_id: id,
    status: 'reading',
    title,
    book_slug: `book-${id}`,
    author_name: 'Carl Sagan',
    author_slug: 'carl-sagan',
    year: 1980,
    rating: null,
    cover_url: null,
    hue: '#000',
    ...extra,
  };
}

function renderProfile(path = '/ada') {
  const router = createMemoryRouter([{ path: '/:handle', element: <ProfilePage /> }], {
    initialEntries: [path],
  });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedProfile.mockReset();
  mockedPublicLibrary.mockReset();
  mockedLibrary.mockReset();
  mockedProfile.mockResolvedValue({ profile });
  mockedPublicLibrary.mockResolvedValue({
    entries: [rawEntry(1, 'Cosmos')] as never,
    total: 1,
    page: 1,
    pageSize: 24,
  });
});

afterEach(() => localStorage.clear());

describe('ProfilePage as a visitor', () => {
  it('shows the header and the shelf', async () => {
    renderProfile();

    expect(await screen.findByText('Ada Reader')).toBeInTheDocument();
    expect(screen.getByText('@ada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
  });

  it('reads the public endpoints, never the private library', async () => {
    renderProfile();

    await screen.findByText('Ada Reader');
    expect(mockedPublicLibrary).toHaveBeenCalled();
    expect(mockedLibrary).not.toHaveBeenCalled();
  });

  it('says the profile does not exist rather than falling back to Discover', async () => {
    // A 404 covers an unknown handle and a private page alike, and the page
    // must not guess which.
    mockedProfile.mockRejectedValue(new ApiError(404, 'No such profile'));
    mockedPublicLibrary.mockRejectedValue(new ApiError(404, 'No such profile'));

    renderProfile('/nobody');

    expect(await screen.findByText('No such profile')).toBeInTheDocument();
  });

  it('asks the API for the tab rather than filtering in the browser', async () => {
    renderProfile('/ada?tab=favorites');

    await screen.findByText('Ada Reader');
    expect(mockedPublicLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ handle: 'ada', favorites: true }),
      expect.any(AbortSignal),
    );
  });

  it('shows no owner controls', async () => {
    renderProfile();

    await screen.findByText('Ada Reader');
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    expect(screen.queryByText(/your page is/i)).not.toBeInTheDocument();
  });
});

describe('ProfilePage as the owner', () => {
  beforeEach(() => {
    localStorage.setItem(
      'bookhunt_user',
      JSON.stringify({
        id: 7,
        email: 'a@b.com',
        displayName: 'Ada Reader',
        handle: 'ada',
        isDiscoverable: false,
      }),
    );
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos'), rawEntry(2, 'Secret', { is_hidden: true })] as never,
      total: 2,
      stats: undefined,
      page: 1,
      pageSize: 60,
    } as never);
  });

  it('reads the private library, so a private page still renders', async () => {
    // The public endpoint 404s while the page is off. Reading it would lock the
    // owner out of their own profile with no way back except publishing.
    renderProfile();

    expect(await screen.findByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    expect(mockedLibrary).toHaveBeenCalled();
    expect(mockedPublicLibrary).not.toHaveBeenCalled();
  });

  it('shows hidden books, badged, so what is excluded stays legible', async () => {
    renderProfile();

    expect(await screen.findByRole('button', { name: /Secret/ })).toBeInTheDocument();
    expect(screen.getByText('Hidden from your public page')).toBeInTheDocument();
  });

  it('reports the page as private and offers the way to change it', async () => {
    renderProfile();

    expect(await screen.findByText(/your page is private/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Make it public' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('disables the copy button while the page is private', async () => {
    renderProfile();

    await screen.findByRole('button', { name: /Cosmos/ });
    // The address is still shown: the reader should know what it would be.
    expect(screen.getByText('bookhunt.net/ada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });
});
