import { describe, expect, it } from 'vitest';
import { getSurname, wrapTitle } from './text';

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
