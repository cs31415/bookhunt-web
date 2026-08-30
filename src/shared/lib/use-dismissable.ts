import { useEffect } from 'react';
import type { RefObject } from 'react';

// `select` is included so per-row candidate dropdowns participate in the trap.
const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * What a layer over the page owes a reader: Escape closes it, Tab stays inside
 * it, focus goes back where it came from, and the page underneath holds still.
 *
 * There is no dialog library here, so this is hand-rolled -- but it is
 * hand-rolled once. Modal and the filter drawer are the same problem, and the
 * only thing that differs between them is what they look like.
 *
 * @param panelRef The element focus is confined to.
 * @param onClose  Called on Escape. The caller decides what closing means.
 * @param active   False leaves the page untouched, for a component that is only
 *                 a layer at some viewport widths.
 */
export function useDismissable(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
): void {
  // Focus moves in on open and back out on close. Captured on the way in
  // because by the time this unwinds, the opener is no longer the active
  // element -- something inside the panel is.
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, [active, panelRef]);

  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onClose, panelRef]);

  // The page behind must not scroll under the layer. Restores whatever was
  // there rather than assuming '', so a second layer opening over a first
  // cannot unlock the page when only one of them has closed.
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
