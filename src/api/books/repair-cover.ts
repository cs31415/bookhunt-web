import { apiFetch } from '../client';

export interface RepairCoverResponse {
  outcome: 'repaired' | 'alive' | 'no_replacement';
  coverUrl: string | null;
}

/**
 * How many repairs run at once. A library grid can show sixty covers, and a
 * provider outage fails all of them together — unbounded, that is sixty
 * simultaneous requests, each of which waits on the server's own reachability
 * check. Matches the caution the import path takes for its adds.
 */
const CONCURRENCY = 4;

/**
 * One entry per slug, for as long as the tab lives.
 *
 * A cover is repaired once and for everyone, so a second ask can only spend a
 * provider call to learn what the first already knows. Kept in the module
 * rather than in the component because the same book appears on the shelf, in
 * search results and on its own page, and each of those mounts a fresh Cover.
 */
const attempted = new Map<string, Promise<RepairCoverResponse | null>>();

let running = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (running < CONCURRENCY) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
}

function release(): void {
  running--;
  waiting.shift()?.();
}

/**
 * Asks the API to replace a cover that would not load (LOS-272).
 *
 * Resolves null on any failure. Nothing here is worth surfacing to a reader:
 * the procedural cover is already on screen by the time this runs, so a failed
 * repair is simply the cover they already have.
 */
export function repairCover(slug: string): Promise<RepairCoverResponse | null> {
  const existing = attempted.get(slug);
  if (existing) return existing;

  const attempt = (async () => {
    await acquire();
    try {
      return await apiFetch<RepairCoverResponse>(`/books/${slug}/cover`, {
        method: 'POST',
        // Background work behind an already-rendered page: the global loading
        // indicator appearing for it would read as the page reloading.
        silent: true,
      });
    } catch {
      return null;
    } finally {
      release();
    }
  })();

  attempted.set(slug, attempt);
  return attempt;
}

/** Test seam: the module-level memory is what makes a second ask free. */
export function resetRepairedCovers(): void {
  attempted.clear();
}
