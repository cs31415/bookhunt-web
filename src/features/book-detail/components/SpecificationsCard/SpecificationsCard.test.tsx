import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpecificationsCard } from './SpecificationsCard';
import type { BookDetail } from '../../../../normalize/book-detail';

function bookWith(subjects: string[]): BookDetail {
  return {
    id: 1,
    slug: 'sapiens',
    title: 'Sapiens',
    authorName: 'Yuval Noah Harari',
    authorSlug: 'yuval-noah-harari',
    year: 2011,
    coverUrl: null,
    hue: '200',
    rating: 4.5,
    source: 'catalog',
    publisher: 'Harper',
    pages: 443,
    subjects,
    moods: [],
    genres: [],
    themes: [],
    blurb: null,
    googleBooksId: null,
    isbn13: '9780062316097',
    language: 'en',
    relatedIds: [],
    cataloged: true,
  };
}

describe('SpecificationsCard', () => {
  it('shows every subject when there are few', () => {
    render(<SpecificationsCard book={bookWith(['History', 'Anthropology'])} onSubjectClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anthropology' })).toBeInTheDocument();
  });

  it('shows the first ten and no more', () => {
    const subjects = Array.from({ length: 21 }, (_, i) => `Subject ${i + 1}`);

    render(<SpecificationsCard book={bookWith(subjects)} onSubjectClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Subject 10' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subject 11' })).not.toBeInTheDocument();
  });

  it('reports the subject that was clicked', () => {
    const onSubjectClick = vi.fn();
    render(<SpecificationsCard book={bookWith(['History'])} onSubjectClick={onSubjectClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(onSubjectClick).toHaveBeenCalledWith('History');
  });
});
