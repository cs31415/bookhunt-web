import { useEffect, useState } from 'react';
import { Cover } from '../../../../shared/components/Cover/Cover';
import { getSearch } from '../../../../api/search/get-search';
import { normalizeSearchResponse } from '../../../../normalize/search';
import type { BookSummary } from '../../../../shared/types/book';
import styles from './RelatedPicker.module.css';

export interface RelatedPickerProps {
  excludeIds: number[];
  onPick: (bookId: number) => void;
  onClose: () => void;
}

export function RelatedPicker({ excludeIds, onPick, onClose }: RelatedPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSummary[]>([]);
  const excludeKey = excludeIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      getSearch({ q: query || undefined, limit: 30, sort: query ? 'relevance' : 'rating' })
        .then((raw) => {
          if (cancelled) return;
          const exclude = new Set(excludeKey ? excludeKey.split(',').map(Number) : []);
          setResults(normalizeSearchResponse(raw).results.map((r) => r.book).filter((b) => !exclude.has(b.id)));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, excludeKey]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.searchWrap}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a book to link as related…"
            className={styles.input}
          />
        </div>
        <button type="button" className={styles.doneButton} onClick={onClose}>
          Done
        </button>
      </div>
      <div className={styles.list}>
        {results.length === 0 && <div className={styles.empty}>No more books to add.</div>}
        {results.map((book) => (
          <button key={book.id} type="button" className={styles.row} onClick={() => onPick(book.id)}>
            <Cover book={book} width={34} />
            <div className={styles.info}>
              <div className={styles.title}>{book.title}</div>
              <div className={styles.meta}>
                {book.authorName}
                {book.year ? ` · ${book.year}` : ''}
              </div>
            </div>
            <span className={styles.plus}>+</span>
          </button>
        ))}
      </div>
    </div>
  );
}
