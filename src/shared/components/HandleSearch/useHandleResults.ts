import { useEffect, useState } from 'react';
import { searchUsers } from '../../../api/users/search-users';
import type { UserSummary } from '../../../api/users/search-users';
import { isAbortError } from '../../../api/client';

const DEBOUNCE_MS = 250;

/**
 * Debounced reader lookup for the @ search.
 *
 * Every answer is tagged with the query it answered, so a slow reply for an
 * earlier query cannot render over the results for what is in the box now —
 * the same guard the handle-availability check uses. An AbortController
 * cancels the outgoing request as well, but the tag is what makes correctness
 * independent of whether the abort lands first.
 */
export function useHandleResults(query: string): UserSummary[] {
  const [answer, setAnswer] = useState<{ query: string; users: UserSummary[] } | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchUsers(trimmed, controller.signal)
        .then((response) => setAnswer({ query: trimmed, users: response.users }))
        .catch((err) => {
          if (isAbortError(err)) return;
          setAnswer({ query: trimmed, users: [] });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return answer?.query === query.trim() ? answer.users : [];
}
