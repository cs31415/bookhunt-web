import { describe, expect, it, vi } from 'vitest';
import { mapWithConcurrency } from './map-with-concurrency';

describe('mapWithConcurrency', () => {
  it('returns an empty array without calling the mapper', async () => {
    const fn = vi.fn();
    expect(await mapWithConcurrency([], 4, fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps results in input order even when later items settle first', async () => {
    const result = await mapWithConcurrency([30, 20, 10], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(result).toEqual([30, 20, 10]);
  });

  it('never exceeds the concurrency ceiling', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(peak).toBe(4);
  });

  it('starts no more workers than there are items', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2], 10, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(peak).toBe(2);
  });

  it('passes the index alongside each item', async () => {
    const seen: [string, number][] = [];
    await mapWithConcurrency(['a', 'b', 'c'], 1, async (item, index) => {
      seen.push([item, index]);
    });
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('rejects when any item rejects', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new Error('boom');
        return i;
      }),
    ).rejects.toThrow('boom');
  });
});
