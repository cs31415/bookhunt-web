import { useEffect, useState } from 'react';
import { getProfile } from '../../api/users/get-profile';
import type { RawPublicProfile } from '../../api/users/get-profile';
import { getPublicLibrary } from '../../api/users/get-public-library';
import { getLibraryByToken, getProfileByToken } from '../../api/users/get-by-token';
import { ApiError, isAbortError } from '../../api/client';
import { normalizeLibraryEntry } from '../../normalize/library';
import type { LibraryEntry } from '../../normalize/library';
import type { ProfileTab } from './useProfile';

export interface ProfileFilters {
  /** Title or author (LOS-304). */
  q: string;
  /** One category, as clicked on a pill. */
  subject: string;
  /** One mood, and one theme, filtered server-side like the two above. */
  mood: string;
  theme: string;
}

/** The API filters each tab answers with. */
const TAB_QUERY: Record<ProfileTab, { status?: string; favorites?: boolean }> = {
  library: {},
  reading: { status: 'reading' },
  favorites: { favorites: true },
};

/**
 * Which address the shelf is reached by. A handle is the public profile; a
 * token is the unlisted one (LOS-305). Only the two fetches differ, so the kind
 * is a parameter rather than a second copy of this hook -- the copy is what let
 * the two drift last time.
 */
export type ShelfKind = 'handle' | 'token';

export interface ShelfView {
  profile: RawPublicProfile | null;
  entries: LibraryEntry[];
  total: number;
  /** Nothing to show yet. Only before the first answer for this profile. */
  loading: boolean;
  /** A newer request is in flight and the screen holds the previous answer. */
  searching: boolean;
  /** Unknown handle, private page, unknown or revoked token — all one case. */
  notFound: boolean;
  error: boolean;
}

interface Header {
  id: string;
  profile: RawPublicProfile | null;
  outcome: 'ok' | 'not-found' | 'error';
}

interface Shelf {
  id: string;
  key: string;
  entries: LibraryEntry[];
  total: number;
  outcome: 'ok' | 'not-found' | 'error';
}

/**
 * One reader's shelf, however it was reached.
 *
 * Three things here are deliberate, and all three are why searching used to
 * feel slow when the query itself takes about four milliseconds (LOS-310).
 *
 * **The header is fetched on the id alone.** Who this reader is cannot change
 * because a search term did, so a search must not re-request it. It used to
 * share one effect with the shelf, which meant two round trips per keystroke
 * and the slower of them gating the render.
 *
 * **The previous answer stays on screen while the next is fetched.** `loading`
 * is now "nothing to show yet", not "a request is in flight". Blanking the page
 * mid-search unmounted the search box along with everything else, which threw
 * away focus and made a 400ms wait feel far longer than it was.
 *
 * **A stale answer for a different profile is not shown.** Keeping the last
 * result is only right within one profile; navigating to another reader starts
 * from nothing rather than briefly showing someone else's books.
 */
export function useShelf(
  kind: ShelfKind,
  id: string,
  tab: ProfileTab | null,
  page: number,
  pageSize: number,
  filters: ProfileFilters = { q: '', subject: '', mood: '', theme: '' },
): ShelfView {
  const { q, subject, mood, theme } = filters;
  const [header, setHeader] = useState<Header | null>(null);
  const [shelf, setShelf] = useState<Shelf | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const request =
      kind === 'handle'
        ? getProfile(id, controller.signal)
        : getProfileByToken(id, controller.signal);

    request
      .then((response) => setHeader({ id, profile: response.profile, outcome: 'ok' }))
      .catch((err) => {
        if (isAbortError(err)) return;
        setHeader({
          id,
          profile: null,
          // 404 covers every way a profile can be unreachable. The API will not
          // say which, and neither will this.
          outcome: err instanceof ApiError && err.status === 404 ? 'not-found' : 'error',
        });
      });

    return () => controller.abort();
  }, [kind, id]);

  const key = `${kind}|${id}|${tab ?? 'none'}|${page}|${pageSize}|${q}|${subject}|${mood}|${theme}`;

  useEffect(() => {
    // A null tab means the section on screen is not a shelf -- favourite
    // authors, which fetch their own list.
    if (tab === null) return;

    const controller = new AbortController();
    const args = { ...TAB_QUERY[tab], page, limit: pageSize, q, subject, mood, theme };

    const request =
      kind === 'handle'
        ? getPublicLibrary({ handle: id, ...args }, controller.signal)
        : getLibraryByToken({ token: id, ...args }, controller.signal);

    request
      .then((response) =>
        setShelf({
          id,
          key,
          entries: response.entries.map(normalizeLibraryEntry),
          total: response.total,
          outcome: 'ok',
        }),
      )
      .catch((err) => {
        if (isAbortError(err)) return;
        setShelf({
          id,
          key,
          entries: [],
          total: 0,
          outcome: err instanceof ApiError && err.status === 404 ? 'not-found' : 'error',
        });
      });

    return () => controller.abort();
  }, [key, kind, id, tab, page, pageSize, q, subject, mood, theme]);

  // Only the current profile's answer may be shown. Within it, an answer for an
  // earlier query is kept on screen until the newer one lands.
  const shownShelf = shelf?.id === id ? shelf : null;
  const currentHeader = header?.id === id ? header : null;

  return {
    profile: currentHeader?.profile ?? null,
    entries: shownShelf?.entries ?? [],
    total: shownShelf?.total ?? 0,
    loading: currentHeader === null || (tab !== null && shownShelf === null),
    searching: shownShelf !== null && shownShelf.key !== key,
    // The header is the authority: it is the request that asks whether this
    // profile is reachable at all.
    notFound: currentHeader?.outcome === 'not-found',
    error: currentHeader?.outcome === 'error' || shownShelf?.outcome === 'error',
  };
}
