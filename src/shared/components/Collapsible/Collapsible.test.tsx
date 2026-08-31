import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Collapsible } from './Collapsible';

/**
 * jsdom lays nothing out, so every scrollHeight is 0 and the component would
 * always decide the text fits. The height is stubbed on the prototype for the
 * length of a test, which is the only way these assertions mean anything.
 */
function withScrollHeight(px: number) {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => px,
  });
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
  };
}

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  // Without this the window.scrollTo spy is the same mock in the next test,
  // carrying its calls with it.
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** jsdom never scrolls, so how far down the reader is has to be said outright. */
function atScrollY(px: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: px });
}

describe('Collapsible', () => {
  it('offers nothing to expand when the text already fits', () => {
    restore = withScrollHeight(80);
    render(
      <Collapsible collapsedHeight={180}>
        <p>Two short lines.</p>
      </Collapsible>,
    );

    // A button promising more, under a blurb with none, is worse than no button.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Two short lines.')).toBeInTheDocument();
  });

  it('expands and collapses a long one', () => {
    restore = withScrollHeight(900);
    render(
      <Collapsible collapsedHeight={180}>
        <p>A description that runs on.</p>
      </Collapsible>,
    );

    const toggle = screen.getByRole('button', { name: /More/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Less' }));
    expect(screen.getByRole('button', { name: /More/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('caps the height until it is expanded', () => {
    restore = withScrollHeight(900);
    render(
      <Collapsible collapsedHeight={180}>
        <p>A description that runs on.</p>
      </Collapsible>,
    );

    const panel = screen.getByText('A description that runs on.').parentElement!;
    expect(panel).toHaveStyle({ maxHeight: '180px' });

    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(panel.style.maxHeight).toBe('');
  });

  it('returns to the top of the page when it collapses', () => {
    // Collapsing takes away the text the reader is standing on; without this
    // they land somewhere in the middle of the page, looking at something else.
    restore = withScrollHeight(900);
    const scrollTo = vi.spyOn(window, 'scrollTo');
    render(
      <Collapsible collapsedHeight={180}>
        <p>A description that runs on.</p>
      </Collapsible>,
    );

    atScrollY(900);
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    // Expanding adds text below the reader and moves nothing above them.
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Less' }));

    // The two-argument form: a smooth scroll is a silent no-op wherever
    // animation is turned down, which strands the reader exactly as before.
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('scrolls nothing when the page is already at the top', () => {
    restore = withScrollHeight(900);
    const scrollTo = vi.spyOn(window, 'scrollTo');
    render(
      <Collapsible collapsedHeight={180}>
        <p>A description that runs on.</p>
      </Collapsible>,
    );

    atScrollY(0);
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Less' }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('points the control at the panel it governs', () => {
    restore = withScrollHeight(900);
    render(
      <Collapsible collapsedHeight={180} label="description">
        <p>A description that runs on.</p>
      </Collapsible>,
    );

    const toggle = screen.getByRole('button', { name: /More.*description/ });
    const panel = screen.getByText('A description that runs on.').parentElement!;
    expect(toggle).toHaveAttribute('aria-controls', panel.id);
    expect(panel.id).not.toBe('');
  });

  /*
   * Where the reader lands on collapse is a choice now (LOS-367). The default
   * throws them to the top of the page, which is right for a panel near the top
   * and wrong for one beside the main column.
   */
  describe('collapseScroll', () => {
    it('scrolls to the top by default, as the prose panels expect', () => {
      restore = withScrollHeight(400);
      atScrollY(500);
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      render(<Collapsible>text</Collapsible>);
      const toggle = screen.getByRole('button');

      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse

      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });

    // A sidebar block collapses beside the main column: the reader has not lost
    // their place, and jumping to the top would take them away from it.
    it('leaves the reader where they are when asked to', () => {
      restore = withScrollHeight(400);
      atScrollY(500);
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      render(<Collapsible collapseScroll="none">text</Collapsible>);
      const toggle = screen.getByRole('button');

      fireEvent.click(toggle);
      fireEvent.click(toggle);

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});