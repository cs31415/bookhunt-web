import { useEffect, useState } from 'react';
import { ApiError } from '../../../api/client';
import { searchLibrary } from '../../../api/library/search-library';
import { normalizeLibraryEntry } from '../../../normalize/library';
import type { LibraryEntry } from '../../../normalize/library';

export interface DiscoverData {
  currentlyReading: LibraryEntry[];
}

export interface UseDiscoverDataResult {
  data: DiscoverData | null;
  loading: boolean;
  error: string | null;
}

export function useDiscoverData(): UseDiscoverDataResult {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Filtered by the server, not here. Asking for the library and keeping
        // the reading rows only ever saw the first page — 24 entries, newest
        // first — so a book started a while ago silently vanished from this
        // section (LOS-230).
        const reading = await searchLibrary({ status: 'reading' });
        if (cancelled) return;

        setData({
          currentlyReading: reading.entries.map(normalizeLibraryEntry),
        });
      } catch (err) {
        // No login flow exists yet (LOS-144), so every visitor is
        // unauthenticated and this call always 401s — that's not a real
        // failure worth alarming copy over, so stay quiet and just show the
        // logged-out hero (LOS-145). Any other failure still surfaces.
        const isLoggedOut = err instanceof ApiError && err.status === 401;
        if (!cancelled && !isLoggedOut) {
          setError('Could not load your Discover page. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
