import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { SearchBar } from '../SearchBar/SearchBar';
import { searchUsers } from '../../../api/users/search-users';

vi.mock('../../../api/users/search-users');

const mockedSearch = vi.mocked(searchUsers);

const users = [
  { handle: 'ada', displayName: 'Ada Reader', bookCount: 12 },
  { handle: 'adare', displayName: 'Adare Wolfe', bookCount: 3 },
];

/** Drives SearchBar as a real caller does: controlled value, people mode on. */
function Harness({ onSubmit }: { onSubmit?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <SearchBar people value={value} onChange={setValue} onSubmit={onSubmit} big />;
}

function renderBar(onSubmit?: (value: string) => void) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Harness onSubmit={onSubmit} /> },
      { path: '/:handle', element: <div>Profile page</div> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  // By label, not role: the combobox role only exists while the dropdown is open.
  return screen.getByLabelText('Search');
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockedSearch.mockReset();
  mockedSearch.mockResolvedValue({ users });
});

// Handed back deliberately. Fake timers left on outlive the file that turned
// them on, and a later test waiting on a real one then waits forever (LOS-332).
afterEach(() => {
  vi.useRealTimers();
});

async function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await vi.advanceTimersByTimeAsync(400);
}

describe('the @ reader search', () => {
  it('stays in book mode until the query starts with @', async () => {
    const input = renderBar();
    await type(input, 'dune');

    // No combobox role at all in book mode, which is the point.
    expect(input).not.toHaveAttribute('aria-expanded');
    expect(input).not.toHaveAttribute('role');
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('switches to people mode on @ and looks up the rest', async () => {
    const input = renderBar();
    await type(input, '@ada');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(mockedSearch).toHaveBeenCalledWith('ada', expect.any(AbortSignal));
    expect(await screen.findByText('@ada')).toBeInTheDocument();
  });

  it('returns to book mode with the query intact when the @ is deleted', async () => {
    // The mode is the text, not a toggle, so nothing has to be reset.
    const input = renderBar();
    await type(input, '@ada');
    await type(input, 'ada');

    expect(input).not.toHaveAttribute('aria-expanded');
    expect(input).toHaveValue('ada');
  });

  it('debounces rather than asking once per keystroke', async () => {
    const input = renderBar();
    fireEvent.change(input, { target: { value: '@a' } });
    fireEvent.change(input, { target: { value: '@ad' } });
    fireEvent.change(input, { target: { value: '@ada' } });
    await vi.advanceTimersByTimeAsync(400);

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith('ada', expect.any(AbortSignal));
  });

  it('moves through the list with the arrow keys', async () => {
    const input = renderBar();
    await type(input, '@ada');
    await screen.findByText('@ada');

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    // Wraps, so a reader holding the key never falls off the end.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the highlighted reader on Enter, and does not submit a book search', async () => {
    const onSubmit = vi.fn();
    const input = renderBar(onSubmit);
    await type(input, '@ada');
    await screen.findByText('@ada');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Profile page')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('says so when nobody matches', async () => {
    mockedSearch.mockResolvedValue({ users: [] });
    const input = renderBar();
    await type(input, '@nobody');

    expect(await screen.findByText('No readers found.')).toBeInTheDocument();
  });

  it('cannot render a stale answer over a newer query', async () => {
    // Tagged by the query it answered, so a slow reply for "@a" never lands
    // under the results for "@ada".
    mockedSearch.mockResolvedValue({ users: [] });
    const input = renderBar();
    await type(input, '@a');
    expect(await screen.findByText('No readers found.')).toBeInTheDocument();

    mockedSearch.mockResolvedValue({ users });
    await type(input, '@ada');

    expect(await screen.findByText('@adare')).toBeInTheDocument();
  });
});
