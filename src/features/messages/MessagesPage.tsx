import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, isAbortError } from '../../api/client';
import {
  getConversation,
  getConversations,
  markConversationRead,
  postMessage,
} from '../../api/messages/messages';
import type { ConversationSummary, Message } from '../../api/messages/messages';
import styles from './MessagesPage.module.css';

/** The list of threads, and the thread itself when a handle is in the URL. */
export function MessagesPage() {
  const { handle } = useParams();

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Messages</h1>
      {handle ? <Thread handle={handle} /> : <ConversationList />}
    </div>
  );
}

function ConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getConversations(controller.signal)
      .then((response) => setConversations(response.conversations))
      .catch((err) => {
        if (isAbortError(err)) return;
        setConversations([]);
      });
    return () => controller.abort();
  }, []);

  if (conversations === null) return <p className={styles.message}>Loading…</p>;

  if (conversations.length === 0) {
    return (
      <p className={styles.message}>
        No messages yet. You can write to any reader who has favourited you back — find them
        by typing <span className={styles.mono}>@</span> in the search box.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {conversations.map((conversation) => (
        <li key={conversation.handle}>
          <Link to={`/messages/${conversation.handle}`} className={styles.row}>
            <span className={styles.rowName}>
              {conversation.displayName}
              <span className={styles.rowHandle}>@{conversation.handle}</span>
            </span>
            <span className={styles.preview}>
              {conversation.lastMessage.fromMe && <span className={styles.you}>You: </span>}
              {conversation.lastMessage.body}
            </span>
            {conversation.unreadCount > 0 && (
              <span className={styles.badge} aria-label={`${conversation.unreadCount} unread`}>
                {conversation.unreadCount}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thread({ handle }: { handle: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getConversation(handle, controller.signal)
      .then((response) => {
        setMessages(response.messages);
        // Opening the thread is what marks it read. Fired and not awaited: the
        // messages are already on screen, and a failure costs a badge that the
        // next poll corrects.
        markConversationRead(handle).catch(() => {});
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setMessages([]);
      });
    return () => controller.abort();
  }, [handle]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim().length === 0) return;

    setError(null);
    setPending(true);
    try {
      const { message } = await postMessage(handle, draft);
      setMessages((current) => [...(current ?? []), message]);
      // Cleared only on success: a refused message stays in the box so the
      // reader can edit it rather than retype it.
      setDraft('');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className={styles.back}>
        <Link to="/messages">← All messages</Link>
        {' · '}
        <Link to={`/${handle}`}>@{handle}</Link>
      </p>

      {messages === null ? (
        <p className={styles.message}>Loading…</p>
      ) : (
        <ol className={styles.thread}>
          {messages.map((message) => (
            <li
              key={message.id}
              className={message.fromMe ? `${styles.bubble} ${styles.mine}` : styles.bubble}
            >
              {message.body}
            </li>
          ))}
        </ol>
      )}

      <form className={styles.composer} onSubmit={submit}>
        <label className={styles.srOnly} htmlFor="message-body">
          Message
        </label>
        <textarea
          id="message-body"
          className={styles.textarea}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Write to @${handle}…`}
        />
        {/* Inline, not a toast: the reader has to act on this, and a toast that
            disappears after eight seconds takes the reason with it. */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.send} disabled={pending}>
          {pending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    // Two codes, two different things to do about them.
    if (err.code === 'NOT_MUTUAL_FAVORITE') return err.message;
    if (err.code === 'MESSAGE_REJECTED') return err.message;
    if (err.status === 400) return err.message;
    if (err.status === 429) return 'Too many messages just now. Please wait a moment.';
  }
  return 'Could not send that message. Please try again.';
}
