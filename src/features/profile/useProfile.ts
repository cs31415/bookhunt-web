import { useEffect, useState } from 'react';
import { getProfile } from '../../api/users/get-profile';
import type { RawPublicProfile } from '../../api/users/get-profile';
import { getPublicLibrary } from '../../api/users/get-public-library';
import { ApiError, isAbortError } from '../../api/client';
import { normalizeLibraryEntry } from '../../normalize/library';
import type { LibraryEntry } from '../../normalize/library';

export type ProfileTab = 'library' | 'reading' | 'favorites';

/** The API filters each tab answers with. */
const TAB_QUERY: Record<ProfileTab, { status?: string; favorites?: boolean }> = {
  library: {},
  reading: { status: 'reading' },
  favorites: { favorites: true },
};

interface Answer {
  /** What was asked. A result only counts while it matches the current request. */
  key: string;
  profile: RawPublicProfile | null;
  entries: LibraryEntry[];
  total: number;
  outcome: 'ok' | 'not-found' | 'error';
}

export interface VisitorProfile {
  profile: RawPublicProfile | null;
  entries: LibraryEntry[];
  total: number;
  loading: boolean;
  /** True when the handle is unknown or the page is private — the two are one case. */
  notFound: boolean;
  error: boolean;
}

/**
 * A profile as a visitor sees it: paginated from the server, one request per
 * page rather than the whole shelf up front.
 *
 * The owner's own profile does not use this. It reads the private library
 * instead, because the public endpoint 404s whenever the page is off and the
 * owner would otherwise be locked out of their own profile.
 *
 * Loading is derived from whether the stored answer matches the current
 * request, rather than set at the top of the effect. Both say the same thing,
 * but the derivation cannot go stale, and it keeps an answer for the previous
 * tab from rendering for a moment under the new one.
 */
export function useVisitorProfile(
  handle: string,
  tab: ProfileTab,
  page: number,
  pageSize: number,
): VisitorProfile {
  const key = `${handle}|${tab}|${page}|${pageSize}`;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getProfile(handle, controller.signal),
      getPublicLibrary({ handle, ...TAB_QUERY[tab], page, limit: pageSize }, controller.signal),
    ])
      .then(([profileResponse, libraryResponse]) =>
        setAnswer({
          key,
          profile: profileResponse.profile,
          entries: libraryResponse.entries.map(normalizeLibraryEntry),
          total: libraryResponse.total,
          outcome: 'ok',
        }),
      )
      .catch((err) => {
        if (isAbortError(err)) return;
        setAnswer({
          key,
          profile: null,
          entries: [],
          total: 0,
          // 404 covers both an unknown handle and a private page. The API will
          // not say which, and neither will this.
          outcome: err instanceof ApiError && err.status === 404 ? 'not-found' : 'error',
        });
      });

    return () => controller.abort();
  }, [key, handle, tab, page, pageSize]);

  const current = answer?.key === key ? answer : null;

  return {
    profile: current?.profile ?? null,
    entries: current?.entries ?? [],
    total: current?.total ?? 0,
    loading: current === null,
    notFound: current?.outcome === 'not-found',
    error: current?.outcome === 'error',
  };
}
