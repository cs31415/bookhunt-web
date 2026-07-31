import { useRef, useState } from 'react';
import { Modal } from '../../../../shared/components/Modal/Modal';
import { ImportRow } from '../ImportReview/ImportRow';
import type { UseCsvImportSessionResult } from '../../hooks/useCsvImportSession';
import modal from '../../../../shared/components/Modal/Modal.module.css';
import styles from './CsvImportModal.module.css';

export interface CsvImportModalProps {
  session: UseCsvImportSessionResult;
  onClose: () => void;
}

/** Browsers report .csv as text/csv, application/vnd.ms-excel, or nothing at all. */
function looksLikeCsv(file: File): boolean {
  return /\.csv$/i.test(file.name);
}

export function CsvImportModal({ session, onClose }: CsvImportModalProps) {
  const { phase, rows, error, warning, addError, fileName, progress } = session;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!looksLikeCsv(file)) {
      setPickError(`${file.name} isn’t a .csv file.`);
      return;
    }
    setPickError(null);
    session.start(file);
  }

  async function handleAdd() {
    if (await session.confirm()) onClose();
  }

  const importable = rows.filter((row) => row.alreadyInLibraryId === undefined);
  const alreadyOwned = rows.length - importable.length;

  const footer =
    phase === 'results' && importable.length > 0 ? (
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
      eyebrow="Import from a file"
      title="Add books from a CSV"
      onClose={onClose}
      footer={footer}
    >
      {phase === 'upload' && (
        <div>
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
            <div className={styles.dropIcon}>📄</div>
            <div className={styles.dropTitle}>Drop a CSV of your books</div>
            <p className={styles.dropHint}>
              One book per row, with a header naming the columns. Click to choose a file.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => pick(e.target.files)}
            />
          </div>

          <div className={styles.format}>
            <div className={styles.formatLabel}>Expected format</div>
            <pre className={styles.sample}>
              {'title,author,publisher,isbn\nDune,Frank Herbert,Ace,9780441013593\nHong Kong,,Frommer’s,'}
            </pre>
            <p className={styles.formatHint}>
              Only <code>title</code> is required. An <code>isbn</code> pins the exact edition and is
              by far the most reliable — a Goodreads or StoryGraph export already has one. Otherwise
              a publisher helps us pick between editions, and the author can be left blank.
            </p>
          </div>

          {pickError && <p className={styles.error}>{pickError}</p>}
        </div>
      )}

      {phase === 'processing' && (
        <div className={styles.processing}>
          <div className={styles.spinner} />
          <p>Looking up {fileName ? <strong>{fileName}</strong> : 'your books'}…</p>
          {progress && (
            <>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label="Books looked up"
              >
                <div
                  className={styles.progressBar}
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className={styles.progressLabel}>
                {progress.done} of {progress.total} books
              </p>
            </>
          )}
        </div>
      )}

      {phase === 'results' && (
        <div>
          <p className={styles.summary}>
            Found matches for <strong>{importable.length}</strong>{' '}
            {importable.length === 1 ? 'book' : 'books'}.
            {alreadyOwned > 0 && ` ${alreadyOwned} already in your library.`}
            {importable.length > 0 && ' Pick a different match, change a status, or untick to skip.'}
          </p>
          {warning && <p className={styles.warning}>{warning}</p>}
          <div className={styles.rows}>
            {rows.map((row) => (
              <ImportRow
                key={row.key}
                book={session.bookFor(row)}
                status={session.statusFor(row.key)}
                ticked={session.isTicked(row.key)}
                onCycleStatus={() => session.cycleStatus(row.key)}
                onToggle={() => session.toggle(row.key)}
                note={
                  row.candidates.length === 0
                    ? `Couldn’t find “${row.hint.title}” — add it as-is?`
                    : undefined
                }
                candidates={row.candidates.map((c) => ({ id: c.id, label: c.label }))}
                selectedCandidateId={session.selectedCandidateId(row.key)}
                onSelectCandidate={(id) => session.selectCandidate(row.key, id)}
                disabledReason={
                  row.alreadyInLibraryId !== undefined ? 'Already in your library' : undefined
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
