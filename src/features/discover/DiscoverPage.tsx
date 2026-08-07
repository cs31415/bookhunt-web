import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { ExampleQueryPills } from './components/ExampleQueryPills/ExampleQueryPills';
import { CurrentlyReadingSection } from './components/CurrentlyReadingSection/CurrentlyReadingSection';
import { useDiscoverData } from './hooks/useDiscoverData';
import { buildBookHref } from '../../shared/lib/build-book-href';
import type { BookSummary } from '../../shared/types/book';
import { EXAMPLE_QUERIES } from './example-queries';
import styles from './DiscoverPage.module.css';

const VISIBLE_EXAMPLE_QUERIES = EXAMPLE_QUERIES.slice(0, 4);

function DiscoverHero({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  function handlePillClick(text: string) {
    setQuery(text);
    onSearch(text);
  }

  return (
    <div className={styles.hero}>
      <div className={styles.heroSearch}>
        <SearchBar value={query} onChange={setQuery} onSubmit={onSearch} big autoFocus />
      </div>
      <ExampleQueryPills queries={VISIBLE_EXAMPLE_QUERIES} onPick={handlePillClick} />
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
