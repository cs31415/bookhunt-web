import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { LoadMore } from './LoadMore';

/**
 * Drives the observer by hand. jsdom has no IntersectionObserver, and the
 * component treats that as "leave the button", so the tests that care about
 * automatic loading have to supply one.
 */
type Fire = (entries: { isIntersecting: boolean }[]) => void;

function stubObserver() {
  // Live ones only. A disconnected observer cannot fire, and a stub that lets
  // it would hide exactly the bug the auto-load budget exists to prevent.
  const live: { fire: Fire }[] = [];
  class Stub {
    private record: { fire: Fire };
    constructor(callback: Fire) {
      this.record = { fire: callback };
      live.push(this.record);
    }
    observe() {}
    disconnect() {
      const at = live.indexOf(this.record);
      if (at >= 0) live.splice(at, 1);
    }
  }
  vi.stubGlobal('IntersectionObserver', Stub);
  return {
    /** Scrolls the button into view, for whichever observer is watching it. */
    scrollIntoView: () => live[live.length - 1]?.fire([{ isIntersecting: true }]),
    get watching() {
      return live.length;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoadMore', () => {
  it('says how far through the shelf the reader is', () => {
    render(<LoadMore shown={24} total={349} onMore={vi.fn()} />);

    expect(screen.getByText('24 of 349 books')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
  });

  it('drops the button once the whole shelf is on screen', () => {
    render(<LoadMore shown={12} total={12} onMore={vi.fn()} />);

    expect(screen.getByText('All 12 books')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('counts one book as a book', () => {
    render(<LoadMore shown={1} total={1} onMore={vi.fn()} />);

    expect(screen.getByText('All 1 book')).toBeInTheDocument();
  });

  it('shows nothing at all for an empty shelf', () => {
    const { container } = render(<LoadMore shown={0} total={0} onMore={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  // The count is what a reader who cannot see the grid has to go on, so it has
  // to be spoken when it changes rather than only when the page is re-read.
  it('announces the count politely', () => {
    render(<LoadMore shown={24} total={349} onMore={vi.fn()} />);

    expect(screen.getByText('24 of 349 books')).toHaveAttribute('aria-live', 'polite');
  });

  it('asks for more when pressed', () => {
    const onMore = vi.fn();
    render(<LoadMore shown={24} total={349} onMore={onMore} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('will not ask again while a slice is in flight', () => {
    const onMore = vi.fn();
    render(<LoadMore shown={24} total={349} onMore={onMore} busy />);

    const button = screen.getByRole('button', { name: 'Loading…' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onMore).not.toHaveBeenCalled();
  });

  // The point of the button being the sentinel: with no IntersectionObserver
  // there is still a door, rather than a shelf that cannot be extended.
  it('still offers the button where there is no observer', () => {
    const onMore = vi.fn();
    render(<LoadMore shown={24} total={349} onMore={onMore} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('asks for more when the button scrolls into view', () => {
    const observer = stubObserver();
    const onMore = vi.fn();
    render(<LoadMore shown={24} total={349} onMore={onMore} />);

    observer.scrollIntoView();

    expect(onMore).toHaveBeenCalledTimes(1);
  });

  /*
   * The footer under the shelf has to be reachable. An observer that fires
   * every time the button nears the viewport means the page never ends, so it
   * stops after a run and waits to be asked.
   */
  it('stops loading by itself after a couple of slices', () => {
    const observer = stubObserver();
    const onMore = vi.fn();
    const { rerender } = render(<LoadMore shown={24} total={349} onMore={onMore} />);

    observer.scrollIntoView();
    rerender(<LoadMore shown={48} total={349} onMore={onMore} />);
    observer.scrollIntoView();
    rerender(<LoadMore shown={72} total={349} onMore={onMore} />);

    expect(onMore).toHaveBeenCalledTimes(2);
    // Nothing is watching any more, so approaching the button again does
    // nothing until the reader asks.
    expect(observer.watching).toBe(0);
    observer.scrollIntoView();
    expect(onMore).toHaveBeenCalledTimes(2);
  });

  it('starts another automatic run once the reader asks by hand', () => {
    const observer = stubObserver();
    const onMore = vi.fn();
    const { rerender } = render(<LoadMore shown={24} total={349} onMore={onMore} />);

    observer.scrollIntoView();
    rerender(<LoadMore shown={48} total={349} onMore={onMore} />);
    observer.scrollIntoView();
    rerender(<LoadMore shown={72} total={349} onMore={onMore} />);
    expect(onMore).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    rerender(<LoadMore shown={96} total={349} onMore={onMore} />);
    expect(onMore).toHaveBeenCalledTimes(3);

    observer.scrollIntoView();
    expect(onMore).toHaveBeenCalledTimes(4);
  });
});
