import { useEffect, useMemo, useState } from 'react';
import { isAbortError } from '../../api/client';
import { getMyFavoriteAuthors } from '../../api/users/get-favorite-authors';
import type { FavoriteAuthor } from '../../api/users/get-favorite-authors';
import { setAuthorHidden } from '../../api/users/set-author-hidden';
import { useLibraryData } from '../library/hooks/useLibraryData';
import { useEntryFlags } from '../library/hooks/useEntryFlags';
import { toast } from '../../shared/toast/toast-store';
import { pluralize } from '../../shared/lib/text';
import type { LibraryEntry } from '../../normalize/library';
import styles from './PublicVisibilityPicker.module.css';

/**
 * What a visitor to bookhunt.net/<handle> would see, as a list of ticks.
 *
 * A tick means public. Hiding a book has been possible since LOS-253, but only
 * from the library's Edit mode, one filtered set at a time -- so there was
 * nowhere that answered "what would a visitor see?", and no way to answer it
 * *before* publishing. This is that place, which is why it sits beside the
 * switch rather than on the profile: the order is choose, then publish.
 *
 * The library's Edit mode stays as the in-context path. It acts on the books
 * already on screen; this shows the whole picture at once.
 */
export function PublicVisibilityPicker({ isPublic }: { isPublic: boolean }) {
  const { entries, loading } = useLibraryData();
  const flags = useEntryFlags();
  const books = flags.apply(entries);

  return (
    <div className={styles.picker}>
      <p className={styles.explain}>
        {isPublic
          ? 'Anything unticked stays off your public page. Your own library is unchanged.'
          : 'Untick anything you would not want shown. This takes effect when you make the page public.'}
      </p>

      <BookList books={books} loading={loading} onHideMany={flags.hideMany} />
      <AuthorList />
    </div>
  );
}

function BookList({
  books,
  loading,
  onHideMany,
}: {
  books: LibraryEntry[];
  loading: boolean;
  onHideMany: (entries: LibraryEntry[], next: boolean) => void;
}) {
  const [filter, setFilter] = useState('');

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return books;
    return books.filter(
      (entry) =>
        entry.book.title.toLowerCase().includes(needle) ||
        entry.book.authorName.toLowerCase().includes(needle),
    );
  }, [books, filter]);

  const publicCount = shown.filter((entry) => !entry.isHidden).length;
  const allPublic = shown.length > 0 && publicCount === shown.length;

  // Only the books whose state would actually change, so ticking "all" on a
  // shelf that is already public costs nothing rather than 349 requests.
  function setAll(next: boolean) {
    const changing = shown.filter((entry) => Boolean(entry.isHidden) !== next);
    if (changing.length > 0) onHideMany(changing, next);
  }

  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle}>
          Books{' '}
          <span className={styles.count}>
            {publicCount} of {shown.length} shown
          </span>
        </h3>
        <button
          type="button"
          className={styles.link}
          onClick={() => setAll(allPublic)}
          disabled={shown.length === 0}
        >
          {/* Named for what it reaches, the way the library's toolbar does:
              "all" here means the filtered set, not the whole shelf. */}
          {allPublic ? `Hide all ${shown.length}` : `Show all ${shown.length}`}
        </button>
      </div>

      <input
        type="search"
        className={styles.filter}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filter by title or author…"
        aria-label="Filter books"
      />

      {loading ? (
        <p className={styles.message}>Loading your library…</p>
      ) : shown.length === 0 ? (
        <p className={styles.message}>
          {books.length === 0 ? 'Nothing in your library yet.' : 'No books match that.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {shown.map((entry) => (
            <li key={entry.book.id}>
              <label className={styles.row}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={!entry.isHidden}
                  onChange={(event) => onHideMany([entry], !event.target.checked)}
                />
                <span className={styles.rowTitle}>{entry.book.title}</span>
                <span className={styles.rowMeta}>{entry.book.authorName}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Favourite authors, which carry their own flag (LOS-282) rather than a library
 * entry's. Few enough that they need no filter and no paging.
 */
function AuthorList() {
  const [authors, setAuthors] = useState<FavoriteAuthor[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getMyFavoriteAuthors(controller.signal)
      .then((response) => setAuthors(response.authors))
      .catch((err) => {
        if (isAbortError(err)) return;
        setAuthors([]);
      });
    return () => controller.abort();
  }, []);

  // Optimistic, and a failure falls back to whatever the server last said
  // rather than to a remembered value -- the rule useEntryFlags follows.
  async function toggle(author: FavoriteAuthor, isHidden: boolean) {
    setAuthors((current) =>
      (current ?? []).map((row) => (row.slug === author.slug ? { ...row, isHidden } : row)),
    );
    try {
      await setAuthorHidden(author.slug, isHidden);
    } catch {
      setAuthors((current) =>
        (current ?? []).map((row) =>
          row.slug === author.slug ? { ...row, isHidden: author.isHidden } : row,
        ),
      );
      toast({ text: `Could not update ${author.name}` });
    }
  }

  function setAll(next: boolean) {
    for (const author of authors ?? []) {
      if (Boolean(author.isHidden) !== next) void toggle(author, next);
    }
  }

  const list = authors ?? [];
  const publicCount = list.filter((author) => !author.isHidden).length;
  const allPublic = list.length > 0 && publicCount === list.length;

  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle}>
          Authors{' '}
          <span className={styles.count}>
            {publicCount} of {list.length} shown
          </span>
        </h3>
        <button
          type="button"
          className={styles.link}
          onClick={() => setAll(allPublic)}
          disabled={list.length === 0}
        >
          {allPublic ? `Hide all ${list.length}` : `Show all ${list.length}`}
        </button>
      </div>

      {authors === null ? (
        <p className={styles.message}>Loading…</p>
      ) : list.length === 0 ? (
        <p className={styles.message}>No favourite authors yet.</p>
      ) : (
        <ul className={styles.list}>
          {list.map((author) => (
            <li key={author.slug}>
              <label className={styles.row}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={!author.isHidden}
                  onChange={(event) => toggle(author, !event.target.checked)}
                />
                <span className={styles.rowTitle}>{author.name}</span>
                <span className={styles.rowMeta}>
                  {author.bookCount} {pluralize(author.bookCount, 'book')}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
