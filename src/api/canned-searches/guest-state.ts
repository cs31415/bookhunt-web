// Where a signed-out reader's Discover pills live: which ones they pinned, and
// which row they are currently looking at. Same shape of concern as
// src/api/auth/token.ts, and for the same reason: one module owns the storage
// keys, so nothing else has to know any of this is in localStorage.
//
// Not cookies: auth is already a Bearer token read from localStorage, so a
// cookie would only add weight to every request for something the server does
// not need unprompted. Not the querystring: pins have to survive a cold visit
// to `/`, which no URL-carried list can do, and it would leak a reader's pins
// into any link they shared.
//
// A signed-in reader keeps both server-side instead — see user_pinned_searches
// and canned_search_draws.

const GUEST_PINS_STORAGE_KEY = 'bookhunt_guest_pinned_searches';
const GUEST_DRAW_STORAGE_KEY = 'bookhunt_guest_current_draw';

/**
 * Every access is guarded: localStorage throws outright in Safari's private
 * mode and when the origin's quota is full. A reader who cannot pin should
 * still get a working Discover page.
 */
function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: number[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Pinning silently becomes session-only. Better than breaking the click.
  }
}

export function getGuestPinnedIds(): number[] {
  return readIds(GUEST_PINS_STORAGE_KEY);
}

export function setGuestPinnedIds(ids: number[]): void {
  writeIds(GUEST_PINS_STORAGE_KEY, ids);
}

/**
 * The row of suggestions a guest is looking at. Sent back on the next load so
 * the pills hold still across a reload, the same way a signed-in reader's row
 * is restored from their last recorded draw.
 */
export function getGuestDrawIds(): number[] {
  return readIds(GUEST_DRAW_STORAGE_KEY);
}

export function setGuestDrawIds(ids: number[]): void {
  writeIds(GUEST_DRAW_STORAGE_KEY, ids);
}

export function clearGuestPinnedIds(): void {
  try {
    localStorage.removeItem(GUEST_PINS_STORAGE_KEY);
  } catch {
    // Nothing useful to do; the ids are ignored once the reader is signed in.
  }
}
