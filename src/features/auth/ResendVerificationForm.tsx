import { useState } from 'react';
import type { FormEvent } from 'react';
import { useResendVerification } from './use-resend-verification';
import styles from './RegisterPage.module.css';

/**
 * Asks for the address before resending. Used where we do not already know it:
 * an expired link carries no identity, and the reader may well have opened it
 * on a different device from the one they signed up on.
 *
 * The form stays on screen after sending (LOS-296). It used to be replaced by
 * the confirmation, which left a reader who had mistyped their address, or who
 * will never receive anything because they are already confirmed, with nothing
 * to press.
 */
export function ResendVerificationForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const { status, resend } = useResendVerification(email);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resend();
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

      {/*
        Carefully not a promise of delivery. The endpoint answers the same for
        an unknown address, an unconfirmed one and one already confirmed -- so
        that it cannot be used to find out which addresses have accounts -- and
        the last of those three never produces an email.
      */}
      {status === 'sent' && (
        <p className={styles.note} role="status">
          Sent, if that address still needs confirming. Nothing arrives for an address that is
          already confirmed — sign in instead.
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Resend confirmation email'}
      </button>
    </form>
  );
}
