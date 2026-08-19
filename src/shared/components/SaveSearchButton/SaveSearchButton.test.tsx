import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveSearchButton } from './SaveSearchButton';
import { ApiError } from '../../../api/client';
import {
  saveCannedSearch,
  unpinCannedSearch,
} from '../../../api/canned-searches/pin-canned-search';
import { getCannedSearches } from '../../../api/canned-searches/get-canned-searches';
import type { CannedSearch } from '../../../api/canned-searches/types';
import { setStoredUser } from '../../../api/auth/stored-user';
import { AuthProvider } from '../../../features/auth/AuthContext';
import { ToastHost } from '../../toast/ToastHost';
import { clearToasts } from '../../toast/toast-store';

vi.mock('../../../api/canned-searches/pin-canned-search');
vi.mock('../../../api/canned-searches/get-canned-searches');

const mockedSaveCannedSearch = vi.mocked(saveCannedSearch);
const mockedUnpin = vi.mocked(unpinCannedSearch);
const mockedGetCannedSearches = vi.mocked(getCannedSearches);

const SAVED: CannedSearch = { id: 900, query: 'novels about map makers who lied', category: 'saved' };

const SAVE_BUTTON = { name: /Keep this search as a pill/ };
const REMOVE_BUTTON = { name: /Remove this search as a pill/ };

/** What the reader has pinned, which is what decides the wording. */
function pinnedRow(pinned: CannedSearch[] = []) {
  return { pinned, suggested: [], history: [] };
}

/** AuthProvider hydrates from localStorage, so seeding it is enough to sign in. */
function signIn() {
  setStoredUser({ id: 1, email: 'reader@example.com', displayName: 'Reader' });
}

function renderButton(query: string, onSaved?: (search: CannedSearch) => void) {
  return render(
    <AuthProvider>
      <SaveSearchButton query={query} onSaved={onSaved} />
      <ToastHost />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearToasts();
  mockedSaveCannedSearch.mockResolvedValue(SAVED);
  mockedUnpin.mockResolvedValue(undefined);
  mockedGetCannedSearches.mockResolvedValue(pinnedRow());
});

afterEach(() => {
  localStorage.clear();
  clearToasts();
});

describe('SaveSearchButton', () => {
  // Saving writes a row owned by the reader, and there is nowhere to put a
  // guest's — so the offer is withheld rather than shown and then failing.
  it('offers nothing to a guest', () => {
    renderButton(SAVED.query);
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();
  });

  it.each([['', 'empty'], ['ab', 'shorter than the server accepts'], ['   ', 'only whitespace']])(
    'offers nothing for a query that is %s (%s)',
    (query) => {
      signIn();
      renderButton(query);
      expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();
    },
  );

  it('saves the trimmed query, reports it, and hands the row to onSaved', async () => {
    signIn();
    const onSaved = vi.fn();
    renderButton(`  ${SAVED.query}  `, onSaved);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));

    expect(await screen.findByText(`Saved “${SAVED.query}” as a pill.`)).toBeInTheDocument();
    expect(mockedSaveCannedSearch).toHaveBeenCalledWith(SAVED.query);
    expect(onSaved).toHaveBeenCalledWith(SAVED);
  });

  // The server answers the same text idempotently with the row that already
  // exists, so offering to save it again is an offer that does nothing.
  it('turns into the offer to remove it once saved', async () => {
    signIn();
    renderButton(SAVED.query);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));

    expect(await screen.findByRole('button', REMOVE_BUTTON)).toBeInTheDocument();
    expect(mockedSaveCannedSearch).toHaveBeenCalledTimes(1);
  });

  it('offers to remove a search the reader arrived on from their own pill', async () => {
    signIn();
    mockedGetCannedSearches.mockResolvedValue(pinnedRow([SAVED]));
    renderButton(SAVED.query);

    expect(await screen.findByRole('button', REMOVE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByRole('button', SAVE_BUTTON)).not.toBeInTheDocument();
  });

  it('matches the pill by what it says, whatever the casing and spacing', async () => {
    signIn();
    mockedGetCannedSearches.mockResolvedValue(pinnedRow([SAVED]));
    renderButton(`  ${SAVED.query.toUpperCase()} `);

    expect(await screen.findByRole('button', REMOVE_BUTTON)).toBeInTheDocument();
  });

  it('removes the pill and offers to keep it again', async () => {
    signIn();
    const onRemoved = vi.fn();
    mockedGetCannedSearches.mockResolvedValue(pinnedRow([SAVED]));
    render(
      <AuthProvider>
        <SaveSearchButton query={SAVED.query} onRemoved={onRemoved} />
        <ToastHost />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole('button', REMOVE_BUTTON));

    expect(await screen.findByText(`Removed “${SAVED.query}” from your pills.`)).toBeInTheDocument();
    expect(mockedUnpin).toHaveBeenCalledWith(SAVED.id);
    expect(onRemoved).toHaveBeenCalledWith(SAVED);
    expect(screen.getByRole('button', SAVE_BUTTON)).toBeInTheDocument();
  });

  it('keeps the pill when the server refuses to remove it', async () => {
    signIn();
    mockedGetCannedSearches.mockResolvedValue(pinnedRow([SAVED]));
    mockedUnpin.mockRejectedValue(new Error('network'));
    renderButton(SAVED.query);

    fireEvent.click(await screen.findByRole('button', REMOVE_BUTTON));

    expect(await screen.findByText('Could not remove that pill. Please try again.')).toBeInTheDocument();
    // Never claims a state the server denied.
    expect(screen.getByRole('button', REMOVE_BUTTON)).toBeInTheDocument();
  });

  it('asks for nothing when there is no offer to make', () => {
    renderButton(SAVED.query);
    expect(mockedGetCannedSearches).not.toHaveBeenCalled();
  });

  it('offers again once the reader edits the query', async () => {
    signIn();
    const { rerender } = renderButton(SAVED.query);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));
    await screen.findByRole('button', REMOVE_BUTTON);

    rerender(
      <AuthProvider>
        <SaveSearchButton query="novels about map makers who told the truth" />
        <ToastHost />
      </AuthProvider>,
    );
    expect(screen.getByRole('button', SAVE_BUTTON)).toBeInTheDocument();
  });

  it('reports the pin cap as its own message rather than a generic failure', async () => {
    signIn();
    mockedSaveCannedSearch.mockRejectedValue(new ApiError(409, 'Pin limit reached'));
    renderButton(SAVED.query);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));

    expect(await screen.findByText('You can pin up to 6 searches.')).toBeInTheDocument();
    // Nothing was kept, so the offer stands.
    expect(screen.getByRole('button', SAVE_BUTTON)).toBeInTheDocument();
  });

  it('reports any other failure as retryable', async () => {
    signIn();
    mockedSaveCannedSearch.mockRejectedValue(new Error('network'));
    renderButton(SAVED.query);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));

    expect(
      await screen.findByText('Could not save that search. Please try again.'),
    ).toBeInTheDocument();
  });
});
