import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { SaveSearchButton } from '../../shared/components/SaveSearchButton/SaveSearchButton';
import { ExampleQueryPills } from './components/ExampleQueryPills/ExampleQueryPills';
import { CurrentlyReadingSection } from './components/CurrentlyReadingSection/CurrentlyReadingSection';
import { useDiscoverData } from './hooks/useDiscoverData';
import { useCannedSearches } from './hooks/useCannedSearches';
import { buildBookHref } from '../../shared/lib/build-book-href';
import type { BookSummary } from '../../shared/types/book';
import styles from './DiscoverPage.module.css';

function DiscoverHero({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
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
    addPinned,
    notice,
  } = useCannedSearches();

  function handlePillClick(text: string) {
    setQuery(text);
    onSearch(text);
  }

  return (
    <div className={styles.hero}>
      <div className={styles.heroSearch}>
        <SearchBar
            people value={query} onChange={setQuery} onSubmit={onSearch} big autoFocus />
      </div>

      {/* The saved pill is pinned server-side, so it joins the row without a
          refetch. Withheld from guests and short queries by the button itself. */}
      <div className={styles.save}>
        <SaveSearchButton query={query} onSaved={addPinned} />
      </div>

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
