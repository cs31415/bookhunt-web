import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { postRegister } from '../../api/auth/register';
import { PasswordInput } from '../../shared/components/PasswordInput/PasswordInput';
import { CheckYourEmail } from './CheckYourEmail';
import { storeCredential } from './store-credential';
import { useHandleAvailability } from './useHandleAvailability';
import styles from './RegisterPage.module.css';

// Mirrors validatePassword on the API (LOS-218). Kept in step by hand: the
// backend re-checks everything, so the worst a drift can do is show the
// browser's message where the server would have shown its own.
const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const availability = useHandleAvailability(handle);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await postRegister({ email, password, displayName, handle });
      // Offered to the password manager before the form goes away (LOS-241).
      // Sign-up gives a manager neither signal it watches for — preventDefault
      // means no navigation, and the swap below unmounts the form in the same
      // tick — so without asking outright nothing is ever saved. Awaited so the
      // prompt is raised while the form is still on screen.
      await storeCredential(email, password);
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

        {/* Same aria-describedby arrangement as the password field below, and
            for the same reason: inside the label the status would become part
            of the field's accessible name. */}
        {/* Explicitly associated rather than wrapping, unlike the other fields:
            the @ has to sit inside the field's border, and a nested label would
            take it into the accessible name as "Handle@". */}
        <div className={styles.fieldGroup}>
          <div className={`${styles.field} ${styles.fieldTight}`}>
            <label className={styles.label} htmlFor="handle">
              Handle
            </label>
            <div className={styles.prefixed}>
              <span className={styles.prefix} aria-hidden="true">
                @
              </span>
              <input
                id="handle"
                className={`${styles.input} ${styles.prefixedInput}`}
                type="text"
                name="handle"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="handle-hint"
                aria-invalid={availability.status === 'unavailable'}
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                required
              />
            </div>
          </div>
          {/* One live region rather than one per state, so a screen reader
              hears the verdict change instead of a region appearing. */}
          <span
            id="handle-hint"
            className={handleHintClass(availability.status)}
            role="status"
            aria-live="polite"
          >
            {handleHint(availability.status, availability.reason, handle)}
          </span>
        </div>

        {/* The hint sits outside the label and is attached with
            aria-describedby: inside it, it would become part of the field's
            accessible name, which screen readers announce as "Password at
            least 8 characters" every time focus lands. */}
        <div className={styles.fieldGroup}>
          {/* Associated rather than wrapping, for the second reason as well as
              the first: the Show button inside the field would otherwise join
              the accessible name too. */}
          <div className={`${styles.field} ${styles.fieldTight}`}>
            <label className={styles.label} htmlFor="register-password">
              Password
            </label>
            <PasswordInput
              id="register-password"
              className={styles.input}
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby="password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
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

/** What goes under the handle field, given where the check has got to. */
function handleHint(status: string, reason: string | null, handle: string): string {
  if (status === 'checking') return 'Checking…';
  if (status === 'available') return `@${handle.trim().toLowerCase()} is free.`;
  if (status === 'unavailable' && reason) return reason;
  return 'Your public profile lives at bookhunt.net/your-handle.';
}

function handleHintClass(status: string): string {
  if (status === 'available') return `${styles.hint} ${styles.hintOk}`;
  if (status === 'unavailable') return `${styles.hint} ${styles.hintBad}`;
  return styles.hint;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    // Unlike sign-in, there is no enumeration to protect here: whoever is
    // filling this in has to be told the address is taken.
    //
    // Both collisions arrive as 409, so the code decides which field is named.
    // A handle can be taken between the live check and the submit, and that
    // race is the whole reason this branch exists.
    if (err.status === 409 && err.code === 'HANDLE_TAKEN') return err.message;
    if (err.status === 409) return 'That email is already registered.';
    // The API writes its 400s to be read by the person filling in the form.
    if (err.status === 400) return err.message;
    if (err.status === 429) return 'Too many attempts. Please try again later.';
  }
  return 'Something went wrong. Please try again.';
}
