import { useEffect, useState } from 'react';
import { ApiError } from '../../../api/client';
import { getLibrary } from '../../../api/library/get-library';
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
        const library = await getLibrary();
        if (cancelled) return;

        const entries = library.entries.map(normalizeLibraryEntry);
        setData({
          currentlyReading: entries.filter((entry) => entry.status === 'reading'),
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
