import { useEffect, useState } from 'react';
import { getUnreadCount } from '../../api/messages/messages';
import { isAbortError } from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const POLL_MS = 60_000;

/**
 * How many messages are waiting, for the badge in the header.
 *
 * Polling pauses while the document is hidden. A backgrounded tab left open
 * overnight would otherwise ask several hundred times for an answer nobody is
 * looking at, and the first thing it does on becoming visible again is ask
 * once, so the badge is right the moment the reader returns.
 *
 * Signed out there is nothing to count and no session to count it with.
 */
export function useUnreadCount(): number {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = () => {
      controller?.abort();
      controller = new AbortController();
      getUnreadCount(controller.signal)
        .then((response) => setCount(response.count))
        .catch((err) => {
          // A failed poll is not news. The next one will say the same thing or
          // better, and an error toast every minute would be worse than a
          // stale badge.
          if (!isAbortError(err)) return;
        });
    };

    const start = () => {
      check();
      timer = setInterval(check, POLL_MS);
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      controller?.abort();
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated]);

  return count;
}
