import { useEffect } from 'react';

/**
 * Keeps the page out of search results for as long as it is on screen.
 *
 * Added on mount and removed on unmount rather than written into index.html:
 * this is one route of a single-page app, and a tag left behind would go on
 * telling crawlers not to index whatever the reader navigated to next.
 *
 * The API sends `X-Robots-Tag` on the same data, so a crawler that never runs
 * the script is covered too. This is the half that works once it does.
 */
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => meta.remove();
  }, []);
}
