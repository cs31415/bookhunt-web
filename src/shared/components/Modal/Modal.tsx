import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useDismissable } from '../../lib/use-dismissable';
import styles from './Modal.module.css';

export interface ModalProps {
  /** Small label above the title. */
  eyebrow?: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Rendered in a bordered strip below the body; omitted when absent. */
  footer?: ReactNode;
}

/**
 * The app's only modal primitive. There's no dialog library here, so the portal
 * is local and the dismissal rules come from useDismissable, which the filter
 * drawer shares -- the two are the same problem wearing different clothes.
 */
export function Modal({ eyebrow, title, onClose, children, footer }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDismissable(cardRef, onClose);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={cardRef}
        className={`${styles.card} fade-up`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
            <h3 id={titleId} className={styles.title}>
              {title}
            </h3>
          </div>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
