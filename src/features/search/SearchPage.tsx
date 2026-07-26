import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = parseSearchParams(searchParams);
  const { results, loading, error, availableCategories, availableMoods } = useSearchResults(searchParams);
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

  function handleSelectResult(item: SearchResultItem) {
    // Synchronous navigation — Book Detail resolves the book itself (by slug,
    // falling back to a live lookup by title/author when uncataloged, plus the
    // `pid` for the exact edition). See buildBookHref / LOS-127/128/135.
    navigate(buildBookHref(item.book));
  }

  return (
    <div className={styles.page}>
      <div className={styles.searchBarWrap}>
        <SearchBar value={queryInput} onChange={setQueryInput} onSubmit={handleSubmit} big placeholder="Refine your search…" />
      </div>

      <div className={styles.layout}>
        <FilterSidebar
          parsed={parsed}
          availableCategories={availableCategories}
          availableMoods={availableMoods}
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
                  {results.length} {pluralize(results.length, 'book')}
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

          {!error && parsed.q && (
            <ResultsGrid results={results} loading={loading} onSelectResult={handleSelectResult} />
          )}

          {!error && !parsed.q && (
            <p className={styles.count}>Type a query above — for example, "books for an intelligent layman on evolution".</p>
          )}
        </div>
      </div>
    </div>
  );
}
