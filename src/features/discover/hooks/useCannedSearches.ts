import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../api/client';
import { getCannedSearches } from '../../../api/canned-searches/get-canned-searches';
import {
  getGuestDrawIds,
  getGuestPinnedIds,
  setGuestDrawIds,
  setGuestPinnedIds,
} from '../../../api/canned-searches/guest-state';
import { pinCannedSearch, unpinCannedSearch } from '../../../api/canned-searches/pin-canned-search';
import { MAX_PINNED_SEARCHES } from '../../../api/canned-searches/types';
import type { CannedSearch } from '../../../api/canned-searches/types';
import { useAuth } from '../../auth/AuthContext';
import { FALLBACK_QUERIES } from '../example-queries';

const PIN_LIMIT_MESSAGE = `You can pin up to ${MAX_PINNED_SEARCHES} searches.`;

/** Cursor sentinel for "whatever the newest row turns out to be". */
const NEWEST = Number.MAX_SAFE_INTEGER;

export interface UseCannedSearchesResult {
  pinned: CannedSearch[];
  /** The row on screen: the draw the cursor is sitting on. */
  suggested: CannedSearch[];
  loading: boolean;
  /** True only when the catalog has never loaded and the row is the fallback. */
  degraded: boolean;
  /** Draw a new row. The current one is kept, reachable with goBack. */
  refresh: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  togglePin: (search: CannedSearch) => void;
  /**
   * Put a search into the pinned row. For a pill saved elsewhere — the server
   * pins it as part of saving, so the row has to catch up without a refetch.
   */
  addPinned: (search: CannedSearch) => void;
  /** Transient message about the last action: a pin refused, a refresh that failed. */
  notice: string | null;
}

export function useCannedSearches(): UseCannedSearchesResult {
  const { isAuthenticated } = useAuth();
  const [pinned, setPinned] = useState<CannedSearch[]>([]);
  // Oldest first, so the cursor reads like a position in a history.
  const [draws, setDraws] = useState<CannedSearch[][]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Bumping this re-runs the effect below, which is how a refresh redraws.
  const [refreshToken, setRefreshToken] = useState(0);

  const inFlight = useRef(false);
  const mounted = useRef(true);
  // Read inside the loader to decide whether a failure is fatal, without making
  // the effect depend on the draws it sets.
  const hasRow = useRef(false);
  // Set on the way in as well as cleared on the way out. Without the assignment
  // here, StrictMode's mount/unmount/remount leaves it false after the first
  // cleanup and never restores it, so every state update behind an awaited
  // request is silently skipped in development.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isRefresh = refreshToken > 0;

    async function load() {
      inFlight.current = true;
      try {
        const data = await getCannedSearches({
          // Signed in, the server reads both from the database and ignores
          // these — sending them anyway would push ids at it that a merge or a
          // later draw has already superseded.
          pinnedIds: isAuthenticated ? undefined : getGuestPinnedIds(),
          drawIds: isAuthenticated || isRefresh ? undefined : getGuestDrawIds(),
          refresh: isRefresh,
          // Only worth fetching once, on the load that builds the history.
          history: !isRefresh,
        });
        if (cancelled) return;

        setPinned(data.pinned);
        setDraws((current) =>
          isRefresh
            // Appended, never truncated, so the client's history stays in step
            // with the server's: refreshing after stepping back adds a row
            // rather than discarding the ones in front of it.
            ? [...current, data.suggested]
            : [...[...data.history].reverse(), data.suggested],
        );
        // Both cases land on the newest row. NEWEST is a sentinel clamped to
        // the last index below, because the new length is not knowable here.
        setCursor(NEWEST);
        if (!isAuthenticated) setGuestDrawIds(data.suggested.map((search) => search.id));
        hasRow.current = true;
        setDegraded(false);
        setNotice(null);
      } catch {
        if (cancelled) return;
        if (hasRow.current) {
          // A refresh that failed must not tear down a working row: keep what
          // is on screen and say so. Replacing it with the fallback list looked
          // exactly like a successful refresh while quietly removing the pin
          // and refresh controls.
          setNotice('Could not load new searches. Please try again.');
          return;
        }
        // Nothing has ever loaded. The pills are the only content on a
        // logged-out Discover page, so fall back to the hardcoded queries
        // rather than an empty hero. Pinning is off: no real ids to pin.
        setDraws([FALLBACK_QUERIES]);
        setCursor(0);
        setDegraded(true);
      } finally {
        inFlight.current = false;
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, refreshToken]);

  const lastIndex = Math.max(0, draws.length - 1);
  const position = Math.min(cursor, lastIndex);

  // Guarded rather than disabling the button: disabling a focused button drops
  // focus in some browsers, and holding focus across a refresh is exactly what
  // a reader pressing it repeatedly needs.
  const refresh = useCallback(() => {
    if (inFlight.current) return;
    setRefreshToken((token) => token + 1);
  }, []);

  const goBack = useCallback(() => setCursor((c) => Math.max(0, Math.min(c, lastIndex) - 1)), [lastIndex]);
  const goForward = useCallback(() => setCursor((c) => Math.min(lastIndex, c + 1)), [lastIndex]);

  // Memoised so the `?? []` fallback does not hand togglePin a new array
  // identity on every render, which would rebuild it each time.
  const suggested = useMemo(() => draws[position] ?? [], [draws, position]);

  const replaceCurrentDraw = useCallback((next: CannedSearch[]) => {
    setDraws((current) => current.map((draw, index) => (index === position ? next : draw)));
  }, [position]);

  const togglePin = useCallback((search: CannedSearch) => {
    setNotice(null);

    const wasPinned = pinned.some((pin) => pin.id === search.id);
    if (!wasPinned && pinned.length >= MAX_PINNED_SEARCHES) {
      setNotice(PIN_LIMIT_MESSAGE);
      return;
    }

    // Move it between the two lists instead of dropping it: an unpinned pill
    // stays in the row as a suggestion, so a misclick is one click to undo and
    // the row never changes length under the reader's cursor.
    const nextPinned = wasPinned
      ? pinned.filter((pin) => pin.id !== search.id)
      : [...pinned, search];
    const nextSuggested = wasPinned
      ? [...suggested, search]
      : suggested.filter((suggestion) => suggestion.id !== search.id);

    const previousPinned = pinned;
    const previousSuggested = suggested;
    setPinned(nextPinned);
    replaceCurrentDraw(nextSuggested);

    if (!isAuthenticated) {
      setGuestPinnedIds(nextPinned.map((pin) => pin.id));
      setGuestDrawIds(nextSuggested.map((s) => s.id));
      return;
    }

    const request = wasPinned ? unpinCannedSearch(search.id) : pinCannedSearch(search.id);
    request.catch((error: unknown) => {
      if (!mounted.current) return;
      setPinned(previousPinned);
      replaceCurrentDraw(previousSuggested);
      setNotice(
        error instanceof ApiError && error.status === 409
          ? PIN_LIMIT_MESSAGE
          : 'Could not save that pin. Please try again.',
      );
    });
  }, [pinned, suggested, isAuthenticated, replaceCurrentDraw]);

  // Guarded against the same search arriving twice, which the server answers
  // idempotently with the row that already exists.
  const addPinned = useCallback((search: CannedSearch) => {
    setPinned((current) =>
      current.some((pin) => pin.id === search.id) ? current : [...current, search],
    );
  }, []);

  return {
    pinned,
    suggested,
    loading,
    degraded,
    refresh,
    goBack,
    goForward,
    canGoBack: position > 0,
    canGoForward: position < lastIndex,
    togglePin,
    addPinned,
    notice,
  };
}
