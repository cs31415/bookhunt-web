import { describe, expect, it } from 'vitest';
import { arcPath } from './colors';

describe('arcPath', () => {
  it('draws a small (< 180deg) slice with largeArcFlag 0', () => {
    const path = arcPath(0, 0, 10, 0, Math.PI / 2);
    expect(path).toContain('M 0 0');
    expect(path).toContain('L 0 -10');
    expect(path).toMatch(/A 10 10 0 0 1 10 [\d.e-]+/);
  });

  it('draws a large (> 180deg) slice with largeArcFlag 1', () => {
    const path = arcPath(0, 0, 10, 0, (3 * Math.PI) / 2);
    expect(path).toMatch(/A 10 10 0 1 1/);
  });

  it('closes the path back to center', () => {
    const path = arcPath(5, 5, 10, 0, Math.PI);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('M 5 5');
  });
});
