import type { LibraryStatus } from '../../shared/types/library-status';
import type { GetSearchParams } from '../../api/search/get-search';

export interface ParsedSearchParams {
  q: string;
  theme: boolean;
  mood: string | null;
  status: LibraryStatus | null;
  subject: string | null;
  inLibraryOnly: boolean;
  sort: string;
  page: number;
}

export function parseSearchParams(searchParams: URLSearchParams): ParsedSearchParams {
  return {
    q: searchParams.get('q') ?? '',
    theme: searchParams.get('theme') === 'true',
    mood: searchParams.get('mood'),
    status: (searchParams.get('status') as LibraryStatus | null) ?? null,
    subject: searchParams.get('subject'),
    inLibraryOnly: searchParams.get('inLibraryOnly') === 'true',
    sort: searchParams.get('sort') ?? 'relevance',
    page: Math.max(1, Number(searchParams.get('page') ?? '1') || 1),
  };
}

export function toFetchParams(parsed: ParsedSearchParams): GetSearchParams {
  return {
    q: parsed.q || undefined,
    subjects: parsed.subject ? [parsed.subject] : undefined,
    moods: parsed.mood ? [parsed.mood] : undefined,
    status: parsed.status ?? undefined,
    inLibraryOnly: parsed.inLibraryOnly || undefined,
    sort: parsed.sort,
    page: parsed.page,
  };
}

/**
 * Builds the next URLSearchParams for a filter/sort/toggle change. Resets `page`
 * to 1 whenever anything other than `page` itself changes, matching the reference
 * prototype's "reset page on any filter change" behavior.
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
  if (!('page' in changes)) next.delete('page');
  return next;
}
