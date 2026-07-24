import type { PieSlice } from '../../../shared/components/PieChart/PieChart';
import type { LibraryEntry } from '../../../normalize/library';
import {
  ALL_LIBRARY_STATUSES,
  LIBRARY_STATUS_COLORS,
  LIBRARY_STATUS_LABELS,
} from '../../../shared/types/library-status';
import type { LibraryStatus } from '../../../shared/types/library-status';

// How many subject/author slices to show before collapsing the tail into "Other".
export const TOP_SLICE_COUNT = 7;
// Sentinel label for the collapsed tail; this slice is not a filterable value.
export const OTHER_SLICE_LABEL = 'Other';

export interface LibraryFilter {
  status: LibraryStatus | null;
  subject: string | null;
  author: string | null;
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

// Only statuses with at least one book become slices (AC8: a single populated
// status renders one full-circle slice).
export function statusSlices(entries: LibraryEntry[]): PieSlice[] {
  const counts = statusCounts(entries);
  return ALL_LIBRARY_STATUSES.filter((status) => counts[status] > 0).map((status) => ({
    label: LIBRARY_STATUS_LABELS[status],
    value: counts[status],
    color: LIBRARY_STATUS_COLORS[status],
  }));
}

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

// Sort a tally descending and collapse everything past TOP_SLICE_COUNT into a
// single "Other" slice so the chart stays readable with a long tail.
function toSlices(counts: Map<string, number>): PieSlice[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, TOP_SLICE_COUNT);
  const rest = sorted.slice(TOP_SLICE_COUNT);
  const slices: PieSlice[] = top.map(([label, value]) => ({ label, value }));
  if (rest.length > 0) {
    slices.push({
      label: OTHER_SLICE_LABEL,
      value: rest.reduce((sum, [, value]) => sum + value, 0),
    });
  }
  return slices;
}

export function subjectSlices(entries: LibraryEntry[]): PieSlice[] {
  return toSlices(tally(entries.flatMap((entry) => entry.subjects)));
}

export function authorSlices(entries: LibraryEntry[]): PieSlice[] {
  return toSlices(tally(entries.map((entry) => entry.book.authorName)));
}

export function filterEntries(entries: LibraryEntry[], filter: LibraryFilter): LibraryEntry[] {
  return entries.filter((entry) => {
    if (filter.status && entry.status !== filter.status) return false;
    if (filter.subject && !entry.subjects.includes(filter.subject)) return false;
    if (filter.author && entry.book.authorName !== filter.author) return false;
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
