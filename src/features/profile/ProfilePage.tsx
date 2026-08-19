import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { Loader } from '../../shared/components/Loader/Loader';
import { Pagination } from '../../shared/components/Pagination/Pagination';
import { TabBar } from '../../shared/components/TabBar/TabBar';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { useAuth } from '../auth/AuthContext';
import { updateMe } from '../../api/users/update-me';
import { useLibraryData } from '../library/hooks/useLibraryData';
import { useEntryFlags } from '../library/hooks/useEntryFlags';
import { useVisitorProfile } from './useProfile';
import type { ProfileTab } from './useProfile';
import type { LibraryEntry } from '../../normalize/library';
import { AuthorsTab } from './AuthorsTab';
import { FavoriteButton } from '../../shared/components/FavoriteButton/FavoriteButton';
import { setUserFavorite } from '../../api/users/set-user-favorite';
import { toast } from '../../shared/toast/toast-store';
import styles from './ProfilePage.module.css';

const PAGE_SIZE = 24;

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'reading', label: 'Currently reading' },
  { id: 'favorites', label: 'Favourites' },
];

/**
 * Favourites hold two kinds of thing, so they carry a second row rather than a
 * fourth tab. Authors are public — a list of authors reads as taste, not as a
 * social graph (LOS-255) — which is why they live here and favourite *readers*
 * do not appear on this page at all (LOS-279).
 */
export type FavoritesSub = 'books' | 'authors';

const SUB_TABS: { id: FavoritesSub; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'authors', label: 'Authors' },
];

function asTab(value: string | null): ProfileTab {
  return TABS.some((t) => t.id === value) ? (value as ProfileTab) : 'library';
}

function asSub(value: string | null): FavoritesSub {
  return value === 'authors' ? 'authors' : 'books';
}

/**
 * The one home for a reader's public shelf, at the bare root path
 * bookhunt.net/<handle>.
 *
 * One component, two modes. A visitor reads the public endpoints, paginated
 * server-side. The owner reads their own private library instead -- the public
 * endpoint 404s whenever their page is off, and reading it would lock them out
 * of their own profile with no way back except publishing.
 *
 * Because the owner reads the private shelf, hidden books appear to them,
 * carrying the badge from LOS-253. What is excluded stays legible.
 */
