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
  const wrapRef = useRef<HTMLDivElement>(null);
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
   * Only when they have actually scrolled past the top of the panel. If it is
   * still on screen, nothing above them moves and scrolling would itself be
   * the jarring act.
   */
  function toggle() {
    if (!expanded) {
      setExpanded(true);
      return;
    }

    setExpanded(false);
    const el = wrapRef.current;
    if (!el || typeof el.scrollIntoView !== 'function') return;
    if (el.getBoundingClientRect().top >= 0) return;

    el.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }

  const capped = overflows && !expanded;

  return (
    <div ref={wrapRef} className={className ? `${styles.wrap} ${className}` : styles.wrap}>
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
