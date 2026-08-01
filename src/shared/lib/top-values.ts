export interface TopValuesOptions {
  /** How many to keep. */
  limit: number;
  /**
   * Drop values held by fewer than this many items. Defaults to 2, because a
   * filter matching one book is a link to that book, not a filter — and the
   * long tail is most of the data: the catalog's provider subjects run to 1602
   * distinct values, 1352 of them appearing exactly once.
   */
  minCount?: number;
}

/**
 * The most common values in a flat list, most frequent first.
 *
 * Ties break alphabetically so the order is stable between renders rather than
 * following whatever order the entries arrived in.
 */
export function topValues(values: string[], { limit, minCount = 2 }: TopValuesOptions): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}
