import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repairCover, resetRepairedCovers } from './repair-cover';
import { apiFetch } from '../client';

vi.mock('../client');

const mockedApiFetch = vi.mocked(apiFetch);

const REPAIRED = { outcome: 'repaired' as const, coverUrl: 'https://books.google.com/x.jpg' };

beforeEach(() => {
  resetRepairedCovers();
  mockedApiFetch.mockReset();
  mockedApiFetch.mockResolvedValue(REPAIRED);
});

describe('repairCover', () => {
  it('posts to the book cover endpoint', async () => {
    expect(await repairCover('enlightenment')).toEqual(REPAIRED);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/books/enlightenment/cover',
      expect.objectContaining({ method: 'POST', silent: true }),
    );
  });

  // The same book appears on the shelf, in search and on its own page, each
  // mounting a fresh Cover. A cover is repaired once for everyone, so asking
  // again can only spend a provider call to learn what the first ask knows.
  it('asks once per book however many covers ask', async () => {
    const [first, second] = await Promise.all([
      repairCover('enlightenment'),
      repairCover('enlightenment'),
    ]);

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(REPAIRED);
    expect(second).toEqual(REPAIRED);
  });

  it('keeps asking for different books', async () => {
    await Promise.all([repairCover('dune'), repairCover('sapiens')]);
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });

  // The procedural cover is already on screen by the time this runs, so a
  // failure has nothing to report -- the reader keeps the cover they have.
  it('resolves null rather than throwing when the request fails', async () => {
    mockedApiFetch.mockRejectedValue(new Error('offline'));
    expect(await repairCover('enlightenment')).toBeNull();
  });

  it('caps how many run at once, so a full grid cannot open a socket per cover', async () => {
    let inFlight = 0;
    let peak = 0;
    mockedApiFetch.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
      return REPAIRED;
    });

    await Promise.all(Array.from({ length: 20 }, (_, i) => repairCover(`book-${i}`)));

    expect(peak).toBeLessThanOrEqual(4);
  });
});
