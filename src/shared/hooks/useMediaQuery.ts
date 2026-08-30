import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query currently matches, kept in step as the viewport
 * changes.
 *
 * Layout belongs in CSS, and nearly all of it stays there. This is for the
 * cases where the *semantics* differ rather than the paint: the filter rail is
 * an <aside> on a wide screen and a modal dialog on a narrow one, and a focus
 * trap cannot be expressed in a stylesheet.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // Guarded for a browser, or a test environment, without matchMedia.
      const list = window.matchMedia?.(query);
      if (!list) return () => {};
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia?.(query).matches ?? false, [query]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
