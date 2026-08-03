import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverFold } from './CoverFold';
import { ALL_LIBRARY_STATUSES, LIBRARY_STATUS_LABELS } from '../../types/library-status';

describe('CoverFold', () => {
  // The fold is a glyph. The pill it replaced carried the status as text, and a
  // screen reader would otherwise be told nothing at all.
  it.each(ALL_LIBRARY_STATUSES)('still names the status for %s', (status) => {
    render(<CoverFold status={status} />);
    expect(screen.getByText(LIBRARY_STATUS_LABELS[status])).toBeInTheDocument();
  });

  it('marks New with a star', () => {
    const { container } = render(<CoverFold status="queued" />);
    expect(container.textContent).toContain('★');
  });

  // Otherwise a reader hears the glyph read out as punctuation alongside the label.
  it('hides the glyph from assistive tech', () => {
    const { container } = render(<CoverFold status="finished" />);
    const glyph = container.querySelector('[aria-hidden="true"]');
    expect(glyph).not.toBeNull();
    expect(glyph!.textContent).toBe('✓');
  });

  it('gives each status its own mark', () => {
    const marks = ALL_LIBRARY_STATUSES.map((status) => {
      const { container, unmount } = render(<CoverFold status={status} />);
      const glyph = container.querySelector('[aria-hidden="true"]')!.textContent;
      unmount();
      return glyph;
    });
    expect(new Set(marks).size).toBe(ALL_LIBRARY_STATUSES.length);
  });
});
