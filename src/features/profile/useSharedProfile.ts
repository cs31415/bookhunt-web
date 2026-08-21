import { useEffect, useState } from 'react';
import { getLibraryByToken, getProfileByToken } from '../../api/users/get-by-token';
import type { RawPublicProfile } from '../../api/users/get-profile';
import { ApiError, isAbortError } from '../../api/client';
import { normalizeLibraryEntry } from '../../normalize/library';
import type { LibraryEntry } from '../../normalize/library';
import type { ProfileTab } from './useProfile';
import type { ProfileFilters } from './useProfile';

/** The API filters each tab answers with, as on the public shelf. */
const TAB_QUERY: Record<ProfileTab, { status?: string; favorites?: boolean }> = {
  library: {},
  reading: { status: 'reading' },
  favorites: { favorites: true },
};

interface Answer {
  key: string;
  profile: RawPublicProfile | null;
  entries: LibraryEntry[];
  total: number;
  outcome: 'ok' | 'not-found' | 'error';
}

export interface SharedProfile {
  profile: RawPublicProfile | null;
  entries: LibraryEntry[];
  total: number;
  loading: boolean;
  /** True for an unknown token and a revoked one alike — the two are one case. */
  notFound: boolean;
  error: boolean;
}

/**
 * A profile at its unlisted address (LOS-305).
 *
 * The same shape as useVisitorProfile, reading the token endpoints instead of
 * the handle ones. Kept as its own hook rather than a flag on that one: the
 * two take different identifiers, and threading a "sometimes a handle,
 * sometimes a token" argument through would make it easy to call the wrong one.
 *
 * Hidden books never arrive here — the API excludes them, exactly as it does
 * for the public shelf. Unlisted means "not listed", not "everything on show".
 */
export function useSharedProfile(
  token: string,
  tab: ProfileTab | null,
  page: number,
  pageSize: number,
  filters: ProfileFilters = { q: '', subject: '' },
): SharedProfile {
  const { q, subject } = filters;
  const key = `${token}|${tab ?? 'none'}|${page}|${pageSize}|${q}|${subject}`;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getProfileByToken(token, controller.signal),
      tab === null
        ? Promise.resolve(null)
        : getLibraryByToken(
            { token, ...TAB_QUERY[tab], page, limit: pageSize, q, subject },
            controller.signal,
          ),
    ])
      .then(([profileResponse, libraryResponse]) =>
        setAnswer({
          key,
          profile: profileResponse.profile,
          entries: libraryResponse ? libraryResponse.entries.map(normalizeLibraryEntry) : [],
          total: libraryResponse?.total ?? 0,
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
          // 404 covers an unknown token and a revoked one. The API will not say
          // which, and neither will this.
          outcome: err instanceof ApiError && err.status === 404 ? 'not-found' : 'error',
        });
      });

    return () => controller.abort();
  }, [key, token, tab, page, pageSize, q, subject]);

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
