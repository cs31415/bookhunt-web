import { describe, expect, it } from 'vitest';
import { getSurname, pluralize, wrapTitle } from './text';

describe('pluralize', () => {
  it('returns the singular form for a count of 1', () => {
    expect(pluralize(1, 'book')).toBe('book');
  });

  it('returns the plural form for any other count', () => {
    expect(pluralize(0, 'book')).toBe('books');
    expect(pluralize(3, 'book')).toBe('books');
  });

  it('uses an explicit plural when the default -s is wrong', () => {
    expect(pluralize(2, 'entry', 'entries')).toBe('entries');
  });
});

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
