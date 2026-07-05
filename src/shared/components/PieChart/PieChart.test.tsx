import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PieChart } from './PieChart';

const slices = [
  { label: 'Queued', value: 2 },
  { label: 'Reading', value: 3 },
  { label: 'Finished', value: 4 },
  { label: 'Abandoned', value: 1 },
];

describe('PieChart', () => {
  it('renders one path per slice', () => {
    const { container } = render(<PieChart slices={slices} />);
    expect(container.querySelectorAll('path')).toHaveLength(4);
  });

  it('fires onPick with the clicked slice', () => {
    const onPick = vi.fn();
    render(<PieChart slices={slices} onPick={onPick} />);
    fireEvent.click(screen.getByText('Finished: 4').closest('path')!);
    expect(onPick).toHaveBeenCalledWith(slices[2]);
  });

  it('dims non-hovered slices and pops out the hovered one', () => {
    const { container } = render(<PieChart slices={slices} />);
    const paths = container.querySelectorAll('path');
    fireEvent.mouseEnter(paths[0]);

    expect((paths[0] as SVGPathElement).style.opacity).toBe('1');
    expect((paths[1] as SVGPathElement).style.opacity).toBe('0.6');
  });
});
