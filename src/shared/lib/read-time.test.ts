import { describe, expect, it } from 'vitest';
import { readTime } from './read-time';

describe('readTime', () => {
  it('returns null for no page count', () => {
    expect(readTime(null)).toBeNull();
    expect(readTime(0)).toBeNull();
  });

  it('returns minutes under an hour', () => {
    expect(readTime(30)).toBe('42 min');
  });

  it('returns whole hours when evenly divisible', () => {
    expect(readTime(600)).toBe('14 hr');
  });

  it('returns a decimal hour otherwise', () => {
    expect(readTime(100)).toBe('2.3 hr');
  });
});
