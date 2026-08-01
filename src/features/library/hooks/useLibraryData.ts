import { useEffect, useState } from 'react';
import { getLibrary } from '../../../api/library/get-library';
import { normalizeLibraryEntry } from '../../../normalize/library';
import type { LibraryEntry, RawLibraryEntry } from '../../../normalize/library';

export interface UseLibraryDataResult {
  entries: LibraryEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// GET /library paginates server-side (LOS-118, max 60/page), but charts, tabs,
// and client-side pagination on this page are all built around having the
// whole library at once - so this walks every page up front and flattens them.
const PAGE_LIMIT = 60;

async function fetchAllEntries(
  isCancelled: () => boolean,
): Promise<{ entries: RawLibraryEntry[]; total: number }> {
  const entries: RawLibraryEntry[] = [];
  let page = 1;
  let total = 0;
  while (!isCancelled()) {
    const library = await getLibrary({ page, limit: PAGE_LIMIT });
    entries.push(...library.entries);
    // `total` rather than `stats.total`: stats come back on the first page only,
    // so that the walk does not make the server recompute them per page.
    total = library.total ?? entries.length;
    if (library.entries.length === 0 || entries.length >= total) break;
    page += 1;
  }
  return { entries, total };
}

export function useLibraryData(): UseLibraryDataResult {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Only the first load blanks the page; a reload after a photo import keeps
      // the existing grid on screen until the fresh list arrives.
      if (reloadToken === 0) setLoading(true);
      setError(null);
      try {
        const { entries: rows, total: libraryTotal } = await fetchAllEntries(() => cancelled);
        if (cancelled) return;
        setEntries(rows.map(normalizeLibraryEntry));
        setTotal(libraryTotal);
      } catch {
        // The route is auth-gated (RequireAuth), so a failure here is a real
        // problem worth surfacing rather than the logged-out case Discover swallows.
        if (!cancelled) setError('Could not load your library. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { entries, total, loading, error, reload: () => setReloadToken((t) => t + 1) };
}
