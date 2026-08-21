import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookCard } from './BookCard';
import type { BookSummary } from '../../types/book';

const book: BookSummary = {
  id: 1,
  slug: 'cosmos',
  title: 'Cosmos',
  authorName: 'Carl Sagan',
  authorSlug: 'carl-sagan',
  year: 1980,
  coverUrl: null,
  hue: '#000',
  rating: 4.5,
  source: 'catalog',
};

describe('BookCard subject pills (LOS-304)', () => {
  it('shows nothing extra when no subjects are passed', () => {
    render(<BookCard book={book} />);

    expect(screen.getByRole('button', { name: /Cosmos/ })).toBeInTheDocument();
    // The whole card is one button; a pill would be a second.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  // A shelf row has less space than the book page's detail card, so three
  // rather than its ten.
  it('shows at most three', () => {
    render(<BookCard book={book} subjects={['Science', 'Astronomy', 'Essays', 'History']} />);

    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Astronomy')).toBeInTheDocument();
    expect(screen.getByText('Essays')).toBeInTheDocument();
    expect(screen.queryByText('History')).not.toBeInTheDocument();
  });

  it('reports the subject that was clicked', async () => {
    const onSubjectClick = vi.fn();
    render(<BookCard book={book} subjects={['Science']} onSubjectClick={onSubjectClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Science' }));

    expect(onSubjectClick).toHaveBeenCalledWith('Science');
  });

  // A pill that does nothing should not look like a control.
  it('renders plain labels when there is nowhere to click through to', () => {
    render(<BookCard book={book} subjects={['Science']} />);

    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Science' })).not.toBeInTheDocument();
  });

  // A button nested in a button is invalid HTML, and browsers disagree about
  // what to do with the click — the reason `action` and `overlay` are siblings.
  it('keeps the pills out of the card button', () => {
    render(<BookCard book={book} subjects={['Science']} onSubjectClick={vi.fn()} />);

    const card = screen.getByRole('button', { name: /Cosmos/ });
    expect(card.querySelector('button')).toBeNull();
  });

  it('does not swallow the card click when a pill is pressed', async () => {
    const onClick = vi.fn();
    render(
      <BookCard book={book} subjects={['Science']} onSubjectClick={vi.fn()} onClick={onClick} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Science' }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
