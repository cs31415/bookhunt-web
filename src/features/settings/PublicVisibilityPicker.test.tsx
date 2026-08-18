import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicVisibilityPicker } from './PublicVisibilityPicker';
import { getLibrary } from '../../api/library/get-library';
import { getMyFavoriteAuthors } from '../../api/users/get-favorite-authors';
import { setHidden } from '../../api/library/set-hidden';
import { setAuthorHidden } from '../../api/users/set-author-hidden';

vi.mock('../../api/library/get-library');
vi.mock('../../api/users/get-favorite-authors');
vi.mock('../../api/library/set-hidden');
vi.mock('../../api/users/set-author-hidden');

const mockedLibrary = vi.mocked(getLibrary);
const mockedAuthors = vi.mocked(getMyFavoriteAuthors);
const mockedSetHidden = vi.mocked(setHidden);
const mockedSetAuthorHidden = vi.mocked(setAuthorHidden);

function rawEntry(id: number, title: string, isHidden = false) {
  return {
    book_id: id,
    status: 'read',
    title,
    book_slug: `book-${id}`,
    author_name: 'Carl Sagan',
    author_slug: 'carl-sagan',
    year: 1980,
    rating: null,
    cover_url: null,
    hue: '#000',
    is_hidden: isHidden,
  };
}

beforeEach(() => {
  mockedLibrary.mockReset();
  mockedAuthors.mockReset();
  mockedSetHidden.mockReset();
  mockedSetAuthorHidden.mockReset();
  mockedLibrary.mockResolvedValue({
    entries: [rawEntry(1, 'Cosmos'), rawEntry(2, 'Contact', true)] as never,
    total: 2,
    page: 1,
    pageSize: 60,
  } as never);
  mockedAuthors.mockResolvedValue({
    authors: [
      { name: 'Ursula Le Guin', slug: 'ursula-le-guin', bookCount: 4, isHidden: false },
      { name: 'Iain Banks', slug: 'iain-banks', bookCount: 2, isHidden: true },
    ],
  });
  mockedSetHidden.mockResolvedValue({ entry: {} as never });
  mockedSetAuthorHidden.mockResolvedValue({ author: { slug: '', isHidden: false } });
});

describe('PublicVisibilityPicker', () => {
  it('ticks what is public and unticks what is hidden', async () => {
    render(<PublicVisibilityPicker isPublic />);

    expect(await screen.findByRole('checkbox', { name: /Cosmos/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Contact/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Ursula Le Guin/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Iain Banks/ })).not.toBeChecked();
  });

  it('hides a book when its tick is cleared', async () => {
    render(<PublicVisibilityPicker isPublic />);
    const cosmos = await screen.findByRole('checkbox', { name: /Cosmos/ });

    await userEvent.click(cosmos);

    expect(mockedSetHidden).toHaveBeenCalledWith(1, true);
    expect(cosmos).not.toBeChecked();
  });

  it('shows a hidden author again when ticked', async () => {
    render(<PublicVisibilityPicker isPublic />);
    const banks = await screen.findByRole('checkbox', { name: /Iain Banks/ });

    await userEvent.click(banks);

    expect(mockedSetAuthorHidden).toHaveBeenCalledWith('iain-banks', false);
    expect(banks).toBeChecked();
  });

  it('counts only what the filter shows, and acts on that much', async () => {
    render(<PublicVisibilityPicker isPublic />);
    await screen.findByRole('checkbox', { name: /Cosmos/ });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Filter books' }), 'Contact');

    expect(screen.queryByRole('checkbox', { name: /Cosmos/ })).not.toBeInTheDocument();
    // One book, and it is hidden, so the button offers to show it.
    await userEvent.click(screen.getByRole('button', { name: 'Show all 1' }));
    expect(mockedSetHidden).toHaveBeenCalledWith(2, false);
    expect(mockedSetHidden).toHaveBeenCalledTimes(1);
  });

  it('asks nothing of the server for books already in the wanted state', async () => {
    mockedLibrary.mockResolvedValue({
      entries: [rawEntry(1, 'Cosmos'), rawEntry(3, 'Pale Blue Dot')] as never,
      total: 2,
      page: 1,
      pageSize: 60,
    } as never);

    render(<PublicVisibilityPicker isPublic />);
    await screen.findByRole('checkbox', { name: /Cosmos/ });

    // Both are already public, so "hide all" is the offer — and showing all
    // would be a no-op that must not cost two requests.
    expect(screen.getByRole('button', { name: 'Hide all 2' })).toBeInTheDocument();
  });

  it('says the choice applies later while the page is private', async () => {
    render(<PublicVisibilityPicker isPublic={false} />);

    expect(
      await screen.findByText(/takes effect when you make the page public/i),
    ).toBeInTheDocument();
  });

  it('puts a book back on the page when the request fails', async () => {
    mockedSetHidden.mockRejectedValue(new Error('nope'));

    render(<PublicVisibilityPicker isPublic />);
    const cosmos = await screen.findByRole('checkbox', { name: /Cosmos/ });

    await userEvent.click(cosmos);

    // Falls back to what the server last said rather than to a remembered value.
    expect(cosmos).toBeChecked();
  });

  it('groups books and authors separately', async () => {
    render(<PublicVisibilityPicker isPublic />);
    await screen.findByRole('checkbox', { name: /Cosmos/ });

    const books = screen.getByRole('heading', { name: /Books/ }).closest('section');
    expect(within(books as HTMLElement).getByRole('checkbox', { name: /Cosmos/ })).toBeInTheDocument();
    expect(
      within(books as HTMLElement).queryByRole('checkbox', { name: /Ursula/ }),
    ).not.toBeInTheDocument();
  });
});
