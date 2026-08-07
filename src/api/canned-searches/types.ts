export interface CannedSearch {
  id: number;
  query: string;
  category: string | null;
}

export interface CannedSearchRow {
  /** Searches the reader has pinned, in the order they pinned them. */
  pinned: CannedSearch[];
  /** The current row of suggestions, never overlapping `pinned`. */
  suggested: CannedSearch[];
  /**
   * Rows the reader was shown earlier, newest first, excluding the current one.
   * Backs the back and forward arrows. Always empty for a guest, whose history
   * lives in component state and dies with the tab.
   */
  history: CannedSearch[][];
}

/**
 * Mirrors MAX_PINNED_SEARCHES in the API (models/canned-searches/pill-row.ts).
 * The server is the authority and enforces it with a 409; this copy exists only
 * so the UI can refuse the click without a round trip that is certain to fail.
 */
export const MAX_PINNED_SEARCHES = 6;
