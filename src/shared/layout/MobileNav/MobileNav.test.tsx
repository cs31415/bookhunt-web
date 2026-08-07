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
    ['/library', 'Library'],
  ])('marks %s active as %s', (path, expectedActiveLabel) => {
    renderAt(path);

    for (const label of ['Discover', 'Library']) {
      const link = screen.getByRole('link', { name: label });
      if (label === expectedActiveLabel) {
        expect(link).toHaveAttribute('aria-current', 'page');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
      }
    }
  });

  // NAV_ITEMS backs the tab bar as well as the header, so LOS-211 takes Search
  // out of both.
  it('offers no Search tab', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
  });
});
