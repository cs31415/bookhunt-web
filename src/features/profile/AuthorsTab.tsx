import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAbortError } from '../../api/client';
import {
  getMyFavoriteAuthors,
  getPublicFavoriteAuthors,
} from '../../api/users/get-favorite-authors';
import type { FavoriteAuthor } from '../../api/users/get-favorite-authors';
import { pluralize } from '../../shared/lib/text';
import styles from './ProfilePage.module.css';

/**
 * The favourite-authors tab.
 *
 * Reads a different endpoint for the owner than for a visitor, for the same
 * reason the rest of the page does: the public one is gated on the page being
 * on, and the owner has to see their own list either way.
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

  if (authors === null) return <p className={styles.message}>Loading…</p>;
  if (authors.length === 0) {
    return (
      <p className={styles.message}>
        {owner ? 'You have not favourited any authors yet.' : 'No favourite authors yet.'}
      </p>
    );
  }

  return (
    <ul className={styles.authorList}>
      {authors.map((author) => (
        <li key={author.slug} className={styles.authorRow}>
          <Link to={`/authors/${author.slug}`} className={styles.authorName}>
            {author.name}
          </Link>
          <span className={styles.authorCount}>
            {author.bookCount} {pluralize(author.bookCount, 'book')}
          </span>
        </li>
      ))}
    </ul>
  );
}
