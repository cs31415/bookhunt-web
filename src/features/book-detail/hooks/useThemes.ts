import { useEffect, useState } from 'react';
import { generateThemes } from '../../../api/ai/generate-themes';

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

export interface UseThemesResult {
  themes: string[];
  loading: boolean;
}

/**
 * Catalog books usually already have genres/themes persisted (from
 * fn_get_book_by_slug). Only calls POST /ai/themes/:bookId when both are
 * empty, avoiding a wasted round trip for the common case.
 */
export function useThemes(bookId: number | null, genres: string[], themes: string[]): UseThemesResult {
  const alreadyPopulated = genres.length > 0 || themes.length > 0;
  const [generated, setGenerated] = useState<string[]>([]);
  const [loading, setLoading] = useState(!alreadyPopulated);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (bookId == null || alreadyPopulated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await generateThemes(bookId);
        if (!cancelled) setGenerated(dedupe([...result.genres, ...result.themes]));
      } catch {
        // Themes are a nice-to-have; failing silently leaves the pill row empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bookId, alreadyPopulated]);

  return {
    themes: alreadyPopulated ? dedupe([...genres, ...themes]) : generated,
    loading,
  };
}
