import { useEffect, useState } from 'react';
import { getAuthor } from '../../../api/authors/get-author';
import { ApiError } from '../../../api/client';
import { normalizeAuthor } from '../../../normalize/author';
import type { AuthorDetail, AuthorWork } from '../../../normalize/author';

export interface UseAuthorDataResult {
  author: AuthorDetail | null;
  works: AuthorWork[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
}

export function useAuthorData(slug: string): UseAuthorDataResult {
  const [author, setAuthor] = useState<AuthorDetail | null>(null);
  const [works, setWorks] = useState<AuthorWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      window.scrollTo(0, 0);

      try {
        const raw = await getAuthor(slug);
        if (cancelled) return;
        const result = normalizeAuthor(raw);
        setAuthor(result.author);
        setWorks(result.works);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError('Could not load this author. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, reloadToken]);

  return {
    author,
    works,
    loading,
    notFound,
    error,
    reload: () => setReloadToken((t) => t + 1),
  };
}
