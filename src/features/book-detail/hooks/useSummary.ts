import { useEffect, useState } from 'react';
import { getSummary } from '../../../api/ai/get-summary';
import { regenerateSummary } from '../../../api/ai/regenerate-summary';

export interface UseSummaryResult {
  summary: string | null;
  loading: boolean;
  error: boolean;
  regenerate: () => void;
}

export function useSummary(bookId: number | null): UseSummaryResult {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [regenerateToken, setRegenerateToken] = useState(0);

  useEffect(() => {
    if (bookId == null) return;
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
  }, [bookId, regenerateToken]);

  return { summary, loading, error, regenerate: () => setRegenerateToken((t) => t + 1) };
}
