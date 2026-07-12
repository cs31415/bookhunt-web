import type { LibraryStatus } from '../../shared/types/library-status';

export interface ParsedSearchParams {
  q: string;
  theme: boolean;
  mood: string | null;
  subject: string | null;
  status: LibraryStatus | null;
  inLibraryOnly: boolean;
  sort: string;
}

export function parseSearchParams(searchParams: URLSearchParams): ParsedSearchParams {
  return {
    q: searchParams.get('q') ?? '',
    theme: searchParams.get('theme') === 'true',
    mood: searchParams.get('mood'),
    subject: searchParams.get('subject'),
    status: (searchParams.get('status') as LibraryStatus | null) ?? null,
    inLibraryOnly: searchParams.get('inLibraryOnly') === 'true',
    sort: searchParams.get('sort') ?? 'relevance',
  };
}

/**
 * Builds the next URLSearchParams for a filter/sort/toggle change. Status,
 * sort, and inLibraryOnly are applied client-side over the already-fetched
 * /ai/search batch, so changing them doesn't need to reset anything else.
 */
export function withParamChange(
  current: URLSearchParams,
  changes: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}
