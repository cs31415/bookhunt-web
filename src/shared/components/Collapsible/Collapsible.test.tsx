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
  vi.unstubAllGlobals();
});

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
});
