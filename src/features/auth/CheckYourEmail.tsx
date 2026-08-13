import { Link } from 'react-router-dom';
import { useResendVerification } from './use-resend-verification';
import styles from './RegisterPage.module.css';

/**
 * Where sign-up ends. The account exists but cannot be signed into until the
 * address is confirmed (LOS-218), so this is the whole of the reader's next
 * step and it names the address back to them — a typo in it is the one thing
 * that makes the link never arrive.
 */
export function CheckYourEmail({ email }: { email: string }) {
  const { status, resend } = useResendVerification(email);

  return (
    <div className={styles.page}>
      <div className={styles.card} aria-labelledby="check-email-heading">
        <h1 id="check-email-heading" className={styles.heading}>
          Check your email
        </h1>
        <p className={styles.subheading}>
          We have sent a confirmation link to <strong className={styles.address}>{email}</strong>.
          Follow it to finish setting up your account.
        </p>

        {/*
          The spam folder is named before the reader has to go looking. bookhunt.net
          has almost no sending reputation yet, so confirmation mail lands in junk
          often enough that leaving this to the resend flow costs sign-ups from
          people who assume nothing was sent.
        */}
        <p className={styles.note}>
          The link is good for 24 hours. If it has not arrived in a minute or two, check
          your spam folder.
        </p>

        {status === 'sent' ? (
          <p className={styles.note} role="status">
            Sent again. Give it a minute, then check your spam folder.
          </p>
        ) : (
          <button
            className={styles.secondary}
            type="button"
            onClick={resend}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending…' : 'Resend the email'}
          </button>
        )}

        {status === 'error' && (
          <p className={styles.error} role="alert">
            Could not resend just now. Please try again shortly.
          </p>
        )}

        <p className={styles.altAction}>
          Already confirmed? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
