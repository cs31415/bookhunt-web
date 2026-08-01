import { describe, expect, it } from 'vitest';
import { topValues } from './top-values';

describe('topValues', () => {
  it('orders by count, most frequent first', () => {
    expect(topValues(['a', 'b', 'a', 'c', 'a', 'b'], { limit: 10 })).toEqual(['a', 'b']);
  });

  it('breaks ties alphabetically so the order is stable between renders', () => {
    expect(topValues(['z', 'z', 'a', 'a'], { limit: 10 })).toEqual(['a', 'z']);
  });

  it('caps the list at the limit', () => {
    expect(topValues(['a', 'a', 'b', 'b', 'c', 'c'], { limit: 2 })).toEqual(['a', 'b']);
  });

  it('drops singletons by default', () => {
    expect(topValues(['a', 'a', 'b'], { limit: 10 })).toEqual(['a']);
  });

  it('keeps singletons when the caller lowers the threshold', () => {
    // What the search rail does: a result set is small, so a tag on one book is
    // still the only handle onto it.
    expect(topValues(['a', 'a', 'b'], { limit: 10, minCount: 1 })).toEqual(['a', 'b']);
  });

  it('is empty for no values', () => {
    expect(topValues([], { limit: 10 })).toEqual([]);
  });
});
