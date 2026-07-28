import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DetectedBookRow } from './DetectedBookRow';
import type { UseScanSessionResult } from '../../hooks/useScanSession';
import styles from './ScanModal.module.css';

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ScanModalProps {
  session: UseScanSessionResult;
  onClose: () => void;
}

/**
 * First modal in the app — there's no dialog primitive or modal library to
 * build on, so portal, dismissal, and focus handling are all local. The
 * dismissal effect mirrors ActionMenu's.
 */
export function ScanModal({ session, onClose }: ScanModalProps) {
  const { phase, previews, rows, error } = session;
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Return focus to whatever opened the modal.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;

      const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
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
  }, [onClose]);

  function pick(list: FileList | null) {
    if (!list) return;
    session.start(Array.from(list));
  }

  async function handleAdd() {
    await session.confirm();
    onClose();
  }

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={cardRef}
        className={`${styles.card} fade-up`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Add from a photo</div>
            <h3 id="scan-modal-title" className={styles.title}>
              Scan a shelf into your library
            </h3>
          </div>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={styles.body}>
          {phase === 'upload' && (
            <div
              className={dragging ? `${styles.dropzone} ${styles.dropzoneOver}` : styles.dropzone}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files);
              }}
            >
              <div className={styles.dropIcon}>📷</div>
              <div className={styles.dropTitle}>Drop a photo of your bookshelf</div>
              <p className={styles.dropHint}>
                We’ll read the spines and match them to the catalog. Click to choose photos — add
                several shelf angles at once.
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                // Excluding HEIC makes the iOS Photos picker transcode to JPEG on
                // selection, which the API can actually read (see LOS-161).
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => pick(e.target.files)}
              />
            </div>
          )}

          {phase === 'processing' && (
            <div>
              <div className={styles.thumbs}>
                {previews.map((src) => (
                  <div key={src} className={styles.thumb}>
                    <img src={src} alt="" />
                    <div className={styles.scanline} />
                  </div>
                ))}
              </div>
              <div className={styles.scanningLabel}>
                Scanning {previews.length} {previews.length === 1 ? 'photo' : 'photos'}…
              </div>
            </div>
          )}

          {phase === 'results' && (
            <div>
              <p className={styles.summary}>
                Found <strong>{rows.length}</strong> {rows.length === 1 ? 'book' : 'books'}.
                {rows.length > 0 && ' Tap a status to change it, or untick to skip.'}
              </p>
              <div className={styles.rows}>
                {rows.map(({ detected }) => (
                  <DetectedBookRow
                    key={detected.key}
                    detected={detected}
                    status={session.statusFor(detected.key)}
                    ticked={session.isTicked(detected.key)}
                    onCycleStatus={() => session.cycleStatus(detected.key)}
                    onToggle={() => session.toggle(detected.key)}
                  />
                ))}
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}

          {phase === 'error' && (
            <div className={styles.errorPane}>
              <p className={styles.error}>{error}</p>
              <button type="button" className={styles.btn} onClick={session.reset}>
                Try again
              </button>
            </div>
          )}
        </div>

        {phase === 'results' && rows.length > 0 && (
          <footer className={styles.footer}>
            <button type="button" className={styles.btn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={session.selectedCount === 0 || session.adding}
              onClick={handleAdd}
            >
              {session.adding ? 'Adding…' : `Add ${session.selectedCount} to library`}
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
