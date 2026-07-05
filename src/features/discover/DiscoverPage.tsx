import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { ExampleQueryPills } from './components/ExampleQueryPills/ExampleQueryPills';
import { CurrentlyReadingSection } from './components/CurrentlyReadingSection/CurrentlyReadingSection';
import { RecommendedSection } from './components/RecommendedSection/RecommendedSection';
import { LibrarySnapshotCard } from './components/LibrarySnapshotCard/LibrarySnapshotCard';
import { useDiscoverData } from './hooks/useDiscoverData';
import { EXAMPLE_QUERIES } from './example-queries';
import styles from './DiscoverPage.module.css';

function DiscoverHero({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(query);
  }

  function handlePillClick(text: string) {
    setQuery(text);
    onSearch(text);
  }

  return (
    <section className={styles.hero}>
      <h1 className={styles.heroTitle}>What are you in the mood to read?</h1>
      <form className={styles.heroForm} onSubmit={handleSubmit}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Try “history that reads like a thriller”"
        />
      </form>
      <ExampleQueryPills queries={EXAMPLE_QUERIES} onPick={handlePillClick} />
    </section>
  );
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useDiscoverData();

  function goToSearch(query: string) {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function goToBook(slug: string) {
    navigate(`/books/${slug}`);
  }

  return (
    <div className={styles.page}>
      <DiscoverHero onSearch={goToSearch} />

      {error && <p className={styles.error}>{error}</p>}

      {!loading && data && (
        <>
          {data.currentlyReading.length > 0 && (
            <CurrentlyReadingSection entries={data.currentlyReading} onSelectBook={goToBook} />
          )}

          <RecommendedSection
            recommendations={data.recommendations}
            onSelectBook={goToBook}
            onSeeMore={() => navigate('/search?mode=recommendations')}
          />

          <LibrarySnapshotCard
            total={data.totalBooks}
            counts={data.statusCounts}
            onSliceClick={(status) => navigate(`/library?status=${status}`)}
            onOpenLibrary={() => navigate('/library')}
            onAddFirstBook={() => navigate('/search')}
          />
        </>
      )}
    </div>
  );
}
