import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { FilterRail } from '../../../../shared/components/FilterRail/FilterRail';
import { LibraryFilters } from './LibraryFilters';
import type { LibraryEntry } from '../../../../normalize/library';
import type { LibraryStatus } from '../../../../shared/types/library-status';

let nextId = 1;

function makeEntry(overrides: Partial<LibraryEntry> & { status?: LibraryStatus } = {}): LibraryEntry {
  const id = nextId++;
  return {
    status: overrides.status ?? 'queued',
    notes: null,
    subjects: overrides.subjects ?? [],
    moods: overrides.moods ?? [],
    themes: overrides.themes ?? [],
    addedAt: null,
    isFavorite: overrides.isFavorite ?? false,
    isHidden: false,
    isEbook: overrides.isEbook ?? false,
    isAudiobook: overrides.isAudiobook ?? false,
    userRating: overrides.userRating ?? null,
    book: {
      id,
      slug: `book-${id}`,
      title: `Book ${id}`,
      authorName: 'Anon',
      authorSlug: 'anon',
      year: null,
      coverUrl: null,
      hue: '#000',
      rating: null,
      source: 'catalog',
    },
  };
}

function renderRail(entries: LibraryEntry[], props: Partial<Parameters<typeof LibraryFilters>[0]> = {}) {
  const onSelectCategory = vi.fn();
  const onSelectStatus = vi.fn();
  // Rendered inside the rail, which is how the page composes them: FilterRail
  // owns the landmark and its label, and these tests scope by that label.
  render(
    <FilterRail label="Library filters">
      <LibraryFilters
        entries={entries}
        status={null}
        category={null}
        mood={null}
        theme={null}
        favorite={false}
        format={null}
        onToggleFavorite={vi.fn()}
        onSelectFormat={vi.fn()}
        onSelectStatus={onSelectStatus}
        onSelectCategory={onSelectCategory}
        onSelectMood={vi.fn()}
        onSelectTheme={vi.fn()}
        onClearFilters={vi.fn()}
        {...props}
      />
    </FilterRail>,
  );
  return { onSelectCategory, onSelectStatus, rail: screen.getByLabelText('Library filters') };
}

describe('LibraryFilters', () => {
  it('offers a pill per shared tag, ordered by how many books carry it', () => {
    const { rail } = renderRail([
      makeEntry({ subjects: ['Fiction', 'History'] }),
      makeEntry({ subjects: ['Fiction', 'History'] }),
      makeEntry({ subjects: ['Fiction'] }),
    ]);

    const pills = within(rail).getAllByRole('button');
    expect(pills.map((p) => p.textContent)).toEqual(['Fiction', 'History', 'New 3']);
  });

  it('reports each status with its count and leaves out the empty ones', () => {
    const { rail } = renderRail([
      makeEntry({ status: 'reading' }),
      makeEntry({ status: 'reading' }),
      makeEntry({ status: 'finished' }),
    ]);

    expect(within(rail).getByText('Reading 2')).toBeInTheDocument();
    expect(within(rail).getByText('Finished 1')).toBeInTheDocument();
    expect(within(rail).queryByText(/^Abandoned/)).not.toBeInTheDocument();
  });

  // Author was a pie before this; as pills it would be 242 dead ends in a
  // 331-book library, and the search box already covers the real use.
  it('has no author group', () => {
    const { rail } = renderRail([makeEntry(), makeEntry()]);
    expect(within(rail).queryByText('Author')).not.toBeInTheDocument();
  });

  it('marks the active pill and reports the value picked', () => {
    const entries = [makeEntry({ subjects: ['Fiction'] }), makeEntry({ subjects: ['Fiction'] })];
    const { rail, onSelectCategory } = renderRail(entries, { category: 'Fiction' });

    const pill = within(rail).getByText('Fiction');
    expect(pill).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(pill);
    expect(onSelectCategory).toHaveBeenCalledWith('Fiction');
  });

  it('drops a group whose facet has nothing shared to offer', () => {
    // One book each, so no tag reaches two and no heading should appear over an
    // empty row.
    const { rail } = renderRail([makeEntry({ moods: ['Bleak'] }), makeEntry({ themes: ['Exile'] })]);

    expect(within(rail).queryByText('Mood')).not.toBeInTheDocument();
    expect(within(rail).queryByText('Theme')).not.toBeInTheDocument();
    expect(within(rail).queryByText('Category')).not.toBeInTheDocument();
  });

  it('offers a way to clear once something is filtered', () => {
    const { rail } = renderRail([makeEntry()], { category: 'Fiction' });
    expect(within(rail).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('has no clear button when nothing is filtered', () => {
    const { rail } = renderRail([makeEntry()]);
    expect(within(rail).queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('counts favourites from what it was given, so an optimistic toggle shows', () => {
    // The rail is fed the override-merged entries. Reading the fetched set
    // instead left the pill claiming a favourite after the last one had been
    // un-favourited and the grid had already emptied.
    const { rail } = renderRail([
      makeEntry({ isFavorite: true }),
      makeEntry({ isFavorite: true }),
      makeEntry(),
    ]);

    expect(within(rail).getByText('Favourites (2)')).toBeInTheDocument();
  });

  it('drops the group once nothing is favourited', () => {
    const { rail } = renderRail([makeEntry(), makeEntry()]);
    expect(within(rail).queryByText(/^Favourites/)).not.toBeInTheDocument();
  });

  it('splits a mixed shelf by format, counting both halves', () => {
    const { rail } = renderRail([makeEntry({ isEbook: true }), makeEntry(), makeEntry()]);

    expect(within(rail).getByText('Ebook 1')).toBeInTheDocument();
    expect(within(rail).getByText('Physical 2')).toBeInTheDocument();
  });

  it('drops the format group when every book is the same format', () => {
    const { rail } = renderRail([makeEntry(), makeEntry()]);
    expect(within(rail).queryByText('Format')).not.toBeInTheDocument();
  });

  it('offers all three when the shelf holds all three', () => {
    const { rail } = renderRail([
      makeEntry({ isEbook: true }),
      makeEntry({ isAudiobook: true }),
      makeEntry(),
    ]);

    expect(within(rail).getByText('Ebook 1')).toBeInTheDocument();
    expect(within(rail).getByText('Audiobook 1')).toBeInTheDocument();
    expect(within(rail).getByText('Physical 1')).toBeInTheDocument();
  });

  // No pill for a format nothing on the shelf is.
  it('leaves out a format the shelf does not hold', () => {
    const { rail } = renderRail([makeEntry({ isEbook: true }), makeEntry()]);
    expect(within(rail).queryByText(/^Audiobook/)).not.toBeInTheDocument();
  });

  it('reports the format picked', () => {
    const onSelectFormat = vi.fn();
    const { rail } = renderRail([makeEntry({ isEbook: true }), makeEntry()], { onSelectFormat });

    fireEvent.click(within(rail).getByText('Ebook 1'));
    expect(onSelectFormat).toHaveBeenCalledWith('ebook');
  });
});
