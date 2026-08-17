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
  /** Narrows to favourites. A filter like any other, so it composes with the
   *  rest rather than being a separate view (LOS-252). */
  favorite?: boolean;
  /** Narrows to one format. Its own axis, like favourite (LOS-271). */
  format?: LibraryFormat | null;
}

/** The values ?format= accepts. Anything else is read as no filter. */
export type LibraryFormat = 'ebook' | 'audiobook' | 'physical';

const FORMATS: LibraryFormat[] = ['ebook', 'audiobook', 'physical'];

export function asFormat(value: string | null): LibraryFormat | null {
  return FORMATS.includes(value as LibraryFormat) ? (value as LibraryFormat) : null;
}

/**
 * Whether one entry counts as a given format.
 *
 * The two flags are independent, so a book can be both an ebook and an
 * audiobook and is counted under each. Physical is the absence of both, which
 * is what makes a shelf that predates the flags read as physical.
 */
export function isFormat(entry: LibraryEntry, format: LibraryFormat): boolean {
  if (format === 'ebook') return entry.isEbook;
  if (format === 'audiobook') return entry.isAudiobook;
  return !entry.isEbook && !entry.isAudiobook;
}

/**
 * Every format's count, so the rail can label each pill and decide which are
 * worth showing. These can sum to more than the shelf: a book owned in two
 * formats is in two of them.
 */
export function formatCounts(entries: LibraryEntry[]): Record<LibraryFormat, number> {
  return {
    ebook: entries.filter((entry) => isFormat(entry, 'ebook')).length,
    audiobook: entries.filter((entry) => isFormat(entry, 'audiobook')).length,
    physical: entries.filter((entry) => isFormat(entry, 'physical')).length,
  };
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
    if (filter.favorite && !entry.isFavorite) return false;
    if (filter.format && !isFormat(entry, filter.format)) return false;
    if (filter.status && entry.status !== filter.status) return false;
    if (filter.category && !entry.subjects.includes(filter.category)) return false;
    if (filter.mood && !entry.moods.includes(filter.mood)) return false;
    if (filter.theme && !entry.themes.includes(filter.theme)) return false;
    if (terms.length > 0 && !matchesQuery(entry, terms)) return false;
    return true;
  });
}

/**
 * The order the shelves read in, which is not the order they are declared in.
 * What someone is reading right now leads, then what is waiting to be read;
 * the two settled states come last, since neither asks anything of the reader.
 *
 * A Record rather than an array so a fifth status could not be added without
 * being given a place here — an unranked one would otherwise sort silently to
 * the front. ALL_LIBRARY_STATUSES stays the display order for filters and
 * charts, where starting at New is the natural reading.
 */
const SHELF_ORDER: Record<LibraryStatus, number> = {
  reading: 0,
  queued: 1,
  finished: 2,
  abandoned: 3,
};

// Newest first. Entries without a date_added fall back to book id (a monotonic
// proxy for insertion order) and sort after any dated entries.
function byAddedDesc(a: LibraryEntry, b: LibraryEntry): number {
  const ta = a.addedAt ? Date.parse(a.addedAt) : NaN;
  const tb = b.addedAt ? Date.parse(b.addedAt) : NaN;
  const aValid = !Number.isNaN(ta);
  const bValid = !Number.isNaN(tb);
  if (aValid && bValid && ta !== tb) return tb - ta;
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;
  return b.book.id - a.book.id;
}

/**
 * Shelf first, then newest added within each — so the grid opens on what is
 * being read rather than on whatever happened to be added last, and a book
 * keeps its familiar place inside its own group.
 */
export function sortByShelf(entries: LibraryEntry[]): LibraryEntry[] {
  return [...entries].sort((a, b) => {
    const shelf = SHELF_ORDER[a.status] - SHELF_ORDER[b.status];
    return shelf !== 0 ? shelf : byAddedDesc(a, b);
  });
}
