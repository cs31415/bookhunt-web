import type { LibraryEntry } from '../../../normalize/library';
import { topValues } from '../../../shared/lib/top-values';
import type { LibraryStatus } from '../../../shared/types/library-status';

/**
 * How many pills a facet offers before it stops. Enough to describe a shelf
 * without becoming a wall of them — the top 12 categories already cover 282 of
 * a 331-book library.
 */
const MAX_PILLS = 12;

export interface LibraryFilter {
  status: LibraryStatus | null;
  category: string | null;
  mood?: string | null;
  theme?: string | null;
  /** Free text over title, author, categories, moods and themes. Filtered
   *  client-side — the whole library is already in memory, so a round trip
   *  would only be slower. */
  q?: string | null;
}

export function statusCounts(entries: LibraryEntry[]): Record<LibraryStatus, number> {
  const counts: Record<LibraryStatus, number> = {
    queued: 0,
    reading: 0,
    finished: 0,
    abandoned: 0,
  };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}

/**
 * Categories come from `subjects`, which holds the provider's tags and the
 * generated ones together. No flag distinguishes them and none is needed: the
 * count threshold in topValues does it, since a granular provider heading
 * ("Mississippi River -- Fiction") lands on one book while a generated category
 * is chosen to be broad and lands on many.
 */
export function topCategories(entries: LibraryEntry[], limit = MAX_PILLS): string[] {
  return topValues(entries.flatMap((entry) => entry.subjects), { limit });
}

export function topMoods(entries: LibraryEntry[], limit = MAX_PILLS): string[] {
  return topValues(entries.flatMap((entry) => entry.moods), { limit });
}

export function topThemes(entries: LibraryEntry[], limit = MAX_PILLS): string[] {
  return topValues(entries.flatMap((entry) => entry.themes), { limit });
}

// Every term has to appear somewhere, so each word typed narrows the list --
// "sagan cosmos" means both, which is what a filter box is expected to do.
function matchesQuery(entry: LibraryEntry, terms: string[]): boolean {
  const haystack = [
    entry.book.title,
    entry.book.authorName,
    ...entry.subjects,
    ...entry.moods,
    ...entry.themes,
  ]
    .join(' ')
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function queryTerms(q: string | null | undefined): string[] {
  return q ? q.toLowerCase().split(/\s+/).filter(Boolean) : [];
}

export function filterEntries(entries: LibraryEntry[], filter: LibraryFilter): LibraryEntry[] {
  const terms = queryTerms(filter.q);
  return entries.filter((entry) => {
    if (filter.status && entry.status !== filter.status) return false;
    if (filter.category && !entry.subjects.includes(filter.category)) return false;
    if (filter.mood && !entry.moods.includes(filter.mood)) return false;
    if (filter.theme && !entry.themes.includes(filter.theme)) return false;
    if (terms.length > 0 && !matchesQuery(entry, terms)) return false;
    return true;
  });
}

// Newest first. Entries without a date_added fall back to book id (a monotonic
// proxy for insertion order) and sort after any dated entries.
export function sortByAddedDesc(entries: LibraryEntry[]): LibraryEntry[] {
  return [...entries].sort((a, b) => {
    const ta = a.addedAt ? Date.parse(a.addedAt) : NaN;
    const tb = b.addedAt ? Date.parse(b.addedAt) : NaN;
    const aValid = !Number.isNaN(ta);
    const bValid = !Number.isNaN(tb);
    if (aValid && bValid && ta !== tb) return tb - ta;
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    return b.book.id - a.book.id;
  });
}
