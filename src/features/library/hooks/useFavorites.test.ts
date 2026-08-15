import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavorites } from './useFavorites';
import { setFavorite } from '../../../api/library/set-favorite';
import { ApiError } from '../../../api/client';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import type { LibraryEntry } from '../../../normalize/library';

vi.mock('../../../api/library/set-favorite');

const mockedSetFavorite = vi.mocked(setFavorite);

const entry = {
  status: 'queued',
  notes: null,
  subjects: [],
  moods: [],
  themes: [],
  addedAt: null,
  isFavorite: false,
  isHidden: false,
  book: {
    id: 12,
    slug: 'dune',
    title: 'Dune',
    authorName: 'Frank Herbert',
    authorSlug: 'frank-herbert',
    year: 1965,
    coverUrl: null,
    hue: '#000',
    rating: null,
    source: 'catalog',
  },
} as LibraryEntry;

beforeEach(() => {
  mockedSetFavorite.mockReset();
  mockedSetFavorite.mockResolvedValue({
    entry: { user_id: 1, book_id: 12, is_favorite: true, is_hidden: false },
  });
  clearToasts();
});

describe('useFavorites', () => {
  it('shows the new value before the request settles', async () => {
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      await result.current.toggle(entry, true);
    });

    expect(result.current.apply([entry])[0].isFavorite).toBe(true);
    expect(mockedSetFavorite).toHaveBeenCalledWith(12, true);
  });

  it('leaves untouched entries alone', async () => {
    const other = { ...entry, book: { ...entry.book, id: 99 } } as LibraryEntry;
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      await result.current.toggle(entry, true);
    });

    const [first, second] = result.current.apply([entry, other]);
    expect(first.isFavorite).toBe(true);
    expect(second.isFavorite).toBe(false);
  });

  it('rolls back and says so when the request fails', async () => {
    mockedSetFavorite.mockRejectedValue(new ApiError(500, 'Internal server error'));
    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      await result.current.toggle(entry, true);
    });

    // Falls back to what the server last said rather than to a remembered
    // value, which is right even if two toggles raced.
    expect(result.current.apply([entry])[0].isFavorite).toBe(false);
    expect(getToasts()[0].text).toContain('Could not favourite');
  });

  it('returns the entries untouched when nothing has been toggled', () => {
    const { result } = renderHook(() => useFavorites());
    const entries = [entry];
    expect(result.current.apply(entries)).toBe(entries);
  });
});
