import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { Loader } from '../../shared/components/Loader/Loader';
import { LoadMore } from '../../shared/components/LoadMore/LoadMore';
import { TabBar } from '../../shared/components/TabBar/TabBar';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { useShelfParams, showsAuthors, PAGE_SIZE, TABS, SUB_TABS } from './useShelfParams';
import type { FavoritesSub, ShelfParams } from './useShelfParams';
import { PublicTick } from './PublicTick';
import { VisibilityBar } from './VisibilityBar';
import { useEditMode } from './useEditMode';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { useAuth } from '../auth/AuthContext';
import { updateMe } from '../../api/users/update-me';
import { createShareLink, deleteShareLink, getShareLink } from '../../api/users/share-link';
import { useLibraryData } from '../library/hooks/useLibraryData';
import { topCategories, topMoods, topThemes } from '../library/lib/breakdowns';
import { useEntryFlags } from '../library/hooks/useEntryFlags';
import { useVisitorProfile } from './useProfile';
import { useShelfFacets } from './useShelfFacets';
import { ProfileFacets } from './components/ProfileFacets/ProfileFacets';
import { FilterRail } from '../../shared/components/FilterRail/FilterRail';
import type { ProfileTab } from './useProfile';
import type { LibraryEntry } from '../../normalize/library';
import { AuthorsTab } from './AuthorsTab';
import { FavoriteButton } from '../../shared/components/FavoriteButton/FavoriteButton';
import { setUserFavorite } from '../../api/users/set-user-favorite';
import { toast } from '../../shared/toast/toast-store';
import styles from './ProfilePage.module.css';


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
  const shelf = useShelfParams();

  const isOwner = Boolean(user?.handle && user.handle.toLowerCase() === handle.toLowerCase());
  const view = { ...shelf, handle, navigate };

  return isOwner ? <OwnerProfile {...view} /> : <VisitorProfileView {...view} />;
}

export interface ViewProps extends ShelfParams {
  handle: string;
  navigate: ReturnType<typeof useNavigate>;
}

/**
 * The owner's in-memory equivalent of what fn_get_public_library does for a
 * visitor. Kept deliberately in step with it: title or author for the query,
 * and a whole-value match for the category, so "Fiction" does not pull in
 * "Science Fiction".
 */
function matchesFilters(
  entry: LibraryEntry,
  query: string,
  subject: string,
  mood: string,
  theme: string,
): boolean {
  if (subject && !entry.subjects.some((s) => s.toLowerCase() === subject.toLowerCase())) {
    return false;
  }
  if (mood && !entry.moods.some((m) => m.toLowerCase() === mood.toLowerCase())) return false;
  if (theme && !entry.themes.some((t) => t.toLowerCase() === theme.toLowerCase())) return false;
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    entry.book.title.toLowerCase().includes(needle) ||
    entry.book.authorName.toLowerCase().includes(needle)
  );
}

/**
 * The box over the shelf, and the category chip when one is picked.
 *
 * The chip is shown rather than only reflected in the URL: a shelf that has
 * quietly dropped to 24 of 349 books needs to say why, and needs a way back.
 */
