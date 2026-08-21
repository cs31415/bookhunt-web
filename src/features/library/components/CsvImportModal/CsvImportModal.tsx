import { useRef, useState } from 'react';
import { Modal } from '../../../../shared/components/Modal/Modal';
import {
  ALL_LIBRARY_STATUSES,
  LIBRARY_STATUS_LABELS,
} from '../../../../shared/types/library-status';
import { ImportRow } from '../ImportReview/ImportRow';
import type { UseCsvImportSessionResult } from '../../hooks/useCsvImportSession';
import modal from '../../../../shared/components/Modal/Modal.module.css';
import styles from './CsvImportModal.module.css';

export interface CsvImportModalProps {
  session: UseCsvImportSessionResult;
  onClose: () => void;
}

/**
 * The columns the parser documents, named once. Both the sample file below and
 * the LLM prompt beside it are built from this, so the two cannot drift.
 */
const CSV_HEADER = 'title,author,publisher,isbn,status,format';

const SAMPLE_CSV = [
  CSV_HEADER,
  'Dune,Frank Herbert,Ace,9780441013593,Finished,Paperback',
  'Hong Kong,,Frommer’s,,New,Ebook',
].join('\n');

/**
 * For a reader with no export to hand. `parse-csv.ts` accepts aliases, but
 * someone copying this should get the canonical header, and the status word
 * comes from the shared labels for the same reason.
 *
 * Every book is New because a photo of a shelf cannot tell what has been read.
 */
const PHOTO_PROMPT = [
  'Read the book spines in this photo and give me a CSV file.',
  '',
  'Use this header exactly:',
  CSV_HEADER,
  '',
  `One row per book. Fill in title and author from the spine. Leave publisher, isbn and format empty unless you can read them. Set status to ${LIBRARY_STATUS_LABELS.queued} for every book. Skip any spine you cannot read rather than guessing.`,
].join('\n');

/** Browsers report .csv as text/csv, application/vnd.ms-excel, or nothing at all. */
function looksLikeCsv(file: File): boolean {
  return /\.csv$/i.test(file.name);
}

