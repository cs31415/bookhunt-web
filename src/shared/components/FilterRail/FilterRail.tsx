import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useDismissable } from '../../lib/use-dismissable';
import styles from './FilterRail.module.css';

/**
 * The width at or below which the rail stops being a rail. It matches the point
 * the two rails already collapsed at, so nothing about the layout changes here
 * -- only what the collapsed state looks like.
 */
export const DRAWER_MAX_WIDTH = 860;

export interface FilterRailProps {
  /** Names the rail for a screen reader, and titles the drawer. */
  label: string;
  /**
   * How many filters are set. Shown on the trigger, because a rail that has
   * folded away must not be able to hide that the shelf is narrowed.
   */
  activeCount?: number;
  children: ReactNode;
}

/**
 * Filters on the left: a column on a wide screen, a pane that slides in from
 * the edge on a narrow one.
 *
 * The two are genuinely different things rather than one thing restyled. A
 * column is scenery -- an <aside> beside the results. A pane is a layer over
 * the page, which owes the reader a way out, a focus trap, and a page that
 * holds still underneath. So the semantics switch with the width, which is why
 * this needs to know the viewport rather than leaving it all to CSS.
 */
export function FilterRail({ label, activeCount = 0, children }: FilterRailProps) {
  const isDrawer = useMediaQuery(`(max-width: ${DRAWER_MAX_WIDTH}px)`);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Widening the window while the pane is open would otherwise strand the open
  // state: the rail returns, and a stale `true` waits to reopen a drawer the
  // next time someone narrows the window again.
  //
  // Adjusted during render rather than in an effect. React re-runs this pass
  // before touching the DOM, so nothing paints twice -- an effect here would
  // cascade a second render, which is what the lint rule is about.
  const [wasDrawer, setWasDrawer] = useState(isDrawer);
  if (wasDrawer !== isDrawer) {
    setWasDrawer(isDrawer);
    setOpen(false);
  }

  // Only a layer while it is a drawer *and* open. As a column it must not trap
  // focus or lock the page.
  useDismissable(panelRef, close, isDrawer && open);

  if (!isDrawer) {
    return (
      <aside className={styles.rail} aria-label={label}>
        {children}
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        Filters
        {activeCount > 0 && (
          <span className={styles.count} aria-label={`${activeCount} active`}>
            {activeCount}
          </span>
        )}
      </button>

      {/*
        Mounted whether open or not, so the pane has something to slide from and
        something to slide back to. Closed, it is visibility: hidden and inert
        to the pointer, which also takes it out of the tab order.
      */}
      {createPortal(
        <div className={styles.backdrop} data-open={open} onClick={close}>
          <div
            ref={panelRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            aria-hidden={!open}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.head}>
              <span className={styles.title}>{label}</span>
              <button
                type="button"
                className={styles.close}
                aria-label="Close filters"
                onClick={close}
              >
                ×
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
