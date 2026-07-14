import { useEffect, useState } from 'react';
import { ApiError } from '../../../api/client';
import { getLibrary } from '../../../api/library/get-library';
import { getRecommendations } from '../../../api/recommendations/get-recommendations';
import { normalizeLibraryEntry, normalizeLibraryStatusCounts } from '../../../normalize/library';
import type { LibraryEntry } from '../../../normalize/library';
import { normalizeRecommendation } from '../../../normalize/recommendations';
import type { Recommendation } from '../../../normalize/recommendations';
import type { LibraryStatus } from '../../../shared/types/library-status';

const RECOMMENDATION_COUNT = 4;

export interface DiscoverData {
  currentlyReading: LibraryEntry[];
  recommendations: Recommendation[];
  totalBooks: number;
  statusCounts: Record<LibraryStatus, number>;
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
        const [library, recs] = await Promise.all([
          getLibrary(),
          getRecommendations({ limit: RECOMMENDATION_COUNT }),
        ]);
        if (cancelled) return;

        const entries = library.entries.map(normalizeLibraryEntry);
        setData({
          currentlyReading: entries.filter((entry) => entry.status === 'reading'),
          recommendations: recs.recommendations.map(normalizeRecommendation),
          totalBooks: library.stats.total,
          statusCounts: normalizeLibraryStatusCounts(library.stats.by_status),
        });
      } catch (err) {
        // No login flow exists yet (LOS-144), so every visitor is
        // unauthenticated and these calls always 401 — that's not a real
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
