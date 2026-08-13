import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { postForgotPassword } from '../../api/auth/forgot-password';
import styles from './RegisterPage.module.css';

/**
 * Where a reader who has lost their password starts (LOS-240).
 *
 * The confirmation is deliberately the same whether or not the address has an
 * account: the API answers { ok: true } either way so this form cannot be used
 * to find out who has signed up, and saying "no account with that address" here
 * would give away exactly what the API withholds.
 *
 * The cost is that a typo looks identical to success, which is why the address
 * is read back and the screen offers a way to try another one.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      await postForgotPassword({ email });
      setSentTo(email);
    } catch {
      // Only a transport or 500 failure reaches here — an unknown address is a
      // 200 by design, so this really does mean something went wrong.
      setError('Could not send the email just now. Please try again shortly.');
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <div className={styles.page}>
        <div className={styles.card} aria-labelledby="forgot-sent-heading">
          <h1 id="forgot-sent-heading" className={styles.heading}>
            Check your email
          </h1>
          <p className={styles.subheading}>
            If <strong className={styles.address}>{sentTo}</strong> has an account, a link to set a
            new password is on its way.
          </p>
          <p className={styles.note}>
            The link is good for one hour. If it has not arrived in a minute or two, check your
            spam folder.
          </p>
          <p className={styles.altAction}>
            Mistyped it?{' '}
            <button type="button" className={styles.secondary} onClick={() => setSentTo(null)}>
              Try another address
            </button>
          </p>
          <p className={styles.altAction}>
            Remembered it? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} aria-labelledby="forgot-heading">
        <h1 id="forgot-heading" className={styles.heading}>
          Reset your password
        </h1>
        <p className={styles.subheading}>
          Enter the address you signed up with and we will send you a link to set a new password.
        </p>

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

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send the link'}
        </button>

        <p className={styles.altAction}>
          Remembered it? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
