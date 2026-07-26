import { describe, it, expect } from 'vitest';
import { toNumber } from './to-number';

describe('toNumber', () => {
  it('coerces a numeric string (Postgres NUMERIC) to a number', () => {
    expect(toNumber('4.5')).toBe(4.5);
    expect(toNumber('0')).toBe(0);
  });

  it('passes a number through unchanged', () => {
    expect(toNumber(4.5)).toBe(4.5);
    expect(toNumber(0)).toBe(0);
  });

  it('returns null for null, undefined, or empty string', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(toNumber('not a number')).toBeNull();
  });
});
