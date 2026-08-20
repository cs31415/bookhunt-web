import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from './AuthContext';
import { ResendVerificationForm } from './ResendVerificationForm';
import styles from './RegisterPage.module.css';

type Phase = 'verifying' | 'confirmed' | 'used' | 'never-arrived';

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

  // No token is not a failed link: it is a reader who never got one, and
  // typing this address is their way to ask again (LOS-297).
  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'never-arrived');

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
      } catch (error) {
        // The API can now tell a link it really sent, presented a second time,
        // from a token it has never seen (LOS-298). Only the first deserves to
        // be told plainly that there is nothing left to do.
        setPhase(
          error instanceof ApiError && error.code === 'ALREADY_VERIFIED' ? 'confirmed' : 'used',
        );
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

  if (phase === 'confirmed') {
    return (
      <div className={styles.page}>
        <div className={styles.card} aria-labelledby="verify-confirmed-heading">
          <h1 id="verify-confirmed-heading" className={styles.heading}>
            Your address is already confirmed
          </h1>
          <p className={styles.subheading} role="status">
            You followed this link before — or your mail app followed it for you. Nothing else is
            needed: sign in and carry on.
          </p>

          <Link to="/login" className={`${styles.submit} ${styles.submitLink}`}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'never-arrived') {
    return (
      <div className={styles.page}>
        <div className={styles.card} aria-labelledby="verify-resend-heading">
          <h1 id="verify-resend-heading" className={styles.heading}>
            Send me a new link
          </h1>
          <p className={styles.subheading}>
            Confirmation mail sometimes lands in spam, and sometimes never arrives at all. Give
            us the address you signed up with and we will send another link.
          </p>

          <ResendVerificationForm />

          <p className={styles.altAction}>
            Already confirmed? <Link to="/login">Sign in</Link>
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
