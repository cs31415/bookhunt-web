import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ResendVerificationForm } from './ResendVerificationForm';
import styles from './RegisterPage.module.css';

type Phase = 'verifying' | 'failed';

/**
 * Where the link in the sign-up email lands. Verifying returns a session token,
 * so a reader who follows it arrives already signed in and goes straight to
 * Discover — the success state is the redirect, not a screen.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'failed');

  // Verification tokens are single-use, and StrictMode runs effects twice in
  // development. Without this guard the second run spends the token the first
  // one just consumed, and a perfectly good link reports itself as invalid.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    // Deliberately no cancel-on-cleanup flag, which is the usual shape for a
    // fetching effect and is wrong here. StrictMode's teardown would set it
    // between the two runs, and the second run returns early on the ref above,
    // so the one request in flight would resolve into nothing and the page
    // would sit on "Confirming your address" forever. The ref already
    // guarantees this runs once, so there is no stale response to guard against.
    (async () => {
      try {
        await verifyEmail(token);
        navigate('/', { replace: true });
      } catch {
        setPhase('failed');
      }
    })();
  }, [token, verifyEmail, navigate]);

  if (phase === 'verifying') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Confirming your address</h1>
          <p className={styles.subheading} role="status">
            One moment…
          </p>
        </div>
      </div>
    );
  }

  /*
   * Both causes are named, and signing in comes first (LOS-296).
   *
   * A reader reached this after their link had already worked: they opened it
   * twice, and read the second answer as the verdict on the first. The screen
   * then offered only a resend, which for a confirmed address sends nothing at
   * all -- so they asked four times, got nothing four times, and tried to
   * register again. The way out was a sign-in they were never offered plainly.
   */
  return (
    <div className={styles.page}>
      <div className={styles.card} aria-labelledby="verify-failed-heading">
        <h1 id="verify-failed-heading" className={styles.heading}>
          That link has been used
        </h1>
        <p className={styles.subheading} role="alert">
          Confirmation links work once and last 24 hours. If you have already followed this one —
          or your mail app followed it for you — your address is confirmed and you can sign in.
        </p>

        <Link to="/login" className={`${styles.submit} ${styles.submitLink}`}>
          Sign in
        </Link>

        <p className={styles.divider}>Never got that far?</p>

        <ResendVerificationForm />
      </div>
    </div>
  );
}
