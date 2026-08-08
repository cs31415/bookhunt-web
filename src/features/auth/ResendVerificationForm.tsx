import { useState } from 'react';
import type { FormEvent } from 'react';
import { useResendVerification } from './use-resend-verification';
import styles from './RegisterPage.module.css';

/**
 * Asks for the address before resending. Used where we do not already know it:
 * an expired link carries no identity, and the reader may well have opened it
 * on a different device from the one they signed up on.
 */
export function ResendVerificationForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const { status, resend } = useResendVerification(email);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resend();
  }

  if (status === 'sent') {
    return (
      <p className={styles.note} role="status">
        If that address needs confirming, a new link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
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

      {status === 'error' && (
        <p className={styles.error} role="alert">
          Could not send just now. Please try again shortly.
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send a new link'}
      </button>
    </form>
  );
}
