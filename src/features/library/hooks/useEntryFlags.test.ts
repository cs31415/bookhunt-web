import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntryFlags } from './useEntryFlags';
import { setFavorite } from '../../../api/library/set-favorite';
import { setHidden } from '../../../api/library/set-hidden';
import { setEbook } from '../../../api/library/set-ebook';
import { ApiError } from '../../../api/client';
import { clearToasts, getToasts } from '../../../shared/toast/toast-store';
import type { LibraryEntry } from '../../../normalize/library';

vi.mock('../../../api/library/set-favorite');
vi.mock('../../../api/library/set-hidden');
vi.mock('../../../api/library/set-ebook');
vi.mock('../../../api/library/set-audiobook');

const mockedSetFavorite = vi.mocked(setFavorite);
const mockedSetHidden = vi.mocked(setHidden);
const mockedSetEbook = vi.mocked(setEbook);

const entry = {
  status: 'queued',
  notes: null,
  subjects: [],
  moods: [],
  themes: [],
  addedAt: null,
  isFavorite: false,
  isHidden: false,
  isEbook: false,
  isAudiobook: false,
  userRating: null,
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
  mockedSetHidden.mockReset();
  mockedSetHidden.mockResolvedValue({
    entry: { user_id: 1, book_id: 12, is_favorite: false, is_hidden: true },
  });
  mockedSetEbook.mockReset();
  mockedSetEbook.mockResolvedValue({
    entry: { user_id: 1, book_id: 12, is_favorite: false, is_hidden: false, is_ebook: true },
  });
  clearToasts();
});

describe('useEntryFlags', () => {
  it('shows the new value before the request settles', async () => {
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleFavorite(entry, true);
    });

    expect(result.current.apply([entry])[0].isFavorite).toBe(true);
    expect(mockedSetFavorite).toHaveBeenCalledWith(12, true);
  });

  it('leaves untouched entries alone', async () => {
    const other = { ...entry, book: { ...entry.book, id: 99 } } as LibraryEntry;
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleFavorite(entry, true);
    });

    const [first, second] = result.current.apply([entry, other]);
    expect(first.isFavorite).toBe(true);
    expect(second.isFavorite).toBe(false);
  });

  it('rolls back and says so when the request fails', async () => {
    mockedSetFavorite.mockRejectedValue(new ApiError(500, 'Internal server error'));
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleFavorite(entry, true);
    });

    // Falls back to what the server last said rather than to a remembered
    // value, which is right even if two toggles raced.
    expect(result.current.apply([entry])[0].isFavorite).toBe(false);
    expect(getToasts()[0].text).toContain('Could not favourite');
  });

  it('keeps the three flags independent on the same book', async () => {
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleFavorite(entry, true);
      await result.current.toggleHidden(entry, true);
      await result.current.toggleEbook(entry, true);
    });

    const [merged] = result.current.apply([entry]);
    expect(merged.isFavorite).toBe(true);
    expect(merged.isHidden).toBe(true);
    expect(merged.isEbook).toBe(true);
  });

  // Two independent flags, not two values of one: a reader can own the Kindle
  // and the Audible copy of the same book.
  it('marks a book as both an ebook and an audiobook', async () => {
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleEbook(entry, true);
      await result.current.toggleAudiobook(entry, true);
    });

    const [merged] = result.current.apply([entry]);
    expect(merged.isEbook).toBe(true);
    expect(merged.isAudiobook).toBe(true);
  });

  it('rolls back the format and says so when the request fails', async () => {
    mockedSetEbook.mockRejectedValue(new ApiError(500, 'Internal server error'));
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleEbook(entry, true);
    });

    expect(result.current.apply([entry])[0].isEbook).toBe(false);
    expect(getToasts()[0].text).toContain('as an ebook');
  });

  it('rolls back only the flag that failed', async () => {
    mockedSetHidden.mockRejectedValue(new ApiError(500, 'Internal server error'));
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.toggleFavorite(entry, true);
      await result.current.toggleHidden(entry, true);
    });

    const [merged] = result.current.apply([entry]);
    expect(merged.isFavorite).toBe(true);
    expect(merged.isHidden).toBe(false);
  });

  it('hides several at once and reports failures once, not per book', async () => {
    const second = { ...entry, book: { ...entry.book, id: 99 } } as typeof entry;
    mockedSetHidden.mockRejectedValue(new ApiError(500, 'Internal server error'));
    const { result } = renderHook(() => useEntryFlags());

    await act(async () => {
      await result.current.hideMany([entry, second], true);
    });

    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].text).toContain('2 of 2');
  });

  it('returns the entries untouched when nothing has been toggled', () => {
    const { result } = renderHook(() => useEntryFlags());
    const entries = [entry];
    expect(result.current.apply(entries)).toBe(entries);
  });
});
