import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAbortError } from '../../api/client';
import {
  getMyFavoriteAuthors,
  getPublicFavoriteAuthors,
} from '../../api/users/get-favorite-authors';
import type { FavoriteAuthor } from '../../api/users/get-favorite-authors';
import { setAuthorHidden } from '../../api/users/set-author-hidden';
import { toast } from '../../shared/toast/toast-store';
import { pluralize } from '../../shared/lib/text';
import styles from './ProfilePage.module.css';

/**
 * The favourite-authors tab.
 *
 * Reads a different endpoint for the owner than for a visitor, for the same
 * reason the rest of the page does: the public one is gated on the page being
 * on, and the owner has to see their own list either way.
 *
 * The owner also gets a tick per author, saying whether it appears on the
 * public page. Authors carry their own flag (LOS-282) rather than a library
 * entry's, so the toggle lives here rather than in useEntryFlags.
 */
export function AuthorsTab({ handle, owner }: { handle: string; owner: boolean }) {
  const [authors, setAuthors] = useState<FavoriteAuthor[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const request = owner
      ? getMyFavoriteAuthors(controller.signal)
      : getPublicFavoriteAuthors(handle, controller.signal);

    request
      .then((response) => setAuthors(response.authors))
      .catch((err) => {
        if (isAbortError(err)) return;
        setAuthors([]);
      });

    return () => controller.abort();
  }, [handle, owner]);

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

  if (authors === null) return <p className={styles.message}>Loading…</p>;
  if (authors.length === 0) {
    return (
      <p className={styles.message}>
        {owner ? 'You have not favourited any authors yet.' : 'No favourite authors yet.'}
      </p>
    );
  }

  const publicCount = authors.filter((author) => !author.isHidden).length;
  const allPublic = publicCount === authors.length;

  // Only the rows that would change, so ticking "all" on a list that is
  // already public sends nothing.
  function setAll(nextShown: boolean) {
    for (const author of authors ?? []) {
      if (!author.isHidden !== nextShown) void toggle(author, !nextShown);
    }
  }

  return (
    <>
      {owner && (
        <div className={styles.bulkRow}>
          <span className={styles.bulkCount}>
            {publicCount} of {authors.length} shown publicly
          </span>
          <button
            type="button"
            className={styles.bulkButton}
            onClick={() => setAll(!allPublic)}
          >
            {allPublic ? `Hide all ${authors.length}` : `Show all ${authors.length}`}
          </button>
        </div>
      )}

      <ul className={styles.authorList}>
        {authors.map((author) => (
          <li key={author.slug} className={styles.authorRow}>
            {owner && (
              <input
                type="checkbox"
                className={styles.showBox}
                checked={!author.isHidden}
                onChange={(event) => toggle(author, !event.target.checked)}
                aria-label={`Show ${author.name} on your public page`}
              />
            )}
            <Link to={`/authors/${author.slug}`} className={styles.authorName}>
              {author.name}
            </Link>
            <span className={styles.authorCount}>
              {author.bookCount} {pluralize(author.bookCount, 'book')}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