export function ProfilePage() {
  const { handle = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const tab = asTab(searchParams.get('tab'));
  const sub = asSub(searchParams.get('sub'));
  const isOwner = Boolean(user?.handle && user.handle.toLowerCase() === handle.toLowerCase());

  function selectTab(next: ProfileTab) {
    const params = new URLSearchParams(searchParams);
    if (next === 'library') params.delete('tab');
    else params.set('tab', next);
    // The sub-tab belongs to Favourites, so it leaves with it rather than
    // lying in wait to reopen on Authors next time Favourites is picked.
    if (next !== 'favorites') params.delete('sub');
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  function selectSub(next: FavoritesSub) {
    const params = new URLSearchParams(searchParams);
    if (next === 'books') params.delete('sub');
    else params.set('sub', next);
    setSearchParams(params, { replace: true });
    setPage(1);
  }

  const view = { handle, tab, sub, onSelectTab: selectTab, onSelectSub: selectSub, page, onPage: setPage, navigate };

  return isOwner ? <OwnerProfile {...view} /> : <VisitorProfileView {...view} />;
}

interface ViewProps {
  handle: string;
  tab: ProfileTab;
  sub: FavoritesSub;
  onSelectTab: (tab: ProfileTab) => void;
  onSelectSub: (sub: FavoritesSub) => void;
  page: number;
  onPage: (page: number) => void;
  navigate: ReturnType<typeof useNavigate>;
}

/** True when the section on screen is the authors list rather than a shelf. */
function showsAuthors(tab: ProfileTab, sub: FavoritesSub): boolean {
  return tab === 'favorites' && sub === 'authors';
}

function VisitorProfileView({
  handle,
  tab,
  sub,
  onSelectTab,
  onSelectSub,
  page,
  onPage,
  navigate,
}: ViewProps) {
  const { profile, entries, total, loading, notFound, error } = useVisitorProfile(
    handle,
    // Null skips the shelf request: AuthorsTab fetches its own list, and the
    // header still comes from the profile call.
    showsAuthors(tab, sub) ? null : tab,
    page,
    PAGE_SIZE,
  );

  if (loading) return <Loader />;

  // Its own state rather than the silent Discover fallback the `*` route uses:
  // a mistyped handle should say the profile does not exist.
  if (notFound) return <NotFound handle={handle} />;
  if (error || !profile) {
    return (
      <div className={styles.page}>
        <p className={styles.message} role="alert">
          Could not load this profile just now.
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
        favorite={<FavoriteReader handle={profile.handle} initial={profile.isFavorite ?? false} />}
      />
      <Tabs active={tab} onSelect={onSelectTab} sub={sub} onSelectSub={onSelectSub} />
      {showsAuthors(tab, sub) ? (
        <AuthorsTab handle={handle} owner={false} />
      ) : (
        <>
          <Grid entries={entries} navigate={navigate} />
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onChange={onPage} />
        </>
      )}
    </div>
  );
}

function OwnerProfile({
  handle,
  tab,
  sub,
  onSelectTab,
  onSelectSub,
  page,
  onPage,
  navigate,
}: ViewProps) {
  const { user } = useAuth();
  const { entries, total, loading } = useLibraryData();
  const flags = useEntryFlags();

  // Filtered here rather than by the server: useLibraryData already holds the
  // whole shelf, which is what the owner's /library page works from too.
  const shown = useMemo(() => {
    const applied = flags.apply(entries);
    if (tab === 'reading') return applied.filter((e) => e.status === 'reading');
    if (tab === 'favorites') return applied.filter((e) => e.isFavorite);
    return applied;
  }, [entries, flags, tab]);

  if (loading) return <Loader />;

  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <Header
        handle={handle}
        displayName={user?.displayName ?? handle}
        bookCount={total}
      />

      <Tabs active={tab} onSelect={onSelectTab} sub={sub} onSelectSub={onSelectSub} />
      {showsAuthors(tab, sub) ? (
        <AuthorsTab handle={handle} owner />
      ) : (
        <>
          {/* Reaches the whole tab rather than the page on screen: paging is
              not a filter, and 24 of 349 is not what "all" means here. */}
          <ShowAllRow items={shown} onSetAll={flags.hideMany} />
          <Grid
            entries={pageItems}
            navigate={navigate}
            onToggleShown={(entry, shownNext) => flags.toggleHidden(entry, !shownNext)}
          />
          <Pagination
            page={page}
            pageCount={Math.ceil(shown.length / PAGE_SIZE)}
            onChange={onPage}
          />
        </>
      )}

      {/* Last, not first (LOS-281). It is the state of the page and the link to
          it — a thing to reach for once, having read what is on the page — and
          above the books it stood between the reader and their own shelf. */}
      <PublicPageBar handle={handle} />
    </div>
  );
}

/**
 * The switch that publishes the page, with the address it would have.
 *
 * Saved on the spot rather than behind a Save button: it is one click with a
 * visible consequence, and pairing it with Save invites a reader to flip it,
 * walk away, and believe their library is public when it is not. Set before the
 * request and put back if the server refuses, so it never claims a state the
 * server denies.
 */
function PublicPageBar({ handle }: { handle: string }) {
  const { user, updateUser } = useAuth();
  const [isPublic, setIsPublic] = useState(user?.isDiscoverable ?? false);

  async function toggle(next: boolean) {
    setIsPublic(next);
    try {
      const { user: updated } = await updateMe({ isDiscoverable: next });
      setIsPublic(updated.isDiscoverable);
      updateUser({ isDiscoverable: updated.isDiscoverable });
    } catch {
      setIsPublic(!next);
      toast({ text: 'Could not change who can see your page' });
    }
  }

  return (
    <div className={styles.ownerBar}>
      <div className={styles.ownerState}>
        <label className={styles.switchRow}>
          <input
            type="checkbox"
            className={styles.switch}
            checked={isPublic}
            onChange={(event) => toggle(event.target.checked)}
          />
          <span>Anyone with the link can see this page</span>
        </label>
        {/* Where the ticks are explained, next to where they are used. */}
        <p className={styles.ownerHint}>Unticked books and authors stay off it.</p>
      </div>
      <CopyLink handle={handle} enabled={isPublic} />
    </div>
  );
}

/**
 * One button for the whole tab, named for what it reaches the way the library's
 * selection toolbar is. Only the rows that would change are sent, so ticking
 * "all" on a shelf that is already public costs nothing.
 */
function ShowAllRow({
  items,
  onSetAll,
}: {
  items: LibraryEntry[];
  onSetAll: (entries: LibraryEntry[], hidden: boolean) => void;
}) {
  // Nothing to count and nothing to flip, so the row would only say so twice:
  // the grid already answers with "Nothing here yet".
  if (items.length === 0) return null;

  const publicCount = items.filter((entry) => !entry.isHidden).length;
  const allPublic = publicCount === items.length;

  function setAll(nextShown: boolean) {
    const changing = items.filter((entry) => !entry.isHidden !== nextShown);
    if (changing.length > 0) onSetAll(changing, !nextShown);
  }

  return (
    <div className={styles.bulkRow}>
      <span className={styles.bulkCount}>
        {publicCount} of {items.length} shown publicly
      </span>
      <button type="button" className={styles.bulkButton} onClick={() => setAll(!allPublic)}>
        {allPublic ? `Hide all ${items.length}` : `Show all ${items.length}`}
      </button>
    </div>
  );
}

function Header({
  handle,
  displayName,
  joinedAt,
  bookCount,
  favorite,
}: {
  handle: string;
  displayName: string;
  joinedAt?: string;
  bookCount: number;
  favorite?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.nameRow}>
        <h1 className={styles.name}>{displayName}</h1>
        {favorite}
      </div>
      <p className={styles.meta}>
        <span className={styles.handle}>@{handle}</span>
        {' · '}
        {bookCount} {bookCount === 1 ? 'book' : 'books'}
        {joinedAt && ` · joined ${new Date(joinedAt).getFullYear()}`}
      </p>
    </header>
  );
}

/**
 * The heart on someone else's profile. An override rather than a mirrored
 * copy, the same shape the author page uses: null means whatever the server
 * said, so a failed request needs no remembered value to restore.
 *
 * Absent when signed out — there is nowhere to store the answer.
 */
function FavoriteReader({ handle, initial }: { handle: string; initial: boolean }) {
  const { isAuthenticated } = useAuth();
  const [override, setOverride] = useState<boolean | null>(null);

  if (!isAuthenticated) return null;

  const favorite = override ?? initial;

  async function toggle(next: boolean) {
    setOverride(next);
    try {
      await setUserFavorite(handle, next);
    } catch {
      setOverride(null);
      toast({
        text: next ? `Could not favourite @${handle}` : `Could not unfavourite @${handle}`,
      });
    }
  }

  return <FavoriteButton isFavorite={favorite} onToggle={toggle} />;
}

/**
 * The same rows for the owner as for a visitor. This page is what the public
 * sees, and the owner sees it as the public would — their private lists live on
 * /favorites (LOS-279).
 */
function Tabs({
  active,
  onSelect,
  sub,
  onSelectSub,
}: {
  active: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  sub: FavoritesSub;
  onSelectSub: (sub: FavoritesSub) => void;
}) {
  return (
    <>
      <TabBar tabs={TABS} active={active} onSelect={onSelect} label="Profile sections" />
      {active === 'favorites' && (
        <TabBar
          tabs={SUB_TABS}
          active={sub}
          onSelect={onSelectSub}
          label="Favourites"
          variant="sub"
        />
      )}
    </>
  );
}

function Grid({
  entries,
  navigate,
  onToggleShown,
}: {
  entries: LibraryEntry[];
  navigate: ReturnType<typeof useNavigate>;
  /** Owner only. Absent for a visitor, who gets no ticks at all. */
  onToggleShown?: (entry: LibraryEntry, shown: boolean) => void;
}) {
  if (entries.length === 0) {
    return <p className={styles.message}>Nothing here yet.</p>;
  }

  return (
    <div className={styles.grid}>
      {entries.map((entry) => (
        // Otherwise read-only: no status control, no card menu, no rating. Even
        // for the owner -- this is the shelf as it is seen, and /library is
        // where it is edited.
        <BookCard
          key={entry.book.id}
          book={entry.book}
          status={entry.status}
          onClick={() => navigate(buildBookHref(entry.book))}
          // The same slot the library grid uses for its select box. A tick
          // means the book is on the public page; no separate badge says so
          // as well, because the tick already does.
          action={
            onToggleShown && (
              <input
                type="checkbox"
                className={styles.showBox}
                checked={!entry.isHidden}
                onChange={(event) => onToggleShown(entry, event.target.checked)}
                aria-label={`Show ${entry.book.title} on your public page`}
              />
            )
          }
        />
      ))}
    </div>
  );
}

function CopyLink({ handle, enabled }: { handle: string; enabled: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = `bookhunt.net/${handle}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused. The address is on screen either way,
      // which is why it is shown rather than hidden behind the button.
    }
  }

  return (
    <span className={styles.copyRow}>
      <code className={styles.url}>{url}</code>
      <button
        type="button"
        className={styles.copyButton}
        onClick={copy}
        disabled={!enabled}
        title={enabled ? undefined : 'Your page is private, so this link would not work'}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function NotFound({ handle }: { handle: string }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.name}>No such profile</h1>
      <p className={styles.message}>
        Nobody here goes by <span className={styles.handle}>@{handle}</span>, or their page is
        not public.
      </p>
      <p className={styles.message}>
        <Link to="/">Back to Discover</Link>
      </p>
    </div>
  );
}
