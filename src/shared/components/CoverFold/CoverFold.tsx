import type { LibraryStatus } from '../../types/library-status';
import { LIBRARY_STATUS_LABELS } from '../../types/library-status';
import styles from './CoverFold.module.css';

/**
 * One mark per status, legible at 13px over artwork. Deliberately not emoji:
 * these render in the reader's text colour, and emoji would bring their own.
 */
const GLYPHS: Record<LibraryStatus, string> = {
  queued: '✱',
  reading: '◐',
  finished: '✓',
  abandoned: '–',
};

export interface CoverFoldProps {
  status: LibraryStatus;
}

/**
 * A turned-down corner on a book cover, marking its status.
 *
 * Replaces the pill badge where the badge sits *on* the artwork. A pill needs a
 * filled background to stay readable and so covers the cover; a fold reads as
 * part of the book.
 *
 * The fold itself is paper-coloured, not status-coloured, because that is what
 * the back of a folded page is — and because it is the only way to stay legible
 * over artwork whose colours we cannot know. A cover image comes from the
 * provider's CDN, so reading its pixels would mean drawing it to a canvas, which
 * a cross-origin image taints. Paper over artwork separates whatever the
 * artwork is; the status colour rides on the glyph, where it needs to contrast
 * only with the paper beneath it.
 *
 * BookRow and RelatedCard keep the pill: their badge sits in a text column,
 * where there is no corner to turn down and nothing to stay legible against.
 */
export function CoverFold({ status }: CoverFoldProps) {
  return (
    <span className={`${styles.fold} ${styles[status]}`}>
      <span className={styles.glyph} aria-hidden="true">
        {GLYPHS[status]}
      </span>
      {/* The glyph alone says nothing to a screen reader, and the pill it
          replaced carried the status as text. */}
      <span className={styles.label}>{LIBRARY_STATUS_LABELS[status]}</span>
    </span>
  );
}
