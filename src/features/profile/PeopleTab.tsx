import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAbortError } from '../../api/client';
import { getFavoriteUsers } from '../../api/users/get-favorite-users';
import type { FavoriteUser } from '../../api/users/get-favorite-users';
import styles from './ProfilePage.module.css';

/**
 * The readers you have favourited. Owner mode only, and there is no visitor
 * equivalent to fall back to: a public follow list is a different privacy
 * question from public taste in books, and the API offers no route for it.
 */
export function PeopleTab() {
  const [users, setUsers] = useState<FavoriteUser[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFavoriteUsers(controller.signal)
      .then((response) => setUsers(response.users))
      .catch((err) => {
        if (isAbortError(err)) return;
        setUsers([]);
      });
    return () => controller.abort();
  }, []);

  if (users === null) return <p className={styles.message}>Loading…</p>;
  if (users.length === 0) {
    return <p className={styles.message}>You have not favourited any readers yet.</p>;
  }

  return (
    <ul className={styles.authorList}>
      {users.map((user) => (
        <li key={user.handle} className={styles.authorRow}>
          <Link to={`/${user.handle}`} className={styles.authorName}>
            {user.displayName} <span className={styles.handle}>@{user.handle}</span>
          </Link>
          {/* Named for what it permits, not for the state: "mutual" says
              nothing to a reader, "can message" says what it is for. */}
          <span className={styles.authorCount}>
            {user.isMutual ? 'Can message' : 'Not yet mutual'}
          </span>
        </li>
      ))}
    </ul>
  );
}
