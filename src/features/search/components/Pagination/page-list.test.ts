import { describe, expect, it } from 'vitest';
import { pageList } from './page-list';

describe('pageList', () => {
  it('lists every page when total is 7 or fewer', () => {
    expect(pageList(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageList(4, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses with a trailing ellipsis when current is near the start', () => {
    expect(pageList(1, 20)).toEqual([1, 2, '…', 20]);
  });

  it('collapses with a leading ellipsis when current is near the end', () => {
    expect(pageList(20, 20)).toEqual([1, '…', 19, 20]);
  });

  it('collapses with both ellipses when current is in the middle', () => {
    expect(pageList(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });
});
