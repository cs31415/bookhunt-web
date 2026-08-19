import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { updateMe } from '../../api/users/update-me';
import { useAuth } from '../auth/AuthContext';
import { useThemeChoice } from '../../shared/theme/ThemeContext';
import type { ThemeChoice } from '../../shared/theme/theme';
import styles from './SettingsPage.module.css';

const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Configuration only. Favourites and the library live on the profile page, and
 * so does the public-page switch (LOS-287) -- what a page shows is chosen where
 * the page is. Settings holds the things a reader changes and leaves.
 */
export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { choice: themeChoice, setChoice: setThemeChoice } = useThemeChoice();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [handle, setHandle] = useState(user?.handle ?? '');

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

      {/* A radio group, not a two-state switch: "System" is a real choice --
          keep following the machine -- and a toggle can only say light or dark,
          which quietly freezes a reader to whichever the OS is today. */}
      <fieldset className={styles.card}>
        <legend className={styles.sectionHeading}>Appearance</legend>
        <div className={styles.choices}>
          {THEME_CHOICES.map(({ value, label }) => (
            <label key={value} className={styles.choice}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={themeChoice === value}
                onChange={() => setThemeChoice(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p className={styles.hint}>
          Applies straight away, and follows you to another browser once you are signed in.
        </p>
      </fieldset>

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
