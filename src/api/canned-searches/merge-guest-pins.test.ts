import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeGuestPins } from './merge-guest-pins';
import { pinCannedSearch } from './pin-canned-search';
import { getGuestPinnedIds } from './guest-state';
import { ApiError } from '../client';

vi.mock('./pin-canned-search');

const mockedPinCannedSearch = vi.mocked(pinCannedSearch);

function storeGuestPins(ids: number[]) {
  localStorage.setItem('bookhunt_guest_pinned_searches', JSON.stringify(ids));
}

describe('mergeGuestPins', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockedPinCannedSearch.mockResolvedValue({ id: 1, query: 'a query', category: null });
  });

  it('does nothing when the reader pinned nothing as a guest', async () => {
    await mergeGuestPins();

    expect(mockedPinCannedSearch).not.toHaveBeenCalled();
  });

  it('pins each id and clears the local copy', async () => {
    storeGuestPins([12, 88]);

    await mergeGuestPins();

    expect(mockedPinCannedSearch).toHaveBeenCalledWith(12);
    expect(mockedPinCannedSearch).toHaveBeenCalledWith(88);
    expect(getGuestPinnedIds()).toEqual([]);
  });

  // The server appends each pin at the end of the row, so firing them in
  // parallel would land them in completion order and shuffle the reader's pins.
  it('pins them in order, one at a time', async () => {
    storeGuestPins([3, 1, 2]);
    const order: number[] = [];
    mockedPinCannedSearch.mockImplementation(async (id: number) => {
      order.push(id);
      return { id, query: 'a query', category: null };
    });

    await mergeGuestPins();

    expect(order).toEqual([3, 1, 2]);
  });

  it('skips a pin the account cannot take and keeps the rest', async () => {
    storeGuestPins([12, 88]);
    mockedPinCannedSearch.mockRejectedValueOnce(new ApiError(409, 'Cannot pin more than 6 searches'));

    await expect(mergeGuestPins()).resolves.toBeUndefined();

    expect(mockedPinCannedSearch).toHaveBeenCalledWith(88);
    expect(getGuestPinnedIds()).toEqual([]);
  });
});
