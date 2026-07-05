import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibrarySnapshotCard } from './LibrarySnapshotCard';

describe('LibrarySnapshotCard', () => {
  it('shows the empty state and fires onAddFirstBook when total is 0', () => {
    const onAddFirstBook = vi.fn();
    render(
      <LibrarySnapshotCard
        total={0}
        counts={{ queued: 0, reading: 0, finished: 0, abandoned: 0 }}
        onSliceClick={vi.fn()}
        onOpenLibrary={vi.fn()}
        onAddFirstBook={onAddFirstBook}
      />,
    );

    expect(screen.getByText('Start your library')).toBeInTheDocument();
    expect(screen.getByText('Your reading breakdown appears here')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add your first book'));
    expect(onAddFirstBook).toHaveBeenCalled();
  });

  it('shows total count, a pie slice per non-zero status, and wires up navigation callbacks', () => {
    const onSliceClick = vi.fn();
    const onOpenLibrary = vi.fn();
    render(
      <LibrarySnapshotCard
        total={12}
        counts={{ queued: 5, reading: 0, finished: 7, abandoned: 0 }}
        onSliceClick={onSliceClick}
        onOpenLibrary={onOpenLibrary}
        onAddFirstBook={vi.fn()}
      />,
    );

    expect(screen.getByText('12 books, and counting')).toBeInTheDocument();
    // Only non-zero statuses should render as legend rows.
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.queryByText('Reading')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Finished'));
    expect(onSliceClick).toHaveBeenCalledWith('finished');

    fireEvent.click(screen.getByText('Open library'));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it('uses singular "book" for a single-item library', () => {
    render(
      <LibrarySnapshotCard
        total={1}
        counts={{ queued: 1, reading: 0, finished: 0, abandoned: 0 }}
        onSliceClick={vi.fn()}
        onOpenLibrary={vi.fn()}
        onAddFirstBook={vi.fn()}
      />,
    );

    expect(screen.getByText('1 book, and counting')).toBeInTheDocument();
  });
});
