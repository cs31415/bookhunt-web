import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader } from '../../shared/components/Loader/Loader';
import { Pagination } from '../../shared/components/Pagination/Pagination';
import { useNoIndex } from '../../shared/hooks/useNoIndex';
import { Grid, Header, ShelfFilters, Tabs } from './ProfilePage';
import { AuthorsTab } from './AuthorsTab';
import { useShelfParams, showsAuthors, PAGE_SIZE } from './useShelfParams';
import { useSharedProfile } from './useSharedProfile';
import { useShelfFacets } from './useShelfFacets';
import { ProfileFacets } from './components/ProfileFacets/ProfileFacets';
import { FilterRail } from '../../shared/components/FilterRail/FilterRail';
import styles from './ProfilePage.module.css';

/**
 * A profile at its unlisted address, /s/<token> (LOS-305).
 *
 * The same page a visitor sees at /<handle>, reached by a different key: it
 * works while the reader's public page is off, which is the whole point, and it
 * appears in no listing, no search and no sitemap because nothing ever puts it
 * there. The only thing that produces one of these addresses is the owner's own
 * copy button.
 *
 * What it is NOT is a way past the per-book ticks. The API excludes hidden
 * entries here exactly as it does on the public shelf — unlisted means "not
 * listed", not "everything on show".
 *
 * No owner controls and no favourite-reader heart. Someone holding a link is
 * not necessarily signed in, and this page is for reading a shelf, not for
 * acting on it.
 */
export function SharedProfilePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const shelf = useShelfParams();

  useNoIndex();

  const { tab, sub, page, q, appliedQuery, subject, mood, theme } = shelf;
  const { profile, entries, total, loading, searching, notFound, error } = useSharedProfile(
    token,
    showsAuthors(tab, sub) ? null : tab,
    page,
    PAGE_SIZE,
    { q: appliedQuery, subject, mood, theme },
  );

  // The token is the address here, so the facets come by token too.
  const facets = useShelfFacets('token', token);

  if (loading) return <Loader />;

  // An unknown token and a revoked one give the same answer, so this says the
  // link no longer works rather than guessing which happened.
  if (notFound) return <DeadLink />;

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <p className={styles.message} role="alert">
          Could not load this page just now.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header
        handle={profile.handle}
        displayName={profile.displayName}
        joinedAt={profile.joinedAt}
        bookCount={profile.counts.total}
      />
      <Tabs
        active={tab}
        onSelect={shelf.onSelectTab}
        sub={sub}
        onSelectSub={shelf.onSelectSub}
      />
      {showsAuthors(tab, sub) ? (
        // Reached by handle, which the profile above has told us. The authors
        // list is public whenever the page is, and this page is a page.
        <AuthorsTab handle={profile.handle} owner={false} />
      ) : (
        <div className={styles.layout}>
          <FilterRail label="Shelf filters" activeCount={shelf.activeFilterCount}>
            <ProfileFacets
              facets={facets}
              subject={subject}
              mood={mood}
              theme={theme}
              onSelectSubject={shelf.onSelectSubject}
              onSelectMood={shelf.onSelectMood}
              onSelectTheme={shelf.onSelectTheme}
              onClearFilters={shelf.onClearFilters}
            />
          </FilterRail>

          <div className={styles.results}>
            <ShelfFilters
              q={q}
              onQueryChange={shelf.onQueryChange}
              subject={subject}
              onClearSubject={() => shelf.onSelectSubject('')}
              matches={total}
              filtered={Boolean(appliedQuery || subject || mood || theme)}
            />
            {/* Dimmed rather than replaced, as on the public profile: the search
                box keeps focus because nothing unmounts (LOS-310). */}
            <div className={searching ? styles.searching : undefined}>
              <Grid entries={entries} navigate={navigate} onSelectSubject={shelf.onSelectSubject} />
            </div>
            <Pagination
              page={page}
              pageCount={Math.ceil(total / PAGE_SIZE)}
              onChange={shelf.onPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DeadLink() {
  return (
    <div className={styles.page}>
      <h1 className={styles.name}>This link no longer works</h1>
      <p className={styles.message}>
        Shared links can be replaced or turned off by the reader who made them. Ask them for a new
        one.
      </p>
      <p className={styles.message}>
        <Link to="/">Back to Discover</Link>
      </p>
    </div>
  );
}
