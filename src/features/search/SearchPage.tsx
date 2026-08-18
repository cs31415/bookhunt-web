import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { SaveSearchButton } from '../../shared/components/SaveSearchButton/SaveSearchButton';
import { FilterSidebar } from './components/FilterSidebar/FilterSidebar';
import { ResultsGrid } from './components/ResultsGrid/ResultsGrid';
import { AiInterpretationBanner } from './components/AiInterpretationBanner/AiInterpretationBanner';
import { useSearchResults } from './hooks/useSearchResults';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { pluralize } from '../../shared/lib/text';
import { parseSearchParams, withParamChange } from './search-params';
import type { SearchResultItem } from '../../normalize/search';
import type { LibraryStatus } from '../../shared/types/library-status';
import styles from './SearchPage.module.css';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'relevance', label: 'Sort: Relevance' },
  { value: 'rating', label: 'Sort: Highest rated' },
  { value: 'newest', label: 'Sort: Newest' },
  { value: 'oldest', label: 'Sort: Oldest' },
  { value: 'title', label: 'Sort: Title A–Z' },
];

function ResultsHeading({
  q,
  theme,
  mood,
  subject,
}: {
  q: string;
  theme: boolean;
  mood: string | null;
  subject: string | null;
}) {
  if (q && theme) {
    return (
      <h2 className={styles.heading}>
        Books on the theme of <span className={styles.highlight}>&ldquo;{q}&rdquo;</span>
      </h2>
    );
  }
  if (mood) {
    return (
      <h2 className={styles.heading}>
        Books that feel <span className={styles.highlight}>{mood}</span>
      </h2>
    );
  }
  if (subject) {
    return (
      <h2 className={styles.heading}>
        Books in <span className={styles.highlight}>{subject}</span>
      </h2>
    );
  }
  if (q) {
    return (
      <h2 className={styles.heading}>
        Results for <span className={styles.highlight}>&ldquo;{q}&rdquo;</span>
      </h2>
    );
  }
  return <h2 className={styles.heading}>Search for a book</h2>;
}

export function SearchPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // A signed-out visitor can still arrive at ?inLibraryOnly=true — a shared
  // link, a bookmark, or a session that expired mid-search. Ignore the param
  // rather than stripping it from the URL: the toggle is disabled, so honouring
  // it would filter every result away with no way to switch it back off. Left in
  // the URL, the intent is restored as soon as they sign in.
  const effectiveParams = useMemo(() => {
    if (isAuthenticated || !searchParams.has('inLibraryOnly')) return searchParams;
    const next = new URLSearchParams(searchParams);
    next.delete('inLibraryOnly');
    return next;
  }, [isAuthenticated, searchParams]);

  const parsed = parseSearchParams(effectiveParams);
  const { libraryResults, libraryLoading, results, loading, error, availableCategories, availableMoods } =
    useSearchResults(effectiveParams, isAuthenticated);
  const [queryInput, setQueryInput] = useState(parsed.q);
  const [syncedQ, setSyncedQ] = useState(parsed.q);
  if (parsed.q !== syncedQ) {
    setSyncedQ(parsed.q);
    setQueryInput(parsed.q);
  }

  function update(changes: Record<string, string | null>) {
    setSearchParams(withParamChange(searchParams, changes));
  }

  function handleSubmit(query: string) {
    update({ q: query || null, theme: null, mood: null, subject: null });
  }

  // With the toggle on, `results` is already narrowed to owned books the library
  // search itself did not return — so the two together are the one honest answer
  // to "books I own matching this", rather than two sections saying it twice.
  const owned = parsed.inLibraryOnly ? [...libraryResults, ...results] : libraryResults;

  function handleSelectResult(item: SearchResultItem) {
    // Synchronous navigation — Book Detail resolves the book itself (by slug,
    // falling back to a live lookup by title/author when uncataloged, plus the
    // `pid` for the exact edition). See buildBookHref / LOS-127/128/135.
    navigate(buildBookHref(item.book));
  }

  return (
    <div className={styles.page}>
      <div className={styles.searchBarWrap}>
        <SearchBar
          people value={queryInput} onChange={setQueryInput} onSubmit={handleSubmit} big placeholder="Refine your search… or @handle" />

        {/* The query from the URL, not queryInput, even sitting directly under
            the box: the pill should be the search these results came from, not
            text typed into the box and not yet run. */}
        <div className={styles.save}>
          <SaveSearchButton query={parsed.q} />
        </div>
      </div>

      <div className={styles.layout}>
        <FilterSidebar
          parsed={parsed}
          availableCategories={availableCategories}
          availableMoods={availableMoods}
          canFilterByLibrary={isAuthenticated}
          onToggleInLibraryOnly={() => update({ inLibraryOnly: parsed.inLibraryOnly ? null : 'true' })}
          onSelectCategory={(subject) => update({ subject: parsed.subject === subject ? null : subject })}
          onSelectMood={(mood) => update({ mood: parsed.mood === mood ? null : mood })}
          onSelectStatus={(status: LibraryStatus) => update({ status: parsed.status === status ? null : status })}
          onClearFilters={() => update({ status: null, inLibraryOnly: null, subject: null, mood: null })}
        />

        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <div>
              <ResultsHeading q={parsed.q} theme={parsed.theme} mood={parsed.mood} subject={parsed.subject} />
              {!loading && parsed.q && (
                <div className={styles.count}>
                  {(parsed.inLibraryOnly ? owned.length : results.length + owned.length)}{' '}
                  {pluralize(parsed.inLibraryOnly ? owned.length : results.length + owned.length, 'book')}
                </div>
              )}
            </div>
            {parsed.q && (
              <select
                className={styles.sortSelect}
                value={parsed.sort}
                onChange={(event) => update({ sort: event.target.value })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <AiInterpretationBanner interpretation={null} />

          {error && <p className={styles.error}>{error}</p>}

          {/* Above the AI results, and rendered as soon as it arrives: the
              library search is a Postgres query and answers in milliseconds,
              so an exact match on your own shelf shouldn't wait on the model. */}
          {!libraryLoading && parsed.q && owned.length > 0 && (
            <section className={styles.librarySection}>
              <h3 className={styles.sectionHeading}>
                In your library
                <span className={styles.sectionCount}>
                  {owned.length} {pluralize(owned.length, 'book')}
                </span>
              </h3>
              <ResultsGrid results={owned} loading={false} onSelectResult={handleSelectResult} />
            </section>
          )}

          {/* With the toggle on there is only one list — the books you own — so
              the suggestions section, and its empty state, would be noise. */}
          {!error && parsed.q && !parsed.inLibraryOnly && (
            <>
              {owned.length > 0 && <h3 className={styles.sectionHeading}>More to discover</h3>}
              <ResultsGrid results={results} loading={loading} onSelectResult={handleSelectResult} />
            </>
          )}

          {!error && parsed.q && parsed.inLibraryOnly && !libraryLoading && !loading && owned.length === 0 && (
            <ResultsGrid results={[]} loading={false} onSelectResult={handleSelectResult} />
          )}

          {!error && !parsed.q && (
            <p className={styles.count}>Type a query above — for example, "books for an intelligent layman on evolution".</p>
          )}
        </div>
      </div>
    </div>
  );
}
