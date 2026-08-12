import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Closes an open popup on Escape or on a pointer press outside it.
 *
 * Shared by the account menu and the mobile nav menu, which sit next to each
 * other in the top bar: two popups with two copies of this would be two chances
 * for one of them to stay open when the other opens.
 *
 * The callback is held in a ref so an inline arrow at the call site does not
 * detach and reattach the listeners on every render.
 */
export function useDismissOnOutside(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  const onDismissRef = useRef(onDismiss);

  // In an effect, not during render: writing a ref while rendering is unsafe
  // under concurrent rendering, where a render can be thrown away.
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onDismissRef.current();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismissRef.current();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, containerRef]);
}
