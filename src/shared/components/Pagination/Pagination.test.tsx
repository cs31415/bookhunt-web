import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, buildPageItems } from './Pagination';

describe('buildPageItems', () => {
  it('lists every page when there are 7 or fewer', () => {
    expect(buildPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('windows around the current page with ellipses for large counts', () => {
    expect(buildPageItems(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  });

  it('omits the leading ellipsis near the start', () => {
    expect(buildPageItems(2, 10)).toEqual([1, 2, 3, 'ellipsis', 10]);
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onChange={() => {}} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();

    rerender(<Pagination page={3} pageCount={3} onChange={() => {}} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('emits the target page on click', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Page 4'));
    expect(onChange).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
