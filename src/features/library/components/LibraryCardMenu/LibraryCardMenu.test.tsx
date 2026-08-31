import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryCardMenu } from './LibraryCardMenu';

function renderMenu(props: Partial<Parameters<typeof LibraryCardMenu>[0]> = {}) {
  const onSetShareReview = vi.fn();
  render(
    <LibraryCardMenu
      isHidden={false}
      onToggleHidden={vi.fn()}
      isEbook={false}
      onToggleEbook={vi.fn()}
      isAudiobook={false}
      onToggleAudiobook={vi.fn()}
      isFavorite={false}
      onToggleFavorite={vi.fn()}
      onRemove={vi.fn()}
      shareReview={null}
      onSetShareReview={onSetShareReview}
      {...props}
    />,
  );
  // The menu opens from its trigger; nothing inside exists until it does.
  fireEvent.click(screen.getByRole('button'));
  return { onSetShareReview: (props.onSetShareReview ?? onSetShareReview) as ReturnType<typeof vi.fn> };
}

/*
 * Three states, so radios rather than a checkbox (LOS-266). Default follows the
 * reader's global setting; the other two override it in either direction.
 */
describe('LibraryCardMenu review sharing', () => {
  it('offers the three states under a heading that explains them', () => {
    renderMenu();

    expect(screen.getByText('Review on my public page')).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Default' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Always show' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Never show' })).toBeInTheDocument();
  });

  it('marks Default when the book follows the global setting', () => {
    renderMenu({ shareReview: null });

    expect(screen.getByRole('menuitemradio', { name: 'Default' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Always show' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it.each([
    [true, 'Always show'],
    [false, 'Never show'],
  ])('marks the override when share_review is %s', (value, label) => {
    renderMenu({ shareReview: value });

    expect(screen.getByRole('menuitemradio', { name: label })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Default' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it.each([
    ['Always show', true],
    ['Never show', false],
  ])('sends %s as %s', (label, expected) => {
    const { onSetShareReview } = renderMenu({ shareReview: null });

    fireEvent.click(screen.getByRole('menuitemradio', { name: label }));

    expect(onSetShareReview).toHaveBeenCalledWith(expected);
  });

  /*
   * The state the whole tri-state exists for. Default has to reach the API as
   * null rather than as an absent value, or a book can never be put back to
   * following the global setting once it has been overridden.
   */
  it('sends Default as null, not as an absence', () => {
    const { onSetShareReview } = renderMenu({ shareReview: true });

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Default' }));

    expect(onSetShareReview).toHaveBeenCalledWith(null);
  });
});
