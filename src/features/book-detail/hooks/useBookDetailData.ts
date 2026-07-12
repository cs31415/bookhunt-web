import { useEffect, useState } from 'react';
import { getBook } from '../../../api/books/get-book';
import { getAuthor } from '../../../api/authors/get-author';
import { getBooksByIds } from '../../../api/books/get-books-by-ids';
import { ApiError } from '../../../api/client';
import { normalizeBookDetail } from '../../../normalize/book-detail';
import type { BookDetailResult } from '../../../normalize/book-detail';
import { normalizeAuthor } from '../../../normalize/author';
import type { AuthorWork } from '../../../normalize/author';
import { normalizeBooksByIds } from '../../../normalize/books-by-ids';
import type { BookSummary } from '../../../shared/types/book';

export interface UseBookDetailDataResult {
  detail: BookDetailResult | null;
  authorBio: string | null;
  authorWorks: AuthorWork[];
  relatedBooks: BookSummary[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
}

export function useBookDetailData(slug: string, authorSlug?: string): UseBookDetailDataResult {
  const [detail, setDetail] = useState<BookDetailResult | null>(null);
  const [authorBio, setAuthorBio] = useState<string | null>(null);
  const [authorWorks, setAuthorWorks] = useState<AuthorWork[]>([]);
  const [relatedBooks, setRelatedBooks] = useState<BookSummary[]>([]);
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

      let bookResult: BookDetailResult;
      try {
        const raw = await getBook(slug, authorSlug);
        if (cancelled) return;
        bookResult = normalizeBookDetail(raw);
        setDetail(bookResult);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError('Could not load this book. Please try again.');
        }
        setLoading(false);
        return;
      }

      // A not-yet-cataloged (ephemeral) book has no real author page or
      // related-books data to fetch yet — nothing to attach them to.
      if (!bookResult.book.cataloged) {
        setLoading(false);
        return;
      }

      const relatedIds = [
        ...(bookResult.libraryEntry?.userRelatedIds ?? []),
        ...bookResult.book.relatedIds,
      ];
      const uniqueRelatedIds = [...new Set(relatedIds)];

      const [authorRaw, relatedRaw] = await Promise.allSettled([
        getAuthor(bookResult.book.authorSlug),
        uniqueRelatedIds.length > 0 ? getBooksByIds(uniqueRelatedIds) : Promise.resolve({ books: [] }),
      ]);
      if (cancelled) return;

      if (authorRaw.status === 'fulfilled') {
        const { author, catalogWorks } = normalizeAuthor(authorRaw.value);
        setAuthorBio(author.bio);
        setAuthorWorks(catalogWorks.filter((work) => work.book.id !== bookResult.book.id));
      }
      if (relatedRaw.status === 'fulfilled') {
        setRelatedBooks(normalizeBooksByIds(relatedRaw.value));
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, authorSlug, reloadToken]);

  return {
    detail,
    authorBio,
    authorWorks,
    relatedBooks,
    loading,
    notFound,
    error,
    reload: () => setReloadToken((t) => t + 1),
  };
}
