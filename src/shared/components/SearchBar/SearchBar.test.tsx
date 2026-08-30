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

  /*
   * An empty search used to open the results page for nothing at all (LOS-356).
   * Guarded in the component rather than in each caller, since this one form
   * serves the button and the return key, and every search box is a SearchBar.
   */
  describe('an empty box', () => {
    it('does nothing on Enter', () => {
      const onSubmit = vi.fn();
      render(<SearchBar value="" onChange={() => {}} onSubmit={onSubmit} big />);

      fireEvent.submit(screen.getByLabelText('Search'));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    // A box holding two spaces is an empty box, not a search for spaces.
    it('treats whitespace as empty', () => {
      const onSubmit = vi.fn();
      render(<SearchBar value="   " onChange={() => {}} onSubmit={onSubmit} big />);

      fireEvent.submit(screen.getByLabelText('Search'));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    // Shown, not discovered by pressing it.
    it('disables the button', () => {
      render(<SearchBar value="" onChange={() => {}} onSubmit={() => {}} big />);

      expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    });

    it('offers the button again as soon as there is something to search', () => {
      render(<SearchBar value="d" onChange={() => {}} onSubmit={() => {}} big />);

      expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
    });

    /*
     * The guard is the authority, not the button. On a narrow screen the button
     * is hidden and the return key is the only way to submit, so a disabled
     * button alone would leave the empty search running there.
     */
    it('does nothing on Enter even where the button is not shown', () => {
      const onSubmit = vi.fn();
      render(<SearchBar value="" onChange={() => {}} onSubmit={onSubmit} />);

      fireEvent.submit(screen.getByLabelText('Search'));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('still submits a real query', () => {
      const onSubmit = vi.fn();
      render(<SearchBar value="  dune  " onChange={() => {}} onSubmit={onSubmit} big />);

      fireEvent.submit(screen.getByLabelText('Search'));

      // Passed as typed: trimming is this component's test for emptiness, not a
      // change it makes to the reader's query.
      expect(onSubmit).toHaveBeenCalledWith('  dune  ');
    });
  });

  it('omits the button entirely in the compact variant', () => {
    render(<SearchBar value="" onChange={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
  });
});
