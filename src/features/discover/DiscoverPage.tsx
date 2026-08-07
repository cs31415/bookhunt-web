import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { ExampleQueryPills } from './components/ExampleQueryPills/ExampleQueryPills';
import { CurrentlyReadingSection } from './components/CurrentlyReadingSection/CurrentlyReadingSection';
import { useDiscoverData } from './hooks/useDiscoverData';
import { useCannedSearches } from './hooks/useCannedSearches';
import { useAuth } from '../auth/AuthContext';
import { PinIcon } from '../../shared/layout/icons';
import { buildBookHref } from '../../shared/lib/build-book-href';
import type { BookSummary } from '../../shared/types/book';
import styles from './DiscoverPage.module.css';

/** Matches MIN_SAVED_QUERY_LENGTH in the API; the server enforces it with a 400. */
const MIN_SAVED_QUERY_LENGTH = 3;

function DiscoverHero({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const { isAuthenticated } = useAuth();
  const {
    pinned,
    suggested,
    degraded,
    refresh,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    togglePin,
    saveSearch,
    notice,
  } = useCannedSearches();

  function handlePillClick(text: string) {
    setQuery(text);
    onSearch(text);
  }

  // Saving writes a row owned by the reader, so there is nowhere to put a
  // guest's. They can still pin anything from the catalog.
  const canSave = isAuthenticated && query.trim().length >= MIN_SAVED_QUERY_LENGTH;

  return (
    <div className={styles.hero}>
      <div className={styles.heroSearch}>
        <SearchBar value={query} onChange={setQuery} onSubmit={onSearch} big autoFocus />
      </div>

      {canSave && (
        <button
          type="button"
          className={styles.saveSearch}
          onClick={() => void saveSearch(query)}
        >
          <PinIcon className={styles.saveGlyph} />
          Keep this search as a pill
        </button>
      )}

      <ExampleQueryPills
        pinned={pinned}
        suggested={suggested}
        onPick={handlePillClick}
        // Withheld against the fallback list: there is no catalog behind it to
        // pin against, redraw from, or step through.
        onTogglePin={degraded ? undefined : togglePin}
        onRefresh={degraded ? undefined : refresh}
        onBack={degraded ? undefined : goBack}
        onForward={degraded ? undefined : goForward}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
      />

      {notice && <p className={styles.notice}>{notice}</p>}
    </div>
  );
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useDiscoverData();

  function goToSearch(query: string) {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function goToBook(book: BookSummary) {
    navigate(buildBookHref(book));
  }

  return (
    <div className={styles.page}>
      <DiscoverHero onSearch={goToSearch} />

      {error && <p className={styles.error}>{error}</p>}

      {!loading && data && data.currentlyReading.length > 0 && (
        <CurrentlyReadingSection entries={data.currentlyReading} onSelectBook={goToBook} />
      )}
    </div>
  );
}
