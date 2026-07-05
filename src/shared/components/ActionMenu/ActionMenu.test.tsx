import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './ActionMenu';

describe('ActionMenu', () => {
  it('opens the dropdown with 4 status options on trigger click, current highlighted', () => {
    render(<ActionMenu current="reading" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));

    const options = screen.getAllByRole('menuitemradio');
    expect(options).toHaveLength(4);

    const reading = screen.getByRole('menuitemradio', { name: 'Reading' });
    expect(reading).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Queued' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('fires onSelect and closes when an option is clicked', () => {
    const onSelect = vi.fn();
    render(<ActionMenu current="reading" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Finished' }));

    expect(onSelect).toHaveBeenCalledWith('finished');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<ActionMenu current="reading" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on outside click', () => {
    render(
      <div>
        <ActionMenu current="reading" onSelect={vi.fn()} />
        <button>outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reading' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
