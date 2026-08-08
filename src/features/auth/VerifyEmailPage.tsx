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

  return (
    <div className={styles.page}>
      <div className={styles.card} aria-labelledby="verify-failed-heading">
        <h1 id="verify-failed-heading" className={styles.heading}>
          This link has expired
        </h1>
        <p className={styles.subheading} role="alert">
          Confirmation links last 24 hours and can only be used once. Enter your address and we
          will send a new one.
        </p>

        <ResendVerificationForm />

        <p className={styles.altAction}>
          Already confirmed? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
