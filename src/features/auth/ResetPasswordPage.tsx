import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { postResetPassword } from '../../api/auth/reset-password';
import styles from './RegisterPage.module.css';

// Mirrors validatePassword on the API, like RegisterPage does. The backend
// re-checks, so the worst a drift can do is show the browser's message where
// the server would have shown its own.
const MIN_PASSWORD_LENGTH = 8;

/**
 * Where the link in the reset email lands (LOS-240).
 *
 * Unlike verification, a successful reset does not sign the reader in — the API
 * returns { ok } and no token — so this ends at the login page rather than at
 * Discover.
 *
 * No effect fires on mount: the token is only spent when the form is submitted,
 * so there is nothing here that StrictMode's double-invoked effects could
 * consume, which is the trap VerifyEmailPage has to guard against.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await postResetPassword({ token, password });
      // No storeCredential here, deliberately: the reset link carries only a
      // token, so this page never learns the address, and a PasswordCredential
      // needs one. The sign-in immediately after this redirect is where the
      // password manager gets offered the new password (LOS-241).
      navigate('/login', { replace: true });
    } catch (err) {
      // The API answers 400 for a token that is invalid, already spent or
      // expired, and for a password that fails its own rules. Its message says
      // which, and is written to be read.
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : 'Could not reset your password just now. Please try again shortly.',
      );
      setPending(false);
    }
  }

  // A link with no token at all is a mangled paste rather than an expired link,
  // and telling someone to request a new one would send them round a loop that
  // cannot end. Say what actually happened.
  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card} aria-labelledby="reset-no-token-heading">
          <h1 id="reset-no-token-heading" className={styles.heading}>
            This link is incomplete
          </h1>
          <p className={styles.subheading} role="alert">
            The address is missing its reset code. Copy the whole link from the email, or ask for a
            new one.
          </p>
          <p className={styles.altAction}>
            <Link to="/forgot-password">Send another link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} aria-labelledby="reset-heading">
        <h1 id="reset-heading" className={styles.heading}>
          Set a new password
        </h1>
        <p className={styles.subheading}>Choose a password you have not used here before.</p>

        <div className={styles.fieldGroup}>
          <label className={`${styles.field} ${styles.fieldTight}`}>
            <span className={styles.label}>New password</span>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby="reset-password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <span id="reset-password-hint" className={styles.hint}>
            At least {MIN_PASSWORD_LENGTH} characters.
          </span>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save and sign in'}
        </button>

        <p className={styles.altAction}>
          Link expired? <Link to="/forgot-password">Send another</Link>
        </p>
      </form>
    </div>
  );
}
