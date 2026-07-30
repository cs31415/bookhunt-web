import { useRef, useState } from 'react';
import { Modal } from '../../../../shared/components/Modal/Modal';
import { ImportRow } from '../ImportReview/ImportRow';
import type { UseScanSessionResult } from '../../hooks/useScanSession';
import modal from '../../../../shared/components/Modal/Modal.module.css';
import styles from './ScanModal.module.css';

export interface ScanModalProps {
  session: UseScanSessionResult;
  onClose: () => void;
}

export function ScanModal({ session, onClose }: ScanModalProps) {
  const { phase, previews, rows, error, addError } = session;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(list: FileList | null) {
    if (!list) return;
    session.start(Array.from(list));
  }

  // Only close when everything landed. Closing regardless would discard the
  // partial-failure message confirm() just set, leaving the reader to discover
  // the gap themselves.
  async function handleAdd() {
    if (await session.confirm()) onClose();
  }

  const footer =
    phase === 'results' && rows.length > 0 ? (
      <>
        <button type="button" className={modal.btn} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`${modal.btn} ${modal.btnPrimary}`}
          disabled={session.selectedCount === 0 || session.adding}
          onClick={handleAdd}
        >
          {session.adding ? 'Adding…' : `Add ${session.selectedCount} to library`}
        </button>
      </>
    ) : undefined;

  return (
    <Modal
      eyebrow="Add from a photo"
      title="Scan a shelf into your library"
      onClose={onClose}
      footer={footer}
    >
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
            We’ll read the spines and find each book. One shelf at a time reads most accurately —
            click to choose a photo.
          </p>
          <input
            ref={fileRef}
            type="file"
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
          <div className={styles.scanningLabel}>Scanning your photo…</div>
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
              <ImportRow
                key={detected.key}
                book={detected.book}
                status={session.statusFor(detected.key)}
                ticked={session.isTicked(detected.key)}
                onCycleStatus={() => session.cycleStatus(detected.key)}
                onToggle={() => session.toggle(detected.key)}
                note={
                  detected.tier === 'unresolved'
                    ? 'Couldn’t match this one — add it anyway?'
                    : undefined
                }
              />
            ))}
          </div>
          {addError && <p className={styles.error}>{addError}</p>}
        </div>
      )}

      {phase === 'error' && (
        <div className={styles.errorPane}>
          <p className={styles.error}>{error}</p>
          <button type="button" className={modal.btn} onClick={session.reset}>
            Try again
          </button>
        </div>
      )}
    </Modal>
  );
}
