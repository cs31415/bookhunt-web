import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveSearchButton } from './SaveSearchButton';
import { ApiError } from '../../../api/client';
import { saveCannedSearch } from '../../../api/canned-searches/pin-canned-search';
import type { CannedSearch } from '../../../api/canned-searches/types';
import { setSession } from '../../../api/auth/token';
import { AuthProvider } from '../../../features/auth/AuthContext';
import { ToastHost } from '../../toast/ToastHost';
import { clearToasts } from '../../toast/toast-store';

vi.mock('../../../api/canned-searches/pin-canned-search');

const mockedSaveCannedSearch = vi.mocked(saveCannedSearch);

const SAVED: CannedSearch = { id: 900, query: 'novels about map makers who lied', category: 'saved' };

const SAVE_BUTTON = { name: /Keep this search as a pill/ };

/** AuthProvider hydrates from localStorage, so seeding it is enough to sign in. */
function signIn() {
  setSession('test-token', { id: 1, email: 'reader@example.com', displayName: 'Reader' });
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
  // exists, so a second click would look like a no-op rather than a save.
  it('settles once saved and does not submit again', async () => {
    signIn();
    renderButton(SAVED.query);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));
    const settled = await screen.findByRole('button', { name: /Saved as a pill/ });

    fireEvent.click(settled);
    expect(mockedSaveCannedSearch).toHaveBeenCalledTimes(1);
    expect(settled).toHaveAttribute('aria-disabled', 'true');
  });

  it('offers again once the reader edits the query', async () => {
    signIn();
    const { rerender } = renderButton(SAVED.query);

    fireEvent.click(screen.getByRole('button', SAVE_BUTTON));
    await screen.findByRole('button', { name: /Saved as a pill/ });

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
