import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Collapsible.module.css';

export interface CollapsibleProps {
  children: ReactNode;
  /** The capped height in pixels. About eight lines of body serif at 180. */
  collapsedHeight?: number;
  /** Names what is being expanded, for a screen reader: "More description". */
  label?: string;
  /**
   * On the wrapper, not the text. The block's own bottom margin would sit
   * inside the capped box -- clipped while collapsed, present once expanded --
   * so a caller moves that spacing out here.
   */
  className?: string;
}

/**
 * Caps a block of prose, with a More… control for the rest of it.
 *
 * Upstream copy arrives at whatever length it was written: a Google Books
 * description can run many paragraphs and push everything below it off the
 * screen (LOS-292). This holds such a block to a fixed height and hands the
 * reader the choice.
 *
 * The control appears only when the text really is taller than the cap, so a
 * two-line blurb looks exactly as it did before — no button under it promising
 * more that does not exist. That is measured rather than guessed, because the
 * height depends on the column, the font and the wrapping.
 */
export function Collapsible({
  children,
  collapsedHeight = 180,
  label,
  className,
}: CollapsibleProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (el) setOverflows(el.scrollHeight > collapsedHeight);
  }, [collapsedHeight]);

  useEffect(() => {
    measure();

    // Re-decides when the column narrows or a late font changes the wrapping,
    // either of which can turn a fitting paragraph into an overflowing one.
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  /**
   * Collapsing takes away the text the reader is standing on, so without this
   * they land wherever that scroll position now falls -- somewhere in the
   * middle of the page, looking at something else (LOS-293).
   *
   * Back to the top of the page rather than to the panel (LOS-294): both pages
   * that use this open at the top, so collapsing leaves the reader where a
   * reload would, with the cover and title above the text again.
   *
   * Instant, in the two-argument form the pages' own load-time scroll uses. A
   * smooth scroll is silently a no-op wherever the browser or the machine has
   * animation turned down, and the reader is then left mid-page with nothing
   * having moved -- which is the bug this exists to prevent.
   */
  function toggle() {
    if (!expanded) {
      setExpanded(true);
      return;
    }

    setExpanded(false);
    if (window.scrollY === 0) return;
    window.scrollTo(0, 0);
  }

  const capped = overflows && !expanded;

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <div
        id={id}
        ref={contentRef}
        className={capped ? `${styles.content} ${styles.capped}` : styles.content}
        style={capped ? { maxHeight: collapsedHeight } : undefined}
      >
        {children}
      </div>

      {overflows && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={toggle}
        >
          {expanded ? 'Less' : 'More…'}
          {label && <span className={styles.srOnly}> {label}</span>}
        </button>
      )}
    </div>
  );
}
