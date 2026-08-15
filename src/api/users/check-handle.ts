import { apiFetch } from '../client';

// Matches GET /users/handle-available (LOS-248). `reason` is null when the
// handle can be claimed and otherwise says why not -- malformed, reserved or
// taken are all answered here, which is why the form does not carry its own
// copy of those rules.
export interface HandleCheck {
  /** The normalized form: what would actually be stored. */
  handle: string;
  available: boolean;
  reason: string | null;
}

export function getHandleAvailability(
  handle: string,
  signal?: AbortSignal,
): Promise<HandleCheck> {
  // Silent: a check that fires while the reader types should not flash the
  // global loading bar on every keystroke.
  return apiFetch(`/users/handle-available?handle=${encodeURIComponent(handle)}`, {
    signal,
    silent: true,
  });
}
