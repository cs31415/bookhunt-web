import { useEffect, useState } from 'react';
import { getSummary } from '../../../api/ai/get-summary';
import { regenerateSummary } from '../../../api/ai/regenerate-summary';

export interface UseSummaryResult {
  summary: string | null;
  loading: boolean;
  error: boolean;
  regenerate: () => void;
}

/**
 * A not-yet-cataloged (ephemeral) book has no bookId to fetch/cache an AI
 * summary against — show its blurb directly instead, matching what
 * GET /ai/summary/:bookId itself already prefers when one is stored.
 */
export function useSummary(bookId: number | null, cataloged: boolean, blurb: string): UseSummaryResult {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [regenerateToken, setRegenerateToken] = useState(0);

  useEffect(() => {
    if (bookId == null || !cataloged) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const fetcher = regenerateToken > 0 ? regenerateSummary : getSummary;
        const result = await fetcher(bookId!);
        if (cancelled) return;
        setSummary(result.summary);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bookId, cataloged, regenerateToken]);

  if (!cataloged) {
    return { summary: blurb, loading: false, error: false, regenerate: () => {} };
  }

  return { summary, loading, error, regenerate: () => setRegenerateToken((t) => t + 1) };
}
