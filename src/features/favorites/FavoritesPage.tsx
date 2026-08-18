import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { Loader } from '../../shared/components/Loader/Loader';
import { Pagination } from '../../shared/components/Pagination/Pagination';
import { TabBar } from '../../shared/components/TabBar/TabBar';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { useAuth } from '../auth/AuthContext';
import { useLibraryData } from '../library/hooks/useLibraryData';
import { AuthorsTab } from '../profile/AuthorsTab';
import { PeopleTab } from '../profile/PeopleTab';
import styles from './FavoritesPage.module.css';

const PAGE_SIZE = 24;

export type FavoritesTab = 'books' | 'authors' | 'people';

const TABS: { id: FavoritesTab; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'authors', label: 'Authors' },
  // Owner-only by nature: this page is the only place a follow list appears,
  // and it is never published (LOS-279).
  { id: 'people', label: 'People' },
];

function asTab(value: string | null): FavoritesTab {
  return TABS.some((tab) => tab.id === value) ? (value as FavoritesTab) : 'books';
}

/**
 * Everything a reader has favourited, in one place: books, authors, readers.
 *
 * Its own page rather than a tab on the profile, which is what the nav used to
 * point at. The profile is what a visitor sees; this is not — the People list
 * in particular is a follow list, and it never belonged on a public page.
 *
 * Read-only, like the profile grid and for the same reason: /library is where a
 * book is edited, and the heart that put it here is on the book itself.
 */
export function FavoritesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entries, loading } = useLibraryData();

  const tab = asTab(searchParams.get('tab'));

  const favorites = useMemo(() => entries.filter((entry) => entry.isFavorite), [entries]);

  function selectTab(next: FavoritesTab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'books') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  const pageItems = favorites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Favourites</h1>
      </header>

      <TabBar tabs={TABS} active={tab} onSelect={selectTab} label="Favourites" />

      {tab === 'people' ? (
        <PeopleTab />
      ) : tab === 'authors' ? (
        // The owner's own list, so the private endpoint: the public one is
        // gated on the page being on, and this page is not the public page.
        <AuthorsTab handle={user?.handle ?? ''} owner />
      ) : loading ? (
        <Loader />
      ) : favorites.length === 0 ? (
        <p className={styles.message}>
          No favourite books yet. The heart on a book adds it here.
        </p>
      ) : (
        <>
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
          <Pagination
            page={page}
            pageCount={Math.ceil(favorites.length / PAGE_SIZE)}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
