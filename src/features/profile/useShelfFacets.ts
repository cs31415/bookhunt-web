import { useEffect, useState } from 'react';
import { getPublicLibraryFacets } from '../../api/users/get-public-library';
import { getLibraryFacetsByToken } from '../../api/users/get-by-token';
import type { ShelfFacets } from '../../api/users/get-public-library';
import { isAbortError } from '../../api/client';
import type { ShelfKind } from './useShelf';

const EMPTY: ShelfFacets = { subject: [], mood: [], theme: [], status: [] };

/**
 * What a visitor's rail can offer, fetched once per shelf.
 *
 * The owner's own profile does not use this: it already holds every entry and
 * derives its facets with breakdowns.ts. A visitor holds one page, so deriving
 * them here would offer whichever values landed on that page -- and they would
 * change under the reader as they paged. That is the whole reason the endpoint
 * exists.
 *
 * Deliberately not keyed on the filters. The values a shelf offers do not
 * narrow as you pick among them: a rail that removed its own options as you
 * used them would be a trap.
 */
export function useShelfFacets(kind: ShelfKind, id: string): ShelfFacets {
  const [facets, setFacets] = useState<ShelfFacets>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();

    const request =
      kind === 'handle'
        ? getPublicLibraryFacets(id, controller.signal)
        : getLibraryFacetsByToken(id, controller.signal);

    request.then(setFacets).catch((error) => {
      if (isAbortError(error)) return;
      // A rail with nothing in it renders nothing, which is the right failure:
      // the shelf itself is unaffected, and FilterGroup already drops an empty
      // group rather than showing a heading over nothing.
      setFacets(EMPTY);
    });

    return () => controller.abort();
  }, [kind, id]);

  return facets;
}
