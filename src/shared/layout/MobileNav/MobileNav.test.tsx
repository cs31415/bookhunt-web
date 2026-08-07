import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MobileNav } from './MobileNav';

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MobileNav />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('MobileNav', () => {
  it.each([
    ['/search?q=dune', 'Search'],
    ['/library', 'Library'],
  ])('marks %s active as %s', (path, expectedActiveLabel) => {
    // Reached by way of a search, so the Search tab is on offer either way.
    sessionStorage.setItem('bookhunt_last_search', '/search?q=dune');
    renderAt(path);

    for (const label of ['Search', 'Library']) {
      const link = screen.getByRole('link', { name: label });
      if (label === expectedActiveLabel) {
        expect(link).toHaveAttribute('aria-current', 'page');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
      }
    }
  });

  // useNavItems backs the tab bar as well as the header, so LOS-213 lands in
  // both: no Discover tab, and no Search tab until a search has been run.
  it('offers no Discover tab, and no Search tab before a search', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'Discover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
  });
});