export function ShelfFilters({
  q,
  onQueryChange,
  subject,
  onClearSubject,
  matches,
  filtered,
}: {
  q: string;
  onQueryChange: (value: string) => void;
  subject: string;
  onClearSubject: () => void;
  matches: number;
  filtered: boolean;
}) {
  return (
    <div className={styles.filters}>
      <SearchBar
        value={q}
        onChange={onQueryChange}
        placeholder="Search"
      />
      {(subject || filtered) && (
        <div className={styles.filterRow}>
          {subject && (
            <button
              type="button"
              className={styles.chip}
              onClick={onClearSubject}
              aria-label={`Clear the ${subject} filter`}
            >
              {subject}
              <span aria-hidden="true" className={styles.chipX}>
                ×
              </span>
            </button>
          )}
          {filtered && (
            <span className={styles.matchCount} role="status">
              {matches} {matches === 1 ? 'book' : 'books'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function VisitorProfileView({
  handle,
  tab,
  sub,
  onSelectTab,
  onSelectSub,
  navigate,
  q,
  onQueryChange,
  appliedQuery,
  subject,
  onSelectSubject,
  mood,
  onSelectMood,
  theme,
  onSelectTheme,
  onClearFilters,
  activeFilterCount,
}: ViewProps) {
  const { profile, entries, total, loading, searching, notFound, error, loadingMore, onMore } =
    useVisitorProfile(
      handle,
      // Null skips the shelf request: AuthorsTab fetches its own list, and the
      // header still comes from the profile call.
      showsAuthors(tab, sub) ? null : tab,
      PAGE_SIZE,
      // Filtered by the server, not in the browser: a visitor holds only what
      // has been fetched, and searching that is not searching the shelf.
      { q: appliedQuery, subject, mood, theme },
    );

  const facets = useShelfFacets('handle', handle);

  if (loading) return <Loader />;

  // Its own state rather than the silent Discover fallback the `*` route uses:
  // a mistyped handle should say the profile does not exist.
  if (notFound) return <NotFound />;
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
        <div className={styles.layout}>
          <FilterRail label="Shelf filters" activeCount={activeFilterCount}>
            <ProfileFacets
              facets={facets}
              subject={subject}
              mood={mood}
              theme={theme}
              onSelectSubject={onSelectSubject}
              onSelectMood={onSelectMood}
              onSelectTheme={onSelectTheme}
              onClearFilters={onClearFilters}
            />
          </FilterRail>

          <div className={styles.results}>
            <ShelfFilters
              q={q}
              onQueryChange={onQueryChange}
              subject={subject}
              onClearSubject={() => onSelectSubject('')}
              matches={total}
              filtered={Boolean(appliedQuery || subject || mood || theme)}
            />
            {/* Dimmed rather than replaced: the previous answer stays readable,
                and the search box keeps focus because nothing unmounts. */}
            <div className={searching ? styles.searching : undefined}>
              <Grid entries={entries} navigate={navigate} />
            </div>
            <LoadMore shown={entries.length} total={total} onMore={onMore} busy={loadingMore} />
          </div>
        </div>
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
  shownCount,
  onMore,
  navigate,
  q,
  onQueryChange,
  subject,
  onSelectSubject,
  mood,
  onSelectMood,
  theme,
  onSelectTheme,
  onClearFilters,
  activeFilterCount,
}: ViewProps) {
  const { user } = useAuth();
  const { entries, total, loading } = useLibraryData();
  const flags = useEntryFlags();
  // Ticks move this, not the server. Book id -> the isHidden it would be
  // saved with; a key disappears again as soon as it agrees with the shelf.
  const [staged, setStaged] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  // The ticks are the edit mode: out of it the shelf is a shelf, and the only
  // thing a book offers is being opened (LOS-346).
  const edit = useEditMode(useCallback(() => setStaged({}), []));

  // What the server last said, as the ticks would be without the staging.
  const saved = useMemo(() => flags.apply(entries), [entries, flags]);

  /*
   * Derived, not fetched. useLibraryData holds every entry, so the values are
   * already here -- and they are the same helpers the library rail uses, so
   * the owner's two shelves offer the same pills. A visitor cannot do this,
   * which is why useShelfFacets exists for that side.
   *
   * From `saved` rather than the filtered list: a rail that dropped its own
   * options as you used them would strand you on a filter you could not undo.
   */
  const facets = useMemo(
    () => ({
      subject: topCategories(saved),
      mood: topMoods(saved),
      theme: topThemes(saved),
      status: [],
    }),
    [saved],
  );

  // Filtered here rather than by the server: useLibraryData already holds the
  // whole shelf, which is what the owner's /library page works from too.
  const shown = useMemo(() => {
    const withStaged = saved.map((entry) =>
      entry.book.id in staged ? { ...entry, isHidden: staged[entry.book.id] } : entry,
    );
    const byTab =
      tab === 'reading'
        ? withStaged.filter((e) => e.status === 'reading')
        : tab === 'favorites'
          ? withStaged.filter((e) => e.isFavorite)
          : withStaged;

    // Filtered here rather than by the server, unlike the visitor's shelf:
    // useLibraryData already holds every book, so this really is the whole
    // library being searched and a request would ask for what is in hand.
    //
    // Off `q`, what is typed, rather than `appliedQuery`, what the URL has
    // caught up to. An in-memory filter costs nothing, so making it wait on the
    // 300ms debounce only made the profile slower than /library at the same job
    // (LOS-310). The debounced URL write stays -- that is for linking, not for
    // filtering.
    return byTab.filter((entry) => matchesFilters(entry, q, subject, mood, theme));
  }, [saved, staged, tab, q, subject, mood, theme]);

  // Compared against, so a tick moved back to what the shelf says stops
  // counting as a change rather than being saved as a no-op.
  const savedHidden = useMemo(
    () => new Map(saved.map((entry) => [entry.book.id, Boolean(entry.isHidden)])),
    [saved],
  );

  /**
   * Selects rows and records what each would become.
   *
   * Always assigns, where this used to drop a key that matched the shelf
   * (LOS-358). A selection is a selection even when it changes nothing: Hide
   * all ticks every book, including ones already hidden. What would actually be
   * written is `dirtyCount` below, derived rather than inferred from the keys.
   */
  function stage(items: LibraryEntry[], hidden: boolean) {
    setStaged((current) => {
      const next = { ...current };
      for (const item of items) next[item.book.id] = hidden;
      return next;
    });
  }

  /** Ticks or unticks one row. Unticking cancels that row's pending change. */
  function toggleStaged(entry: LibraryEntry, selected: boolean) {
    setStaged((current) => {
      const next = { ...current };
      // The action a row offers is always the opposite of where it rests.
      if (selected) next[entry.book.id] = !(savedHidden.get(entry.book.id) ?? false);
      else delete next[entry.book.id];
      return next;
    });
  }

  /**
   * What a save would actually write, which is not the same as what is ticked.
   * A book already hidden and staged to hide is selected and costs nothing, so
   * the bar can read "every box ticked, 0 unsaved" and be telling the truth.
   */
  const stagedChanges = useMemo(
    () =>
      Object.entries(staged).filter(
        ([bookId, hidden]) => savedHidden.get(Number(bookId)) !== hidden,
      ),
    [staged, savedHidden],
  );

  async function save() {
    // Only what differs, and hideMany already reports what it could not write.
    const changed = new Set(stagedChanges.map(([bookId]) => Number(bookId)));
    const toHide = saved.filter((entry) => changed.has(entry.book.id) && staged[entry.book.id]);
    const toShow = saved.filter((entry) => changed.has(entry.book.id) && !staged[entry.book.id]);

    setSaving(true);
    if (toHide.length > 0) await flags.hideMany(toHide, true);
    if (toShow.length > 0) await flags.hideMany(toShow, false);
    setSaving(false);
    // Dropped whatever the writes did: the overrides now carry the answer, and
    // a failed one has fallen back to what the server says. Leaving the mode
    // with it -- a save is the end of the task, not a step in it.
    edit.exit();
  }

  if (loading) return <Loader />;

  const pageItems = shown.slice(0, shownCount);

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
        <div className={styles.layout}>
          <FilterRail label="Shelf filters" activeCount={activeFilterCount}>
            <ProfileFacets
              facets={facets}
              subject={subject}
              mood={mood}
              theme={theme}
              onSelectSubject={onSelectSubject}
              onSelectMood={onSelectMood}
              onSelectTheme={onSelectTheme}
              onClearFilters={onClearFilters}
            />
          </FilterRail>

          <div className={styles.results}>
          {/* Show all reaches the whole tab rather than the page on screen:
              paging is not a filter, and 24 of 349 is not what "all" means. */}
          <ShelfFilters
            q={q}
            onQueryChange={onQueryChange}
            subject={subject}
            onClearSubject={() => onSelectSubject('')}
            matches={shown.length}
            filtered={Boolean(q || subject || mood || theme)}
          />
          <VisibilityBar
            publicCount={shown.filter((entry) => !entry.isHidden).length}
            total={shown.length}
            editing={edit.editing}
            onEdit={edit.enter}
            onExit={edit.exit}
            onSetAll={(shownNext) => stage(shown, !shownNext)}
            dirtyCount={stagedChanges.length}
            saving={saving}
            onSave={save}
          />
          <Grid
            entries={pageItems}
            navigate={navigate}
            renderAction={
              edit.editing
                ? (entry) => (
                    <PublicTick
                      // The shelf's own state, not the staged one: the label
                      // offers the action this row started with.
                      hidden={savedHidden.get(entry.book.id) ?? false}
                      stagedHidden={staged[entry.book.id]}
                      onToggle={(selected) => toggleStaged(entry, selected)}
                    />
                  )
                : undefined
            }
          />
          <LoadMore shown={pageItems.length} total={shown.length} onMore={onMore} />
          </div>
        </div>
      )}

      {/* Last, not first (LOS-281). It is the state of the page and the link to
          it — a thing to reach for once, having read what is on the page — and
          above the books it stood between the reader and their own shelf. */}
      <PublicPageBar handle={handle} />
    </div>
  );
}

/**
 * Who can see this page, and the two addresses it can have.
 *
 * Three states, not two (LOS-305), and they are named rather than left to be
 * inferred from a switch:
 *
 *   private       nobody but you
 *   unlisted      anyone holding the share link
 *   discoverable  findable in search and in people listings
 *
 * The old label here said "anyone with the link can see this page" for the
 * discoverable switch, which is now precisely the sentence that describes the
 * OTHER state. It says findable instead.
 *
 * The switch saves on the spot rather than behind a Save button: it is one
 * click with a visible consequence, and pairing it with Save invites a reader
 * to flip it, walk away, and believe their library is public when it is not.
 * Set before the request and put back if the server refuses, so it never claims
 * a state the server denies.
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
          <span>List profile publicly</span>
        </label>
      </div>
      {/* Only while the page is listed. An address that would 404 is not
          worth showing, let alone copying. */}
      {isPublic && <CopyLink handle={handle} />}
      <ShareLinkRow />
    </div>
  );
}

