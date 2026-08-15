import { useCallback, useEffect, useRef, useState } from 'react';
import { getHandleAvailability } from '../../api/users/check-handle';
import type { HandleCheck } from '../../api/users/check-handle';
import { isAbortError } from '../../api/client';

/** Below this there is nothing worth asking about, and the API would refuse anyway. */
const MIN_LENGTH_TO_CHECK = 3;
const DEBOUNCE_MS = 350;

export type HandleStatus = 'idle' | 'checking' | 'available' | 'unavailable';

export interface HandleAvailability {
  status: HandleStatus;
  /** Why the handle cannot be used, or null. */
  reason: string | null;
}

/**
 * Answers "can I have this handle?" while the reader types.
 *
 * There is no client-side copy of the handle rules on purpose. The endpoint
 * already returns a reason for every rejection -- malformed, reserved and taken
 * alike -- so a second copy of the format rules and the reserved-word list here
 * would be duplicated logic whose only reward is saving one round trip, and
 * whose failure mode is telling the reader something the server disagrees with.
 * The one thing checked locally is length, because a one-character handle is
 * not a question worth asking.
 */
export function useHandleAvailability(handle: string): HandleAvailability {
  const [result, setResult] = useState<{ handle: string; check: HandleCheck } | null>(null);
  const [checking, setChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (value: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setChecking(true);
    try {
      const check = await getHandleAvailability(value, controller.signal);
      // Tagged with the value it answered, so a slow reply for an earlier
      // handle cannot render over the answer for what is in the box now.
      setResult({ handle: value, check });
      setChecking(false);
    } catch (error) {
      if (isAbortError(error)) return;
      // A failed check is not a verdict. Saying "unavailable" because the
      // network hiccuped would block a handle the reader can actually have;
      // the server re-checks on submit regardless.
      setResult(null);
      setChecking(false);
    }
  }, []);

  const trimmed = handle.trim();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Nothing is cleared here, and nothing needs to be: a result only counts
    // when it was asked about the handle currently in the box, and the reads
    // below check that. Resetting state from inside the effect would be an
    // extra render saying what the derivation already says.
    if (trimmed.length < MIN_LENGTH_TO_CHECK) {
      abortRef.current?.abort();
      return;
    }

    timeoutRef.current = setTimeout(() => run(trimmed), DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [trimmed, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (trimmed.length < MIN_LENGTH_TO_CHECK) return { status: 'idle', reason: null };

  // The answer only counts for the handle it was asked about. While the reader
  // types past a checked value this reads as "checking" rather than showing a
  // verdict about text that is no longer there.
  const answered = result && result.handle === trimmed ? result.check : null;
  if (!answered) return { status: checking ? 'checking' : 'idle', reason: null };

  return answered.available
    ? { status: 'available', reason: null }
    : { status: 'unavailable', reason: answered.reason };
}
