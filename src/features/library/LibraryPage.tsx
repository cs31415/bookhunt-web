import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { Loader } from '../../shared/components/Loader/Loader';
import { Pagination } from '../../shared/components/Pagination/Pagination';
import { ALL_LIBRARY_STATUSES } from '../../shared/types/library-status';
import type { LibraryStatus } from '../../shared/types/library-status';
import { LibraryHeader } from './components/LibraryHeader/LibraryHeader';
import { LibraryCharts } from './components/LibraryCharts/LibraryCharts';
import { StatusTabs } from './components/StatusTabs/StatusTabs';
import { FilterPill } from './components/FilterPill/FilterPill';
import { LibraryEmptyState } from './components/LibraryEmptyState/LibraryEmptyState';
import { useLibraryData } from './hooks/useLibraryData';
import { filterEntries, sortByAddedDesc, statusCounts } from './lib/breakdowns';
import styles from './LibraryPage.module.css';

const PAGE_SIZE = 60;

function asStatus(value: string | null): LibraryStatus | null {
  return value && (ALL_LIBRARY_STATUSES as string[]).includes(value)
    ? (value as LibraryStatus)
    : null;
}

export function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entries, total, loading, error } = useLibraryData();
  const [page, setPage] = useState(1);

  const status = asStatus(searchParams.get('status'));
  const subject = searchParams.get('subject');
  const author = searchParams.get('author');

  // Reset to the first page whenever the active filter changes.
  const filterKey = `${status ?? ''}|${subject ?? ''}|${author ?? ''}`;
  const [syncedKey, setSyncedKey] = useState(filterKey);
  if (filterKey !== syncedKey) {
    setSyncedKey(filterKey);
    setPage(1);
  }

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  // Status is one axis; subject/author is a single mutually-exclusive attribute pill.
  function selectStatus(next: LibraryStatus | null) {
    updateParams({ status: next === status ? null : next, subject: null, author: null });
  }
  function selectSubject(next: string) {
    updateParams({ subject: next, author: null });
  }
  function selectAuthor(next: string) {
    updateParams({ author: next, subject: null });
  }
  function clearAttribute() {
    updateParams({ subject: null, author: null });
  }

  function addFromPhoto() {
    // TODO(LOS-82): open the Scan modal (photo import) — not yet built.
  }

  const sorted = useMemo(
    () => sortByAddedDesc(filterEntries(entries, { status, subject, author })),
    [entries, status, subject, author],
  );
  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className={styles.page}>
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={styles.page}>
        <LibraryEmptyState onDiscover={() => navigate('/')} onAddFromPhoto={addFromPhoto} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <LibraryHeader total={total} onAddFromPhoto={addFromPhoto} />

      <LibraryCharts
        entries={entries}
        onSelectStatus={selectStatus}
        onSelectSubject={selectSubject}
        onSelectAuthor={selectAuthor}
      />

      <StatusTabs
        counts={statusCounts(entries)}
        total={total}
        active={status}
        onSelect={selectStatus}
      />

      {subject && <FilterPill label="subject" value={subject} onClear={clearAttribute} />}
      {author && <FilterPill label="author" value={author} onClear={clearAttribute} />}

      {sorted.length === 0 ? (
        <p className={styles.noMatch}>No books match this filter.</p>
      ) : (
        <div className={styles.grid}>
          {pageItems.map((entry) => (
            <BookCard
              key={entry.book.id}
              book={entry.book}
              status={entry.status}
              onClick={() => navigate(`/books/${entry.book.slug}`)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}
