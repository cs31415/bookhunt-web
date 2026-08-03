import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { Loader } from '../../shared/components/Loader/Loader';
import { Pagination } from '../../shared/components/Pagination/Pagination';
import { ALL_LIBRARY_STATUSES } from '../../shared/types/library-status';
import type { LibraryStatus } from '../../shared/types/library-status';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { LibraryHeader } from './components/LibraryHeader/LibraryHeader';
import { LibraryFilters } from './components/LibraryFilters/LibraryFilters';
import { LibraryEmptyState } from './components/LibraryEmptyState/LibraryEmptyState';
import { ScanModal } from './components/ScanModal/ScanModal';
import { CsvImportModal } from './components/CsvImportModal/CsvImportModal';
import { LibraryCardMenu } from './components/LibraryCardMenu/LibraryCardMenu';
import { ConfirmRemoveModal } from '../../shared/components/ConfirmRemoveModal/ConfirmRemoveModal';
import { SelectionToolbar } from './components/SelectionToolbar/SelectionToolbar';
import { useLibraryData } from './hooks/useLibraryData';
import { useLibrarySelection } from './hooks/useLibrarySelection';
import { useScanSession } from './hooks/useScanSession';
import { useCsvImportSession } from './hooks/useCsvImportSession';
import { removeEntry } from '../../api/library/remove-entry';
import { removeEntries, MAX_REMOVE_PER_REQUEST } from '../../api/library/remove-entries';
import { toast } from '../../shared/toast/toast-store';
import { isPhotoImportEnabled } from '../../shared/config/features';
import { filterEntries, sortByAddedDesc } from './lib/breakdowns';
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
  const selection = useLibrarySelection();
  // What the confirm modal is asking about: one named book, or the selection.
  // Null when it is closed, which is also what Cancel restores.
  const [pendingRemoval, setPendingRemoval] = useState<
    { kind: 'one'; bookId: number; title: string } | { kind: 'selected' } | null
  >(null);

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
  // 'subject' in the URL, "Category" on screen — the same split the search page
  // uses, and keeping the param name means existing shared links still resolve.
  const category = searchParams.get('subject');
  const mood = searchParams.get('mood');
  const theme = searchParams.get('theme');
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
  const filterKey = `${status ?? ''}|${category ?? ''}|${mood ?? ''}|${theme ?? ''}|${q}`;
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

  // Status is one axis; category/mood/theme share a second, so picking one of
  // those three replaces the last. Every pill stays visibly selected, so
  // clicking the active one again is the way back out.
  const NO_ATTRIBUTES = { subject: null, mood: null, theme: null };

  function selectStatus(next: LibraryStatus) {
    updateParams({ status: next === status ? null : next });
  }
  function selectCategory(next: string) {
    updateParams({ ...NO_ATTRIBUTES, subject: next === category ? null : next });
  }
  function selectTheme(next: string) {
    updateParams({ ...NO_ATTRIBUTES, theme: next === theme ? null : next });
  }
  function selectMood(next: string) {
    updateParams({ ...NO_ATTRIBUTES, mood: next === mood ? null : next });
  }
  function clearFilters() {
    updateParams({ ...NO_ATTRIBUTES, status: null });
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
    () => sortByAddedDesc(filterEntries(entries, { status, category, mood, theme, q })),
    [entries, status, category, mood, theme, q],
  );
  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  // Clamped rather than clipped: removing the last few books on the final page
  // would otherwise leave `page` past the end and the grid blank, with the only
  // way back being a filter change.
  const safePage = Math.min(page, Math.max(pageCount, 1));
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /**
   * Removes in chunks, because the endpoint caps a request at 20 ids and a
   * "select all" over a filtered library routinely exceeds that. Sequential
   * rather than parallel: these are deletes, and a burst of them racing each
   * other is not worth the second it saves.
   */
  async function removeSelected() {
    const ids = [...selection.selectedIds];
    let removed = 0;
    for (let i = 0; i < ids.length; i += MAX_REMOVE_PER_REQUEST) {
      const result = await removeEntries(ids.slice(i, i + MAX_REMOVE_PER_REQUEST));
      removed += result.removed;
    }
    return removed;
  }

  async function confirmRemoval() {
    if (!pendingRemoval) return;

    if (pendingRemoval.kind === 'one') {
      await removeEntry(pendingRemoval.bookId);
      setPendingRemoval(null);
      toast({ text: `Removed “${pendingRemoval.title}” from your library` });
    } else {
      const removed = await removeSelected();
      setPendingRemoval(null);
      selection.exit();
      toast({ text: `Removed ${removed} ${removed === 1 ? 'book' : 'books'} from your library` });
    }

    reload();
  }

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
        onSelect={selection.selecting ? undefined : selection.enter}
      />

      <div className={styles.layout}>
        <LibraryFilters
          entries={entries}
          status={status}
          category={category}
          mood={mood}
          theme={theme}
          onSelectStatus={selectStatus}
          onSelectCategory={selectCategory}
          onSelectMood={selectMood}
          onSelectTheme={selectTheme}
          onClearFilters={clearFilters}
        />

        <div className={styles.results}>
          {selection.selecting && (
            <SelectionToolbar
              selectedCount={selection.selectedIds.size}
              visibleCount={sorted.length}
              onSelectAll={() => selection.selectAll(sorted.map((entry) => entry.book.id))}
              onClear={selection.clear}
              onRemove={() => setPendingRemoval({ kind: 'selected' })}
              onDone={selection.exit}
            />
          )}

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
                  // While selecting, the card picks rather than navigates —
                  // leaving the page mid-selection would discard it.
                  onClick={
                    selection.selecting
                      ? () => selection.toggle(entry.book.id)
                      : () => navigate(buildBookHref(entry.book))
                  }
                  action={
                    selection.selecting ? (
                      <input
                        type="checkbox"
                        className={styles.selectBox}
                        checked={selection.selectedIds.has(entry.book.id)}
                        onChange={() => selection.toggle(entry.book.id)}
                        aria-label={`Select ${entry.book.title}`}
                      />
                    ) : (
                      <LibraryCardMenu
                        onRemove={() =>
                          setPendingRemoval({
                            kind: 'one',
                            bookId: entry.book.id,
                            title: entry.book.title,
                          })
                        }
                      />
                    )
                  }
                />
              ))}
            </div>
          )}

          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      </div>
      {modals}
      {pendingRemoval && (
        <ConfirmRemoveModal
          count={pendingRemoval.kind === 'one' ? 1 : selection.selectedIds.size}
          title={pendingRemoval.kind === 'one' ? pendingRemoval.title : undefined}
          onConfirm={confirmRemoval}
          onCancel={() => setPendingRemoval(null)}
        />
      )}
    </div>
  );
}
