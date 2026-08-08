import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { postRegister } from '../../api/auth/register';
import { CheckYourEmail } from './CheckYourEmail';
import styles from './RegisterPage.module.css';

// Mirrors validatePassword on the API (LOS-218). Kept in step by hand: the
// backend re-checks everything, so the worst a drift can do is show the
// browser's message where the server would have shown its own.
const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await postRegister({ email, password, displayName });
      // Swapped in place rather than navigated to, so the address the reader
      // just typed stays on screen next to the instruction to go and check it.
      setRegisteredEmail(email);
    } catch (err) {
      setError(messageFor(err));
      setPending(false);
    }
  }

  if (registeredEmail) {
    return <CheckYourEmail email={registeredEmail} />;
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} aria-labelledby="register-heading">
        <h1 id="register-heading" className={styles.heading}>
          Start your library
        </h1>
        <p className={styles.subheading}>
          Track what you have read, and get recommendations that follow from it.
        </p>

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

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {/* The hint sits outside the label and is attached with
            aria-describedby: inside it, it would become part of the field's
            accessible name, which screen readers announce as "Password at
            least 8 characters" every time focus lands. */}
        <div className={styles.fieldGroup}>
          <label className={`${styles.field} ${styles.fieldTight}`}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby="password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <span id="password-hint" className={styles.hint}>
            At least {MIN_PASSWORD_LENGTH} characters.
          </span>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>

        <p className={styles.altAction}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    // Unlike sign-in, there is no enumeration to protect here: whoever is
    // filling this in has to be told the address is taken.
    if (err.status === 409) return 'That email is already registered.';
    // The API writes its 400s to be read by the person filling in the form.
    if (err.status === 400) return err.message;
    if (err.status === 429) return 'Too many attempts. Please try again later.';
  }
  return 'Something went wrong. Please try again.';
}
