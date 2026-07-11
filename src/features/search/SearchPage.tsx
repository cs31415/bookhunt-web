import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { FilterSidebar } from './components/FilterSidebar/FilterSidebar';
import { ResultsGrid } from './components/ResultsGrid/ResultsGrid';
import { Pagination } from './components/Pagination/Pagination';
import { GoogleBooksSection } from './components/GoogleBooksSection/GoogleBooksSection';
import { AiInterpretationBanner } from './components/AiInterpretationBanner/AiInterpretationBanner';
import { useSearchResults } from './hooks/useSearchResults';
import { useFacets } from './hooks/useFacets';
import { parseSearchParams, withParamChange } from './search-params';
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
}: {
  q: string;
  theme: boolean;
  mood: string | null;
}) {
  if (q && theme) {
    return (
      <h2 className={styles.heading}>
        Books on the theme of <span className={styles.highlight}>&ldquo;{q}&rdquo;</span>
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
  if (mood) {
    return (
      <h2 className={styles.heading}>
        Books that feel <span className={styles.highlight}>{mood}</span>
      </h2>
    );
  }
  return <h2 className={styles.heading}>Browse the catalog</h2>;
}

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = parseSearchParams(searchParams);
  const { results, total, page, pageSize, loading, error } = useSearchResults(searchParams);
  const facets = useFacets();
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
    update({ q: query || null, theme: null });
  }

  function toggleValue(key: string, value: string, current: string | null) {
    update({ [key]: current === value ? null : value });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={styles.page}>
      <div className={styles.searchBarWrap}>
        <SearchBar value={queryInput} onChange={setQueryInput} onSubmit={handleSubmit} big placeholder="Refine your search…" />
      </div>

      <div className={styles.layout}>
        <FilterSidebar
          parsed={parsed}
          subjects={facets.subjects}
          moods={facets.moods}
          onToggleInLibraryOnly={() => update({ inLibraryOnly: parsed.inLibraryOnly ? null : 'true' })}
          onSelectSubject={(subject) => toggleValue('subject', subject, parsed.subject)}
          onSelectMood={(mood) => toggleValue('mood', mood, parsed.mood)}
          onSelectStatus={(status: LibraryStatus) => toggleValue('status', status, parsed.status)}
          onClearFilters={() => update({ subject: null, mood: null, status: null, inLibraryOnly: null })}
        />

        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <div>
              <ResultsHeading q={parsed.q} theme={parsed.theme} mood={parsed.mood} />
              {!loading && (
                <div className={styles.count}>
                  {total} {total === 1 ? 'book' : 'books'}
                </div>
              )}
            </div>
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
          </div>

          <AiInterpretationBanner interpretation={null} />

          {error && <p className={styles.error}>{error}</p>}

          {!error && (
            <ResultsGrid
              results={results}
              loading={loading}
              onSelectBook={(slug) => navigate(`/books/${slug}`)}
            />
          )}

          {!loading && !error && (
            <Pagination page={page} totalPages={totalPages} onPageChange={(next) => update({ page: String(next) })} />
          )}

          {!loading && !error && (
            <GoogleBooksSection query={parsed.q} catalogTitles={results.map((r) => r.book.title)} />
          )}
        </div>
      </div>
    </div>
  );
}
