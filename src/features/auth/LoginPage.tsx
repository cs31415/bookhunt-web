import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { PasswordInput } from '../../shared/components/PasswordInput/PasswordInput';
import { storeCredential } from './store-credential';
import { useAuth } from './AuthContext';
import { useResendVerification } from './use-resend-verification';
import styles from './LoginPage.module.css';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as LocationState | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when the credentials were right but the address has never been
  // confirmed, which is the one failure the reader can act on from here.
  const [unverified, setUnverified] = useState(false);
  const { status: resendStatus, resend } = useResendVerification(email);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUnverified(false);
    setPending(true);
    try {
      await login(email, password);
      // Same reason as sign-up (LOS-241): this form calls preventDefault and
      // then navigates client-side, so a password manager sees no submit it
      // recognises. This is also where a password changed via reset gets
      // offered, since the reset page never learns the address.
      await storeCredential(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      // On login a 403 has only one meaning — the password was accepted but the
      // address is unconfirmed (LOS-218) — so the status alone is enough and
      // there is no need to read the response's `code`.
      if (err instanceof ApiError && err.status === 403) {
        setUnverified(true);
        setPending(false);
        return;
      }
      // 401 is the expected "bad credentials" case; the backend returns the
      // same message for wrong password and unknown email (no user enumeration).
      const message =
        err instanceof ApiError && err.status === 401
          ? 'Incorrect email or password.'
          : 'Something went wrong. Please try again.';
      setError(message);
      setPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} aria-labelledby="login-heading">
        <h1 id="login-heading" className={styles.heading}>
          Welcome back
        </h1>
        <p className={styles.subheading}>Sign in to access your library.</p>

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

        {/* Associated with htmlFor rather than wrapping, so the Show button
            inside the field stays out of the field's accessible name. */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-password">
            Password
          </label>
          <PasswordInput
            id="login-password"
            className={styles.input}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {unverified && (
          <div className={styles.notice}>
            <p className={styles.error} role="alert">
              Confirm your email address before signing in. Check your inbox for the link we sent
              when you signed up.
            </p>
            {resendStatus === 'sent' ? (
              <p className={styles.noticeNote} role="status">
                A new link is on its way.
              </p>
            ) : (
              <button
                className={styles.linkButton}
                type="button"
                onClick={resend}
                disabled={resendStatus === 'sending'}
              >
                {resendStatus === 'sending' ? 'Sending…' : 'Send it again'}
              </button>
            )}
          </div>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className={styles.altAction}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>

        {/* Named for the reader's experience rather than for the mechanism:
            "confirmation email" is what they are missing, and until now the
            only route to another one was to attempt a sign-in and be refused
            (LOS-297). */}
        <p className={styles.altAction}>
          <Link to="/verify-email">Never got the confirmation email?</Link>
        </p>

        <p className={styles.altAction}>
          New to BookHunt? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
