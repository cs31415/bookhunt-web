import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LibraryPage } from './LibraryPage';
import { getLibrary } from '../../api/library/get-library';
import type { RawLibraryEntry } from '../../normalize/library';
import type { LibraryStatus } from '../../shared/types/library-status';

vi.mock('../../api/library/get-library');

const mockedGetLibrary = vi.mocked(getLibrary);

let idSeq = 1;

function makeRaw(overrides: Partial<RawLibraryEntry> = {}): RawLibraryEntry {
  const id = overrides.book_id ?? idSeq++;
  return {
    book_id: id,
    status: 'queued',
    notes: null,
    review: null,
    title: `Book ${id}`,
    book_slug: `book-${id}`,
    author_name: 'Anon',
    author_slug: 'anon',
    year: 2000,
    rating: 4,
    cover_url: null,
    hue: '#6f7a55',
    subjects: [],
    date_added: null,
    ...overrides,
  };
}

function mockLibrary(entries: RawLibraryEntry[], byStatus: Partial<Record<LibraryStatus, number>> = {}) {
  mockedGetLibrary.mockResolvedValue({
    entries,
    stats: { total: entries.length, by_status: byStatus },
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderLibrary() {
  const router = createMemoryRouter(
    [
      {
        path: '/library',
        element: (
          <>
            <LibraryPage />
            <LocationProbe />
          </>
        ),
      },
      { path: '/', element: <LocationProbe /> },
      { path: '/books/:slug', element: <LocationProbe /> },
    ],
    { initialEntries: ['/library'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const dune = makeRaw({
  title: 'Dune',
  book_slug: 'dune',
  status: 'reading',
  subjects: ['Evolution'],
  author_name: 'Frank Herbert',
});
const sapiens = makeRaw({
  title: 'Sapiens',
  status: 'finished',
  subjects: ['Evolution', 'History'],
  author_name: 'Yuval Harari',
});
const clockwork = makeRaw({
  title: 'Clockwork',
  status: 'queued',
  subjects: ['History'],
  author_name: 'Anon',
});

describe('LibraryPage', () => {
  beforeEach(() => {
    idSeq = 100;
    mockedGetLibrary.mockReset();
  });

  it('renders header, charts, status tabs, and the book grid', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    expect(await screen.findByText('Your library')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add from a photo' })).toBeInTheDocument();

    expect(screen.getByText('By Status')).toBeInTheDocument();
    expect(screen.getByText('By Subject')).toBeInTheDocument();
    expect(screen.getByText('By Author')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
  });

  it('filters the grid to finished books when the Finished tab is clicked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    fireEvent.click(await screen.findByRole('tab', { name: /Finished/ }));

    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Finished/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('filters by subject and shows a dismissible pill when a subject slice is picked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    const charts = await screen.findByLabelText('Library breakdown');
    fireEvent.click(within(charts).getByText('History'));

    // History books: Sapiens + Clockwork; Dune (Evolution only) is filtered out.
    expect(screen.getByRole('button', { name: /Sapiens/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clockwork/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dune/ })).not.toBeInTheDocument();

    const pill = screen.getByText('subject:').closest('div')!;
    expect(within(pill).getByText('History')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear subject filter/ }));
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.queryByText('subject:')).not.toBeInTheDocument();
  });

  it('activates the Reading tab when the By Status Reading slice is picked', async () => {
    mockLibrary([dune, sapiens, clockwork], { reading: 1, finished: 1, queued: 1 });
    renderLibrary();

    const charts = await screen.findByLabelText('Library breakdown');
    fireEvent.click(within(charts).getByText('Reading'));

    expect(screen.getByRole('tab', { name: /Reading/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /Dune/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sapiens/ })).not.toBeInTheDocument();
  });

  it('shows pagination controls when results exceed the page size', async () => {
    const many = Array.from({ length: 61 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(many, { queued: 61 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
  });

  it('shows the empty state for a library with no books', async () => {
    mockLibrary([], {});
    renderLibrary();

    expect(await screen.findByText('Your shelves are empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover books' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add from a photo' })).toBeInTheDocument();
    expect(screen.queryByText('By Status')).not.toBeInTheDocument();
  });

  it('hides status tabs that have no books', async () => {
    const allQueued = Array.from({ length: 3 }, () => makeRaw({ status: 'queued' }));
    mockLibrary(allQueued, { queued: 3 });
    renderLibrary();

    await screen.findByText('Your library');
    expect(screen.getByRole('tab', { name: /Queued/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Finished/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Reading/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Abandoned/ })).not.toBeInTheDocument();
  });

  it('navigates to the book detail page when a card is clicked', async () => {
    mockLibrary([dune], { reading: 1 });
    renderLibrary();

    fireEvent.click(await screen.findByRole('button', { name: /Dune/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/books/dune');
  });
});
