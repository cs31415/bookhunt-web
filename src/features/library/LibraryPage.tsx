import { useEffect, useMemo, useState } from 'react';
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
import { CsvImportModal } from './components/CsvImportModal/CsvImportModal';
import { LibraryCardMenu } from './components/LibraryCardMenu/LibraryCardMenu';
import { ConfirmRemoveModal } from '../../shared/components/ConfirmRemoveModal/ConfirmRemoveModal';
import { SelectionToolbar } from './components/SelectionToolbar/SelectionToolbar';
import { useLibraryData } from './hooks/useLibraryData';
import { useLibrarySelection } from './hooks/useLibrarySelection';
import { useCsvImportSession } from './hooks/useCsvImportSession';
import { removeEntry } from '../../api/library/remove-entry';
import { removeEntries, MAX_REMOVE_PER_REQUEST } from '../../api/library/remove-entries';
import { toast } from '../../shared/toast/toast-store';
import { filterEntries, sortByShelf } from './lib/breakdowns';
import { useEntryFlags } from './hooks/useEntryFlags';
import { FavoriteButton } from '../../shared/components/FavoriteButton/FavoriteButton';
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
  const [csvOpen, setCsvOpen] = useState(false);
  const selection = useLibrarySelection();
  // What the confirm modal is asking about: one named book, or the selection.
  // Null when it is closed, which is also what Cancel restores.
  const [pendingRemoval, setPendingRemoval] = useState<
    { kind: 'one'; bookId: number; title: string } | { kind: 'selected' } | null
  >(null);

  const excludeBookIds = useMemo(() => entries.map((e) => e.book.id), [entries]);

  // No survive-close toast: a CSV import is many requests over minutes, so
  // dismissing it cancels rather than continuing in the background (LOS-169).
  const csvSession = useCsvImportSession({ excludeBookIds, onAdded: reload });

  const status = asStatus(searchParams.get('status'));
  // 'subject' in the URL, "Category" on screen — the same split the search page
  // uses, and keeping the param name means existing shared links still resolve.
  const category = searchParams.get('subject');
  const mood = searchParams.get('mood');
  const theme = searchParams.get('theme');
  const favorite = searchParams.get('favorite') === 'true';
  const flags = useEntryFlags();
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
  const filterKey = `${status ?? ''}|${category ?? ''}|${mood ?? ''}|${theme ?? ''}|${q}|${favorite}`;
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
    updateParams({ ...NO_ATTRIBUTES, status: null, favorite: null });
  }
  // Its own axis, unlike category/mood/theme: narrowing to favourites is a
  // question you ask alongside a shelf, not instead of one.
  function toggleFavoriteFilter() {
    updateParams({ favorite: favorite ? null : 'true' });
  }

  // A finished or failed session is stale by the time the button is clicked again;
  // an in-flight one is left alone so reopening shows its progress.
  function importCsv() {
    if (csvSession.phase === 'review' || csvSession.phase === 'error') csvSession.reset();
    setCsvOpen(true);
  }

  const modals = (
    <>{csvOpen && <CsvImportModal session={csvSession} onClose={() => setCsvOpen(false)} />}</>
  );

  // Overrides merged before filtering, so un-favouriting while the favourites
  // filter is on removes the card immediately rather than at the next reload.
  const shownEntries = useMemo(() => flags.apply(entries), [flags, entries]);

  const sorted = useMemo(
    () => sortByShelf(filterEntries(shownEntries, { status, category, mood, theme, q, favorite })),
    [shownEntries, status, category, mood, theme, q, favorite],
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
        <LibraryEmptyState onDiscover={() => navigate('/')} onImportCsv={importCsv} />
        {modals}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <LibraryHeader
        total={total}
        query={q}
        onQueryChange={setQ}
      />

      <div className={styles.layout}>
        <LibraryFilters
          // shownEntries, not entries: the rail's favourite count has to see
          // optimistic toggles, or un-favouriting the last book empties the
          // grid while the pill still claims one. The other facets read the
          // same prop and are unaffected, since an override only touches
          // isFavorite and isHidden.
          entries={shownEntries}
          status={status}
          category={category}
          mood={mood}
          theme={theme}
          favorite={favorite}
          onToggleFavorite={toggleFavoriteFilter}
          onSelectStatus={selectStatus}
          onSelectCategory={selectCategory}
          onSelectMood={selectMood}
          onSelectTheme={selectTheme}
          onClearFilters={clearFilters}
        />

        <div className={styles.results}>
          {/* Above the grid, not in the header: it selects from whatever the
              filters are showing, and stacked on a phone the header sits a whole
              filter rail away from those books (LOS-244). Hidden once selecting
              — the toolbar below owns leaving that mode. */}
          {!selection.selecting && (
            <div className={styles.resultsActions}>
              <button type="button" className={styles.importButton} onClick={importCsv}>
                Import
              </button>
              <button type="button" className={styles.editButton} onClick={selection.enter}>
                Edit
              </button>
            </div>
          )}

          {selection.selecting && (
            <SelectionToolbar
              selectedCount={selection.selectedIds.size}
              visibleCount={sorted.length}
              onSelectAll={() => selection.selectAll(sorted.map((entry) => entry.book.id))}
              onClear={selection.clear}
              onRemove={() => setPendingRemoval({ kind: 'selected' })}
              onHide={() => {
                const chosen = sorted.filter((e) => selection.selectedIds.has(e.book.id));
                // Whichever way the majority currently sits, do the opposite:
                // a mixed selection has no obvious "toggle", and hiding what is
                // already hidden would be a no-op the reader could not explain.
                const hiddenCount = chosen.filter((e) => e.isHidden).length;
                flags.hideMany(chosen, hiddenCount * 2 <= chosen.length);
                selection.clear();
              }}
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
                  // BookCard's eyebrow, which the library grid never uses
                  // otherwise: already a recessive line above the title, which
                  // is exactly what this badge wants to be.
                  reason={entry.isHidden ? 'Hidden from your public page' : undefined}
                  // While selecting, the card picks rather than navigates —
                  // leaving the page mid-selection would discard it.
                  onClick={
                    selection.selecting
                      ? () => selection.toggle(entry.book.id)
                      : () => navigate(buildBookHref(entry.book))
                  }
                  // Hidden while selecting: the card is a checkbox then, and a
                  // heart that still acts would be the one control on it that
                  // does something other than pick.
                  overlay={
                    selection.selecting ? undefined : (
                      <FavoriteButton
                        isFavorite={entry.isFavorite}
                        onToggle={(next) => flags.toggleFavorite(entry, next)}
                      />
                    )
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
                        isHidden={entry.isHidden}
                        onToggleHidden={(next) => flags.toggleHidden(entry, next)}
                        isFavorite={entry.isFavorite}
                        onToggleFavorite={(next) => flags.toggleFavorite(entry, next)}
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
