import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cover } from './Cover';
import { repairCover, resetRepairedCovers } from '../../../api/books/repair-cover';

vi.mock('../../../api/books/repair-cover', async () => {
  const actual = await vi.importActual<typeof import('../../../api/books/repair-cover')>(
    '../../../api/books/repair-cover',
  );
  return { ...actual, repairCover: vi.fn() };
});

const mockedRepairCover = vi.mocked(repairCover);

const DEAD = 'https://covers.openlibrary.org/b/id/13985317-M.jpg';
const GOOGLE = 'https://books.google.com/books/content?id=abc&img=1';

const book = {
  slug: 'enlightenment',
  title: 'Enlightenment',
  authorName: 'Ritchie Robertson',
  coverUrl: DEAD,
  hue: '#6f7a55',
  year: 2020,
};

beforeEach(() => {
  vi.useFakeTimers();
  resetRepairedCovers();
  mockedRepairCover.mockReset();
  mockedRepairCover.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

/** The procedural cover is an SVG labelled for the book; the <img> is not. */
function proceduralShown(title: string) {
  return screen.queryByLabelText(`Cover for ${title}`) !== null;
}

describe('Cover', () => {
  it('shows the image while it is still within its patience', () => {
    render(<Cover book={book} />);

    act(() => {
      vi.advanceTimersByTime(2900);
    });

    expect(screen.getByRole('img', { name: 'Enlightenment' })).toHaveAttribute('src', DEAD);
    expect(proceduralShown('Enlightenment')).toBe(false);
  });

  // A host that hangs rather than refusing never fires onError, so without the
  // timer the reader watches a bare coloured box for the browser's own connect
  // timeout (LOS-272).
  it('falls back to the procedural cover after three seconds', () => {
    render(<Cover book={book} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(proceduralShown('Enlightenment')).toBe(true);
  });

  it('asks the API to repair the cover it gave up on', () => {
    render(<Cover book={book} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockedRepairCover).toHaveBeenCalledWith('enlightenment');
  });

  it('shows the repaired cover without a reload', async () => {
    mockedRepairCover.mockResolvedValue({ outcome: 'repaired', coverUrl: GOOGLE });
    render(<Cover book={book} />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('img', { name: 'Enlightenment' })).toHaveAttribute('src', GOOGLE);
  });

  it('keeps the procedural cover when nothing could be found', async () => {
    mockedRepairCover.mockResolvedValue({ outcome: 'no_replacement', coverUrl: null });
    render(<Cover book={book} />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(proceduralShown('Enlightenment')).toBe(true);
  });

  // The timer has to stop when the cover arrives, or every loaded cover on the
  // page would replace itself with a placeholder three seconds in.
  it('leaves a loaded cover alone', () => {
    render(<Cover book={book} />);

    const img = screen.getByRole('img', { name: 'Enlightenment' });
    Object.defineProperty(img, 'naturalWidth', { value: 300, configurable: true });
    act(() => {
      img.dispatchEvent(new Event('load'));
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(proceduralShown('Enlightenment')).toBe(false);
    expect(mockedRepairCover).not.toHaveBeenCalled();
  });

  it('shows the procedural cover at once for a book with no cover', () => {
    render(<Cover book={{ ...book, coverUrl: null }} />);

    expect(proceduralShown('Enlightenment')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockedRepairCover).not.toHaveBeenCalled();
  });

  // A CSV import row has no slug until it resolves, and there is nothing to
  // address a repair to.
  it('does not try to repair a book with no slug', () => {
    render(<Cover book={{ ...book, slug: undefined }} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(proceduralShown('Enlightenment')).toBe(true);
    expect(mockedRepairCover).not.toHaveBeenCalled();
  });
});
