import { useEffect, useState } from 'react';
import { getLibrary } from '../../../api/library/get-library';
import type { BookSummary } from '../../../shared/types/book';
import type { LibraryStatus } from '../../../shared/types/library-status';

export interface RelatedWork {
  book: BookSummary;
  source: 'you' | 'auto';
  inLibrary: boolean;
  status?: LibraryStatus;
}

export interface UseRelatedReadsResult {
  works: RelatedWork[];
  loading: boolean;
  reload: () => void;
}

/**
 * Cross-references related books against the caller's own library so
 * RelatedCard can render in-library items full-color with a rust border and
 * dim the rest. Reuses GET /library (the same call Discover makes) rather
 * than adding a dedicated endpoint — note this only sees the first page of
 * the caller's library (backend default limit 24), so a related book that's
 * in a very large library past that page may render as "not in library".
 */
export function useRelatedReads(
  relatedBooks: BookSummary[],
  userRelatedIds: number[],
  algoRelatedIds: number[],
): UseRelatedReadsResult {
  const [statusById, setStatusById] = useState<Map<number, LibraryStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await getLibrary();
        if (cancelled) return;
        setStatusById(new Map(res.entries.map((e) => [e.book_id, e.status])));
      } catch {
        // Falls back to treating every related book as "not in library".
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const userIdSet = new Set(userRelatedIds);
  const userBooks = relatedBooks.filter((b) => userIdSet.has(b.id));
  const algoBooks = relatedBooks.filter((b) => !userIdSet.has(b.id) && algoRelatedIds.includes(b.id));

  const works: RelatedWork[] = [
    ...userBooks.map((book) => ({
      book,
      source: 'you' as const,
      inLibrary: statusById.has(book.id),
      status: statusById.get(book.id),
    })),
    ...algoBooks.map((book) => ({
      book,
      source: 'auto' as const,
      inLibrary: statusById.has(book.id),
      status: statusById.get(book.id),
    })),
  ].sort((a, z) => {
    const aRank = a.inLibrary ? 0 : 1;
    const zRank = z.inLibrary ? 0 : 1;
    if (aRank !== zRank) return aRank - zRank;
    return (a.source === 'you' ? 0 : 1) - (z.source === 'you' ? 0 : 1);
  });

  return { works, loading, reload: () => setReloadToken((t) => t + 1) };
}
