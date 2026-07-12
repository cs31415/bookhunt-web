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
  moods: string[];
  loading: boolean;
}

/**
 * Catalog books usually already have genres/themes/moods persisted (from
 * fn_get_book_by_slug). Only calls POST /ai/themes/:bookId when any of the
 * three is empty — this also backfills moods on older rows that were
 * generated before moods existed, matching the backend's own cache-hit gate
 * in getBookGenresThemes (ai-data.ts), which regenerates all three together.
 */
export function useThemes(
  bookId: number | null,
  genres: string[],
  themes: string[],
  moods: string[],
): UseThemesResult {
  const alreadyPopulated = genres.length > 0 && themes.length > 0 && moods.length > 0;
  const [generated, setGenerated] = useState<string[]>([]);
  const [generatedMoods, setGeneratedMoods] = useState<string[]>([]);
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
        if (!cancelled) {
          setGenerated(dedupe([...result.genres, ...result.themes]));
          setGeneratedMoods(dedupe(result.moods));
        }
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
    moods: alreadyPopulated ? dedupe(moods) : generatedMoods,
    loading,
  };
}
