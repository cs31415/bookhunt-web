import type { CannedSearch } from '../../api/canned-searches/types';

/**
 * What the pills fall back to when GET /canned-searches cannot be reached.
 *
 * The real catalog is ~500 rows in the database (LOS-212); these are the five
 * that were hardcoded here before it existed. They keep a logged-out Discover
 * page — where the pills are the only content — from rendering as a bare search
 * box when the API is down.
 *
 * The ids are placeholders. Nothing pins these: `degraded` in useCannedSearches
 * turns the pin controls off, because there is no catalog row behind them.
 */
export const FALLBACK_QUERIES: CannedSearch[] = [
  { id: 0, query: 'books for an intelligent layman on evolution', category: null },
  { id: 0, query: 'bleak but beautiful literary fiction', category: null },
  { id: 0, query: 'mind-expanding science I can finish in a weekend', category: null },
  { id: 0, query: 'where should I start with Dostoevsky', category: null },
  { id: 0, query: 'history that reads like a thriller', category: null },
];