/**
 * The unlisted address: a link that works for anyone holding it, and appears in
 * no listing or search (LOS-305).
 *
 * One switch, not three buttons. Enable mints a link, Disable throws it away,
 * and the button reads whichever it would do next. There is no separate stored
 * "off" state and none is needed: the token's presence *is* the state, so
 * enabling writes one and disabling clears it.
 *
 * That also means Enable never revives an old link -- it always makes a fresh
 * one, which is what the line under it says. Getting a new link while sharing
 * is Disable then Enable, and the old one is dead the moment you disable.
 *
 * Loaded once on mount. A reader who has never made one sees the offer rather
 * than an empty box.
 */
function ShareLinkRow() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShareLink()
      .then(({ token: current }) => {
        if (!cancelled) setToken(current);
      })
      .catch(() => {
        // A share link nobody has asked for yet is indistinguishable from one
        // that failed to load, so this stays quiet and offers to make one.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    const enabled = token !== null;
    setBusy(true);
    try {
      const result = enabled ? await deleteShareLink() : await createShareLink();
      setToken(result.token);
    } catch {
      toast({
        text: enabled ? 'Could not disable the share link' : 'Could not create a share link',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const enabled = token !== null;

  return (
    <div className={styles.shareRow}>
      <div className={styles.shareLinkBlock}>
        <div className={styles.shareTitle}>Private share link</div>
        {enabled && <CopyValue value={`${window.location.origin}/s/${token}`} />}
      </div>
      <div className={styles.shareToggle}>
        <button type="button" className={styles.copyButton} disabled={busy} onClick={toggle}>
          {busy ? (enabled ? 'Disabling…' : 'Enabling…') : enabled ? 'Disable' : 'Enable'}
        </button>
        {/* Says what the button would do, standing rather than waiting for a
            press -- the switch alone does not say that enabling mints a fresh
            link rather than bringing back the last one. */}
        <p className={styles.shareHint}>
          {enabled ? 'Permanently remove access to this link' : 'Generate a new share link'}
        </p>
      </div>
    </div>
  );
}

export function Header({
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
export function Tabs({
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

export function Grid({
  entries,
  navigate,
  renderAction,
}: {
  entries: LibraryEntry[];
  navigate: ReturnType<typeof useNavigate>;
  /**
   * Owner only, and absent for a visitor. A rendered control rather than a
   * callback, so the grid does not have to know what staging is (LOS-358).
   */
  renderAction?: (entry: LibraryEntry) => ReactNode;
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
          // Both scores, since the shelf is a reader's and the stars alone
          // were the catalog's (LOS-291).
          userRating={entry.userRating}
          onClick={() => navigate(buildBookHref(entry.book))}
          // The same slot the library grid uses for its select box.
          action={renderAction?.(entry)}
        />
      ))}
    </div>
  );
}

/**
 * An address on screen with a button to copy it.
 *
 * The value is always shown rather than hidden behind the button, because
 * clipboard access can be refused and a reader needs to be able to read it
 * either way. `copyText` differs from the display where one is a tidied form of
 * the other — the public page shows bookhunt.net/ada but copies the https URL.
 */
function CopyValue({ value, copyText }: { value: string; copyText?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText ?? value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Refused clipboard access. The address is on screen, so nothing is lost.
    }
  }

  return (
    <span className={styles.copyRow}>
      <code className={styles.url}>{value}</code>
      <button type="button" className={styles.copyButton} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function CopyLink({ handle }: { handle: string }) {
  const url = `bookhunt.net/${handle}`;

  return <CopyValue value={url} copyText={`https://${url}`} />;
}

/**
 * One answer for an unknown handle and for a private page alike. The API will
 * not say which, and neither does this: a different message for each would turn
 * the page into a way to test whether a handle is taken.
 *
 * The handle is no longer echoed back. It sat in the sentence only to confirm
 * what was typed, and the address bar already does that.
 */
export function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.name}>User not found or no public profile listed.</h1>
      <p className={styles.message}>Are you sure you have the right user handle?</p>
      <p className={styles.message}>
        <Link to="/">Back to Discover</Link>
      </p>
    </div>
  );
}
