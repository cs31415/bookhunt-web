import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionToolbar } from './SelectionToolbar';

function renderToolbar(props: Partial<Parameters<typeof SelectionToolbar>[0]> = {}) {
  const handlers = {
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onRemove: vi.fn(),
    onHide: vi.fn(),
    onDone: vi.fn(),
  };
  render(
    <SelectionToolbar selectedCount={0} visibleCount={5} {...handlers} {...props} />,
  );
  return handlers;
}

describe('SelectionToolbar', () => {
  it('offers both destructive and non-destructive actions', () => {
    renderToolbar({ selectedCount: 2 });

    expect(screen.getByRole('button', { name: 'Hide 2' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove 2' })).toBeEnabled();
  });

  it('disables both while nothing is picked', () => {
    renderToolbar({ selectedCount: 0 });

    expect(screen.getByRole('button', { name: 'Hide' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  it('hides the selection without touching removal', () => {
    const { onHide, onRemove } = renderToolbar({ selectedCount: 3 });

    fireEvent.click(screen.getByRole('button', { name: 'Hide 3' }));

    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('says the count Select all would reach, not the library total', () => {
    // A reader filtered to Abandoned should not be selecting what they are
    // still reading.
    const { onSelectAll } = renderToolbar({ visibleCount: 5 });

    fireEvent.click(screen.getByRole('button', { name: 'Select all 5' }));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('turns Select all into Clear once everything visible is picked', () => {
    const { onClear } = renderToolbar({ selectedCount: 5, visibleCount: 5 });

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
  });
});
