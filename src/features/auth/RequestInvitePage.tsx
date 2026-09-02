import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { postRequestInvite } from '../../api/auth/request-invite';
import styles from './RegisterPage.module.css';

const MAX_NOTE_LENGTH = 500;

/**
 * Where someone without an invite code asks for one (LOS-381).
 *
 * Nothing is sent from here. The request is written down and read later by a
 * person, who mints a code by hand. A form that mailed an invite straight back
 * would rebuild the vector LOS-376 closed -- an unauthenticated endpoint that
 * makes the server send mail to any address given -- except the message would
 * carry a working credential.
 *
 * The confirmation is the same whatever happened, like the forgotten-password
 * page above it: the API answers 202 for a well-formed address whether or not
 * it already has an account, and saying anything different here would give away
 * exactly what the API withholds.
 *
 * The cost, as there, is that a typo looks like success -- so the address is
 * read back and there is a way to try another.
 */
export function RequestInvitePage() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  /** The honeypot. Never shown, never filled in by a person. */
  const [website, setWebsite] = useState('');
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      await postRequestInvite({ email, note: note.trim() || undefined, website });
      setSentFor(email);
    } catch {
      // A malformed address is a 400 and a bot is a silent 202, so anything
      // reaching here is a transport failure and worth retrying.
      setError('Could not send that just now. Please try again shortly.');
    } finally {
      setSending(false);
    }
  }

  if (sentFor) {
    return (
      <div className={styles.page}>
        <div className={styles.card} aria-labelledby="invite-sent-heading">
          <h1 id="invite-sent-heading" className={styles.heading}>
            Request received
          </h1>
          <p className={styles.subheading}>
            Noted for <strong className={styles.address}>{sentFor}</strong>. If an invite comes,
            it will arrive by email.
          </p>
          {/* Said plainly. An invitation nobody promised, arriving on no
              schedule, is better than a wait the page invented. */}
          <p className={styles.note}>
            Invites go out by hand, so this is not instant and it is not
            guaranteed.
          </p>
          <p className={styles.altAction}>
            Mistyped it?{' '}
            <button type="button" className={styles.secondary} onClick={() => setSentFor(null)}>
              Try another address
            </button>
          </p>
          <p className={styles.altAction}>
            Have a code already? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} aria-labelledby="invite-heading">
        <h1 id="invite-heading" className={styles.heading}>
          Request an invite
        </h1>
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

        {/* The label carries what a hint used to, so there is no hint and
            nothing for aria-describedby to point at (LOS-383). Wrapping, like
            the Email field: with no hint outside it there is nothing to pull
            into the accessible name. */}
        <label className={styles.field}>
          <span className={styles.label}>
            Where you heard about us and anything else you&rsquo;d like to add.
          </span>
          <textarea
            className={styles.input}
            name="note"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {/*
          The honeypot. Hidden from people, and from screen readers by
          aria-hidden and tabIndex -1, so nobody who cannot see it is asked to
          fill it in. autoComplete off, or a browser helpfully fills it and
          turns a real person into a bot.
        */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Request an invite'}
        </button>

        <p className={styles.altAction}>
          Have a code already? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
