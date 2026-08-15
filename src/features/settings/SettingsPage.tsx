import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { updateMe } from '../../api/users/update-me';
import { useAuth } from '../auth/AuthContext';
import styles from './SettingsPage.module.css';

/**
 * Configuration only. Favourites and the library live on the profile page --
 * settings holds the things a reader changes and leaves.
 */
export function SettingsPage() {
  const { user, updateUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [handle, setHandle] = useState(user?.handle ?? '');
  // The public-page switch is saved on the spot rather than with the form: it
  // is one click with a visible consequence, and pairing it with a Save button
  // invites a reader to flip it, walk away, and believe their library is public
  // when it is not.
  const [isDiscoverable, setIsDiscoverable] = useState(user?.isDiscoverable ?? false);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const { user: updated } = await updateMe({ displayName, handle });
      updateUser({ displayName: updated.displayName, handle: updated.handle });
      setHandle(updated.handle);
      setSaved(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setPending(false);
    }
  }

  async function toggleDiscoverable(next: boolean) {
    setError(null);
    // Moved before the request so the switch answers the click; put back if the
    // request refuses it, so the control never claims a state the server denies.
    setIsDiscoverable(next);
    try {
      const { user: updated } = await updateMe({ isDiscoverable: next });
      setIsDiscoverable(updated.isDiscoverable);
      updateUser({ isDiscoverable: updated.isDiscoverable });
    } catch (err) {
      setIsDiscoverable(!next);
      setError(messageFor(err));
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>

      <form className={styles.card} onSubmit={handleSubmit} aria-labelledby="profile-heading">
        <h2 id="profile-heading" className={styles.sectionHeading}>
          Profile
        </h2>

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            type="text"
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        {/* Explicitly associated rather than wrapping, as on the sign-up form:
            a nested label would take the @ into the accessible name. */}
        <div className={styles.fieldGroup}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-handle">
              Handle
            </label>
            <div className={styles.prefixed}>
              <span className={styles.prefix} aria-hidden="true">
                @
              </span>
              <input
                id="settings-handle"
                className={`${styles.input} ${styles.prefixedInput}`}
                type="text"
                name="handle"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="settings-handle-hint"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                required
              />
            </div>
          </div>
          <span id="settings-handle-hint" className={styles.hint}>
            Changing this changes your public address. Old links stop working.
          </span>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className={styles.saved} role="status">
            Saved.
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      <section className={styles.card} aria-labelledby="public-heading">
        <h2 id="public-heading" className={styles.sectionHeading}>
          Public page
        </h2>
        <p className={styles.explain}>
          Off by default. When it is on, anyone with the link can read your library, what you
          are currently reading, and your favourites. Books you have hidden never appear.
        </p>

        <label className={styles.switchRow}>
          <input
            type="checkbox"
            className={styles.switch}
            checked={isDiscoverable}
            onChange={(event) => toggleDiscoverable(event.target.checked)}
          />
          <span>Make my library public</span>
        </label>

        <p className={styles.address}>
          {isDiscoverable ? (
            <>
              Your page: <code className={styles.code}>bookhunt.net/{handle}</code>
            </>
          ) : (
            <>
              It would be at <code className={styles.code}>bookhunt.net/{handle}</code>
            </>
          )}
        </p>
      </section>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    // The only 409 settings can produce: the address is not editable here.
    if (err.status === 409) return err.message;
    // The API writes its 400s to be read by the person filling in the form.
    if (err.status === 400) return err.message;
    if (err.status === 429) return 'Too many changes just now. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}
