import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExampleQueryPills } from './ExampleQueryPills';
import type { CannedSearch } from '../../../../api/canned-searches/types';

function search(id: number, query: string): CannedSearch {
  return { id, query, category: 'mood' };
}

const thriller = search(1, 'history that reads like a thriller');
const cozy = search(2, 'cozy mysteries');

describe('ExampleQueryPills', () => {
  it('renders a pill per query and fires onPick with its text when clicked', () => {
    const onPick = vi.fn();
    render(<ExampleQueryPills pinned={[]} suggested={[thriller, cozy]} onPick={onPick} />);

    fireEvent.click(screen.getByText('cozy mysteries'));
    expect(onPick).toHaveBeenCalledWith('cozy mysteries');
  });

  it('renders pinned pills ahead of the suggestions', () => {
    render(<ExampleQueryPills pinned={[cozy]} suggested={[thriller]} onPick={vi.fn()} />);

    const queries = screen.getAllByRole('button').map((button) => button.textContent);
    expect(queries).toEqual(['cozy mysteries', 'history that reads like a thriller']);
  });

  describe('the pin control', () => {
    it('names the query it belongs to, so it is not just "Pin" six times over', () => {
      render(
        <ExampleQueryPills
          pinned={[]}
          suggested={[thriller]}
          onPick={vi.fn()}
          onTogglePin={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'Pin history that reads like a thriller' }),
      ).toBeInTheDocument();
    });

    it('reports pinned state through aria-pressed and flips its label', () => {
      render(
        <ExampleQueryPills
          pinned={[cozy]}
          suggested={[]}
          onPick={vi.fn()}
          onTogglePin={vi.fn()}
        />,
      );

      const pin = screen.getByRole('button', { name: 'Unpin cozy mysteries' });
      expect(pin).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles the pin without running the search', () => {
      const onPick = vi.fn();
      const onTogglePin = vi.fn();
      render(
        <ExampleQueryPills
          pinned={[]}
          suggested={[thriller]}
          onPick={onPick}
          onTogglePin={onTogglePin}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^Pin / }));

      expect(onTogglePin).toHaveBeenCalledWith(thriller);
      expect(onPick).not.toHaveBeenCalled();
    });

    it('is left out entirely when there is nothing to pin against', () => {
      render(<ExampleQueryPills pinned={[]} suggested={[thriller]} onPick={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /^Pin / })).not.toBeInTheDocument();
    });

    // A button inside a button is invalid HTML, and browsers recover from it by
    // dropping the inner control out of the tab order. Both have to be roots.
    it('does not nest the pin inside the query button', () => {
      render(
        <ExampleQueryPills
          pinned={[]}
          suggested={[thriller]}
          onPick={vi.fn()}
          onTogglePin={vi.fn()}
        />,
      );

      const queryButton = screen.getByText('history that reads like a thriller');
      expect(queryButton.querySelector('button')).toBeNull();
    });
  });

  describe('the refresh glyph', () => {
    it('asks for a new sample when clicked', () => {
      const onRefresh = vi.fn();
      render(
        <ExampleQueryPills
          pinned={[]}
          suggested={[thriller]}
          onPick={vi.fn()}
          onRefresh={onRefresh}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show different searches' }));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    // Disabling a focused button drops focus in some browsers, which would send
    // a keyboard reader back to the top of the page on every refresh.
    it('stays enabled and focusable so repeat presses keep their place', () => {
      render(
        <ExampleQueryPills
          pinned={[]}
          suggested={[thriller]}
          onPick={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      const refresh = screen.getByRole('button', { name: 'Show different searches' });
      refresh.focus();
      fireEvent.click(refresh);

      expect(refresh).not.toBeDisabled();
      expect(refresh).toHaveFocus();
    });

    it('is left out when the row cannot be redrawn', () => {
      render(<ExampleQueryPills pinned={[]} suggested={[thriller]} onPick={vi.fn()} />);

      expect(
        screen.queryByRole('button', { name: 'Show different searches' }),
      ).not.toBeInTheDocument();
    });
  });
});
