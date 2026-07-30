import { useEffect, useState } from 'react';
import { getLibrary } from '../../../api/library/get-library';
import { normalizeLibraryEntry } from '../../../normalize/library';
import type { LibraryEntry } from '../../../normalize/library';

export interface UseLibraryDataResult {
  entries: LibraryEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// The whole library comes back in one call (the API does not paginate — LOS-65),
// so charts, tabs, and grid all derive from this single normalized list.
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
        const library = await getLibrary();
        if (cancelled) return;
        const normalized = library.entries.map(normalizeLibraryEntry);
        setEntries(normalized);
        setTotal(library.stats.total ?? normalized.length);
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
