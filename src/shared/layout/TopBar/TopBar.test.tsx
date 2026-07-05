import { useLocation } from 'react-router-dom';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopBar } from './TopBar';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function Shell() {
  return (
    <>
      <TopBar />
      <LocationProbe />
    </>
  );
}

function renderAt(initialEntry: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Shell /> },
      { path: '/search', element: <Shell /> },
      { path: '/books/:slug', element: <Shell /> },
      { path: '/library', element: <Shell /> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('TopBar', () => {
  it('marks Discover active and hides the search field on the index route', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Discover' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Search' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });

  it('marks Search active and shows the search field on /search', () => {
    renderAt('/search');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Discover' })).not.toHaveAttribute('aria-current');
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('pre-fills the search field from the q search param', () => {
    renderAt('/search?q=dune');
    expect(screen.getByLabelText('Search')).toHaveValue('dune');
  });

  it('navigates to /search when the Search nav link is clicked', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'Search' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/search');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
  });

  it('submits the header search field to /search?q=...', () => {
    renderAt('/search');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'dune' } });
    fireEvent.submit(screen.getByLabelText('Search').closest('form')!);
    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=dune');
  });

  it('walks back through history via the Back button', () => {
    const router = renderAt('/');
    router.navigate('/search');
    router.navigate('/books/dune');

    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByTestId('location')).toHaveTextContent('/search');

    fireEvent.click(screen.getByLabelText('Back'));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});