export function CsvImportModal({ session, onClose }: CsvImportModalProps) {
  const { phase, rows, error, warning, addError, resolving, progress, addProgress, addedKeys } =
    session;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function pick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!looksLikeCsv(file)) {
      setPickError(`${file.name} isn’t a .csv file.`);
      return;
    }
    setPickError(null);
    setConfirmingCancel(false);
    session.start(file);
  }

  async function handleAdd() {
    if (await session.confirm()) onClose();
  }

  /**
   * Dismissing mid-lookup stops it — leaving it running would keep firing
   * requests with nothing on screen to show for them. Because that throws away
   * however many lookups are already done, it asks first.
   *
   * The prompt is inline rather than a second modal: stacking portals means
   * stacking focus traps, and a native confirm() blocks the whole page.
   */
  function handleClose() {
    if (!resolving) {
      onClose();
      return;
    }
    if (!confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    discardImport();
  }

  function discardImport() {
    setConfirmingCancel(false);
    session.cancel();
    onClose();
  }

  /**
   * Owned rows leave the list rather than sitting in it inert. On the case CSV
   * import exists to serve — re-importing an export against a library that
   * already holds most of it — they are the overwhelming majority, and scrolling
   * past hundreds of rows nobody can act on to reach the few that need a
   * decision is the entire review. The summary still counts them, so nothing
   * disappears unaccounted for.
   */
  // Books now in the library drop out too, for the same reason already-owned
  // ones do: there is nothing left to decide about them, and after a 336-row
  // import they would bury the few that failed (LOS-202).
  const importable = rows.filter(
    (row) => row.alreadyInLibraryId === undefined && !addedKeys.has(row.key),
  );
  const alreadyOwned = rows.filter((row) => row.alreadyInLibraryId !== undefined).length;
  const justAdded = addedKeys.size;

  /**
   * A row nothing matched is not a match. It stays listed, unticked, offering to
   * add what the file said as-is — which is why counting it as found made the
   * summary claim more books than the Add button was going to add.
   */
  const matched = importable.filter((row) => row.candidates.length > 0).length;
  const unfound = importable.filter((row) => row.resolved && row.candidates.length === 0).length;
  const confirming = resolving && confirmingCancel;

  const footer = confirming ? (
    <>
      <button type="button" className={modal.btn} onClick={() => setConfirmingCancel(false)}>
        Keep importing
      </button>
      <button type="button" className={`${modal.btn} ${modal.btnPrimary}`} onClick={discardImport}>
        Discard import
      </button>
    </>
  ) : phase === 'review' ? (
    <>
      <button type="button" className={modal.btn} onClick={handleClose}>
        {resolving ? 'Cancel import' : 'Cancel'}
      </button>
      <button
        type="button"
        className={`${modal.btn} ${modal.btnPrimary}`}
        disabled={session.selectedCount === 0 || session.adding || resolving}
        onClick={handleAdd}
      >
        {session.adding
          ? `Adding ${addProgress.done} of ${addProgress.total}…`
          : `Add ${session.selectedCount} to library`}
      </button>
    </>
  ) : undefined;

  return (
    <Modal
      // No eyebrow: it and the title were saying the same thing twice. The title
      // spells CSV out instead, since it is the one place the format is named.
      title="Import books from CSV (comma separated values) file"
      onClose={handleClose}
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
            {/* Kept copy-pasteable: the header is exactly what a file should
                say, with no annotation a reader might carry into their own. */}
            <pre className={styles.sample}>{SAMPLE_CSV}</pre>
            <p className={styles.formatHint}>
              {/* Listed from the shared labels, so this can't come to disagree
                  with what the parser takes or the shelves the app shows. */}
              status can be one of:{' '}
              {ALL_LIBRARY_STATUSES.map((status) => LIBRARY_STATUS_LABELS[status]).join(', ')}.
              Defaults to {LIBRARY_STATUS_LABELS.queued}.
            </p>
            {/* Named as the two that change anything. A binding is taken too --
                Goodreads exports "Binding", not "format" -- but listing every
                accepted word here would be longer than the sample above it. */}
            <p className={styles.formatHint}>
              format can be ebook, audiobook, or a binding like paperback or hardcover. A
              Goodreads “Binding” column works as-is. Defaults to a physical book.
            </p>
          </div>

          {/*
            For the reader who has nothing to export. The instruction and the
            prompt are separated the same way the format block separates its
            hint from its sample: what to do, then the thing to copy.
          */}
          <div className={styles.format}>
            <div className={styles.formatLabel}>No file to hand?</div>
            <p className={styles.formatHint}>
              You can generate this file by snapping a photo of your bookshelf and giving this
              prompt to ChatGPT or another LLM:
            </p>
            {/* Copy-pasteable, like the sample above: nothing here is an
                annotation a reader might carry into their own prompt. */}
            <pre className={`${styles.sample} ${styles.prompt}`}>{PHOTO_PROMPT}</pre>
            {/* The one part of this only the reader can get right, so it is
                said plainly rather than left to be found out from a bad file. */}
            <p className={styles.formatHint}>
              Use a clear, in-focus photo with good lighting, where book titles and author names
              are clearly visible. A blurred or dim shelf gives you a list of guesses.
            </p>
          </div>

          {/*
            Said before the file is chosen, not once the reader is already
            waiting. Each row is looked up against Google Books and Open Library,
            and Open Library is throttled to one request a second, so a few
            hundred books is genuinely minutes — production logs show 11-20s per
            batch of 20. Dismissing the modal cancels the lookup (see
            useCsvImportSession), so staying put is a real instruction, not
            reassurance.
          */}
          <p className={styles.formatHint}>
            Large files take a while — each book is looked up individually, so a few
            hundred can take several minutes. Keep this tab open until it finishes.
          </p>

          {pickError && <p className={styles.error}>{pickError}</p>}
        </div>
      )}

      {confirming && (
        <div className={styles.confirm} role="alertdialog" aria-label="Discard this import?">
          <p className={styles.confirmTitle}>Discard this import?</p>
          <p className={styles.confirmBody}>
            {progress.done} of {progress.total} books have been looked up. Discarding loses that
            work — your file is untouched, so you can start again.
          </p>
        </div>
      )}

      {phase === 'review' && !confirming && (
        <div>
          {/* The add reuses the lookup's bar rather than a second kind of
              waiting: same shape, same place, only the label differs. */}
          {resolving || session.adding ? (
            <div className={styles.status}>
              {(() => {
                const bar = session.adding ? addProgress : progress;
                const label = session.adding ? 'Books added' : 'Books looked up';
                return (
                  <>
                    <div
                      className={styles.progressTrack}
                      role="progressbar"
                      aria-valuenow={bar.done}
                      aria-valuemin={0}
                      aria-valuemax={bar.total}
                      aria-label={label}
                    >
                      <div
                        className={styles.progressBar}
                        style={{ width: `${(bar.done / Math.max(bar.total, 1)) * 100}%` }}
                      />
                    </div>
                    <p className={styles.progressLabel}>
                      {session.adding
                        ? `Adding ${bar.done} of ${bar.total} books…`
                        : `Looking up ${bar.done} of ${bar.total} books…`}
                    </p>
                  </>
                );
              })()}
            </div>
          ) : (
            <p className={styles.summary}>
              {/* Once an add has run, what happened is the news -- the original
                  "found matches for 336 books" is about work already done. */}
              {justAdded > 0 ? (
                <>
                  Added <strong>{justAdded}</strong> {justAdded === 1 ? 'book' : 'books'} to your
                  library.
                </>
              ) : importable.length === 0 && alreadyOwned > 0 ? (
                <>
                  All {alreadyOwned === 1 ? 'this book is' : 'these books are'} already in your
                  library.
                </>
              ) : (
                <>
                  {matched > 0 ? (
                    <>
                      Found matches for <strong>{matched}</strong>{' '}
                      {matched === 1 ? 'book' : 'books'}.
                    </>
                  ) : (
                    <>No matches found.</>
                  )}
                  {alreadyOwned > 0 && ` ${alreadyOwned} already in your library.`}
                  {unfound > 0 && ` ${unfound} we couldn’t find.`}
                  {importable.length > 0 &&
                    ' Pick a different match, change a status, or untick to skip.'}
                </>
              )}
            </p>
          )}

          {warning && <p className={styles.warning}>{warning}</p>}

          <div className={styles.rows}>
            {importable.map((row) => (
              <ImportRow
                key={row.key}
                book={session.bookFor(row)}
                status={session.statusFor(row.key)}
                ticked={session.isTicked(row.key)}
                onCycleStatus={() => session.cycleStatus(row.key)}
                onToggle={() => session.toggle(row.key)}
                format={row.hint.format}
                note={
                  row.resolved && row.candidates.length === 0
                    ? `Couldn’t find “${row.hint.title}” — add it as-is?`
                    : // Nothing matched the title, so this is a guess: it may be
                      // the same book retitled, or another book by that author.
                      // Named rather than merely unticked, or an unticked row
                      // looks like a bug (LOS-205).
                      row.tentative
                      ? `Nothing matched “${row.hint.title}” — is this the same book?`
                      : undefined
                }
                candidates={row.candidates.map((c) => ({ id: c.id, label: c.label }))}
                selectedCandidateId={session.selectedCandidateId(row.key)}
                onSelectCandidate={(id) => session.selectCandidate(row.key, id)}
                disabledReason={!row.resolved ? 'Looking up…' : undefined}
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
