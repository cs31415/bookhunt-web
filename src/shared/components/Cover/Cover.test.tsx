import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Cover } from './Cover';

const baseBook = {
  title: 'Dune',
  authorName: 'Frank Herbert',
  hue: '#6f7a55',
  year: 1965,
};

describe('Cover', () => {
  it('renders a real image when coverUrl is set', () => {
    render(<Cover book={{ ...baseBook, coverUrl: 'https://example.com/dune.jpg' }} />);
    const img = screen.getByRole('img', { name: 'Dune' });
    expect(img.tagName).toBe('IMG');
  });

  it('falls back to the procedural SVG cover when the image fails to load', () => {
    render(<Cover book={{ ...baseBook, coverUrl: 'https://example.com/dune.jpg' }} />);
    const img = screen.getByRole('img', { name: 'Dune' });
    fireEvent.error(img);

    const svg = screen.getByRole('img', { name: 'Cover for Dune' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('renders the procedural SVG cover directly when there is no coverUrl', () => {
    render(<Cover book={{ ...baseBook, coverUrl: null }} />);
    const svg = screen.getByRole('img', { name: 'Cover for Dune' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText('1965')).toBeInTheDocument();
  });
});
