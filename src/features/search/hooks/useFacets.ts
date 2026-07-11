import { useEffect, useState } from 'react';
import { getFacets } from '../../../api/search/get-facets';

export interface UseFacetsResult {
  subjects: string[];
  moods: string[];
}

export function useFacets(): UseFacetsResult {
  const [facets, setFacets] = useState<UseFacetsResult>({ subjects: [], moods: [] });

  useEffect(() => {
    let cancelled = false;
    getFacets()
      .then((data) => {
        if (!cancelled) setFacets(data);
      })
      .catch(() => {
        // Filter pills degrade to empty groups; the rest of the page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return facets;
}
