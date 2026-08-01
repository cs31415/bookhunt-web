import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { Loader } from '../../shared/components/Loader/Loader';
import { Pagination } from '../../shared/components/Pagination/Pagination';
import { ALL_LIBRARY_STATUSES } from '../../shared/types/library-status';
import type { LibraryStatus } from '../../shared/types/library-status';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { LibraryHeader } from './components/LibraryHeader/LibraryHeader';
import { LibraryCharts } from './components/LibraryCharts/LibraryCharts';
import { StatusTabs } from './components/StatusTabs/StatusTabs';
import { FilterPill } from './components/FilterPill/FilterPill';
import { LibraryEmptyState } from './components/LibraryEmptyState/LibraryEmptyState';
import { ScanModal } from './components/ScanModal/ScanModal';
import { CsvImportModal } from './components/CsvImportModal/CsvImportModal';
import { useLibraryData } from './hooks/useLibraryData';
import { useScanSession } from './hooks/useScanSession';
import { useCsvImportSession } from './hooks/useCsvImportSession';
import { toast } from '../../shared/toast/toast-store';
import { isPhotoImportEnabled } from '../../shared/config/features';
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
  const { entries, total, loading, error, reload } = useLibraryData();
  const [page, setPage] = useState(1);
  const [scanOpen, setScanOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  // The scan session lives here, not in ScanModal, so closing the modal mid-scan
  // doesn't abandon the in-flight promise. scanOpenRef lets the completion
  // callback tell "still watching" from "closed and needs a toast" without
  // re-running the session on every open/close.
  const scanOpenRef = useRef(false);
  useEffect(() => {
    scanOpenRef.current = scanOpen;
  }, [scanOpen]);

  const excludeBookIds = useMemo(() => entries.map((e) => e.book.id), [entries]);

  const scanSession = useScanSession({
    excludeBookIds,
    onScanComplete: (count) => {
      if (scanOpenRef.current) return;
      toast({
        text: `Found ${count} ${count === 1 ? 'book' : 'books'} in your photo`,
        action: { label: 'Review', onClick: () => setScanOpen(true) },
      });
    },
    onAdded: reload,
  });

  // No survive-close toast here, unlike the scan: a CSV import is many requests
  // over minutes, so dismissing it cancels rather than continuing in the
  // background (LOS-169).
  const csvSession = useCsvImportSession({ excludeBookIds, onAdded: reload });

  const status = asStatus(searchParams.get('status'));
  const subject = searchParams.get('subject');
  const author = searchParams.get('author');
  const urlQuery = searchParams.get('q') ?? '';

  // The input is driven by local state, not by the URL. setSearchParams lands a
  // render later, so feeding the box straight from the URL made every keystroke
  // start from a stale value and "sagan" arrived as "n". The URL still gets the
  // query — see the effect below — it just isn't in the typing path.
  const [q, setQ] = useState(urlQuery);
  // Same shape as SearchPage's queryInput/syncedQ. Adopting only when the URL
  // differs from what we last saw keeps our own write from reading back as an
  // external change and overwriting whatever was typed in the meantime; the
  // second check leaves the input alone when the URL merely caught up to it.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== q) setQ(urlQuery);
  }

  // Replaces rather than pushes: filtering is instant and local, so a history
  // entry per keystroke would make Back unusable. Kept in the URL at all so a
  // filtered library stays shareable, like every other filter on this page.
  useEffect(() => {
    if (q === urlQuery) return;
    const next = new URLSearchParams(searchParams);
    if (q) next.set('q', q);
    else next.delete('q');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Reset to the first page whenever the active filter changes.
  const filterKey = `${status ?? ''}|${subject ?? ''}|${author ?? ''}|${q}`;
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

  // A finished or failed session is stale by the time the button is clicked again;
  // an in-flight one is left alone so reopening shows its progress.
  function addFromPhoto() {
    if (scanSession.phase === 'results' || scanSession.phase === 'error') scanSession.reset();
    setScanOpen(true);
  }

  function importCsv() {
    if (csvSession.phase === 'review' || csvSession.phase === 'error') csvSession.reset();
    setCsvOpen(true);
  }

  // Photo import is opt-in (LOS-170): it only works where the upload bucket has a
  // CORS rule for browser POSTs, so an environment without the flag shouldn't
  // advertise it. Passing undefined rather than a no-op keeps the button out of
  // the DOM entirely.
  const photoImport = isPhotoImportEnabled();
  const onAddFromPhoto = photoImport ? addFromPhoto : undefined;
  const modals = (
    <>
      {photoImport && scanOpen && (
        <ScanModal session={scanSession} onClose={() => setScanOpen(false)} />
      )}
      {csvOpen && <CsvImportModal session={csvSession} onClose={() => setCsvOpen(false)} />}
    </>
  );

  const sorted = useMemo(
    () => sortByAddedDesc(filterEntries(entries, { status, subject, author, q })),
    [entries, status, subject, author, q],
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
        <LibraryEmptyState onDiscover={() => navigate('/')} onAddFromPhoto={onAddFromPhoto} onImportCsv={importCsv} />
        {modals}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <LibraryHeader
        total={total}
        onAddFromPhoto={onAddFromPhoto}
        onImportCsv={importCsv}
        query={q}
        onQueryChange={setQ}
      />

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
        <p className={styles.noMatch}>
          {q ? `No books in your library match “${q}”.` : 'No books match this filter.'}
        </p>
      ) : (
        <div className={styles.grid}>
          {pageItems.map((entry) => (
            <BookCard
              key={entry.book.id}
              book={entry.book}
              status={entry.status}
              onClick={() => navigate(buildBookHref(entry.book))}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      {modals}
    </div>
  );
}
