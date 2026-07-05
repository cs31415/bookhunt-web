import { describe, expect, it } from 'vitest';
import { getSurname, pickFontSize, wrapTitle } from './text';

describe('getSurname', () => {
  it('returns the last token of a multi-word name', () => {
    expect(getSurname('Ursula K. Le Guin')).toBe('Guin');
  });

  it('returns the name itself when there is only one word', () => {
    expect(getSurname('Homer')).toBe('Homer');
  });
});

describe('wrapTitle', () => {
  it('keeps a short title on one line', () => {
    expect(wrapTitle('Dune', 16)).toEqual(['Dune']);
  });

  it('wraps a long title across multiple lines', () => {
    const lines = wrapTitle('The Left Hand of Darkness', 12);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('The Left Hand of Darkness');
  });
});

describe('pickFontSize', () => {
  it('uses the largest size for a single short line', () => {
    expect(pickFontSize(1, 4)).toBe(22);
  });

  it('shrinks as line count grows', () => {
    expect(pickFontSize(4, 10)).toBe(11);
  });

  it('shrinks for a very long single line', () => {
    expect(pickFontSize(1, 20)).toBe(11);
  });
});
