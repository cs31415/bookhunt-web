import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Stars } from './Stars';

describe('Stars display mode', () => {
  it('renders 3 full stars and 1 half star for value 3.5', () => {
    render(<Stars value={3.5} mode="display" />);
    const fills = [1, 2, 3, 4, 5].map(
      (position) => screen.getByTestId(`star-${position}`).querySelector('span')?.style.width,
    );
    expect(fills).toEqual(['100%', '100%', '100%', '50%', '0%']);
  });
});

describe('Stars interactive mode', () => {
  it('highlights stars 1-4 when hovering the 4th star', () => {
    render(<Stars value={0} mode="interactive" />);
    fireEvent.mouseEnter(screen.getByTestId('star-4'));

    const fills = [1, 2, 3, 4, 5].map(
      (position) => screen.getByTestId(`star-${position}`).querySelector('span')?.style.width,
    );
    expect(fills).toEqual(['100%', '100%', '100%', '100%', '0%']);
  });

  it('fires onChange with the clicked star position', () => {
    const onChange = vi.fn();
    render(<Stars value={0} mode="interactive" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('star-4'));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
