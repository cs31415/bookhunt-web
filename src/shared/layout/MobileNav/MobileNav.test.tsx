import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileNav } from './MobileNav';

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MobileNav />
    </MemoryRouter>,
  );
}

describe('MobileNav', () => {
  it.each([
    ['/', 'Discover'],
    ['/search', 'Search'],
    ['/library', 'Library'],
  ])('marks %s active as %s', (path, expectedActiveLabel) => {
    renderAt(path);

    for (const label of ['Discover', 'Search', 'Library']) {
      const link = screen.getByRole('link', { name: label });
      if (label === expectedActiveLabel) {
        expect(link).toHaveAttribute('aria-current', 'page');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
      }
    }
  });
});
