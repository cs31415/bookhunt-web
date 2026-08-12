import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  /**
   * The submit button is hidden below 640px (LOS-234), so on a phone the
   * keyboard's return key is the only way to run a search. That works because a
   * form containing a single text input submits on Enter — which is easy to
   * break from a distance, by wrapping the input differently or adding a second
   * field, and would fail silently on mobile only.
   */
  it('submits on Enter, which is the only way to search once the button is hidden', () => {
    const onSubmit = vi.fn();
    render(<SearchBar value="dune" onChange={() => {}} onSubmit={onSubmit} big />);

    fireEvent.submit(screen.getByLabelText('Search'));

    expect(onSubmit).toHaveBeenCalledWith('dune');
  });

  it('labels the return key so the keyboard offers Search rather than Go', () => {
    render(<SearchBar value="" onChange={() => {}} onSubmit={() => {}} big />);

    expect(screen.getByLabelText('Search')).toHaveAttribute('enterkeyhint', 'search');
  });

  it('still offers the button, for widths where it is visible', () => {
    render(<SearchBar value="" onChange={() => {}} onSubmit={() => {}} big />);

    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('omits the button entirely in the compact variant', () => {
    render(<SearchBar value="" onChange={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
  });
});
