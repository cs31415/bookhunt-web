import { Cover } from '../../../../shared/components/Cover/Cover';
import {
  LIBRARY_STATUS_COLORS,
  LIBRARY_STATUS_LABELS,
} from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import type { BookSummary } from '../../../../shared/types/book';
import styles from './ImportRow.module.css';

export interface ImportCandidate {
  id: string;
  label: string;
}

export interface ImportRowProps {
  book: BookSummary;
  status: LibraryStatus;
  ticked: boolean;
  onCycleStatus: () => void;
  onToggle: () => void;
  /** Shown under the author — e.g. why nothing matched. */
  note?: string;
  /** Alternatives the reader can pick between. Omitted for photo scan. */
  candidates?: ImportCandidate[];
  selectedCandidateId?: string;
  onSelectCandidate?: (id: string) => void;
  /** Already in the library: rendered inert rather than dropped. */
  disabledReason?: string;
}

/**
 * One reviewable row of an import, shared by photo scan and CSV import.
 *
 * The candidate picker is a native `<select>` deliberately. An absolutely
 * positioned menu (ActionMenu's approach) would be clipped by the modal body's
 * `overflow-y: auto`, and a native control is keyboard- and mobile-ready for
 * free.
 */
export function ImportRow({
  book,
  status,
  ticked,
  onCycleStatus,
  onToggle,
  note,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  disabledReason,
}: ImportRowProps) {
  const inert = Boolean(disabledReason);
  const dimmed = inert || !ticked;

  return (
    <div className={dimmed ? `${styles.row} ${styles.rowOff}` : styles.row}>
      <Cover book={book} width={40} />

      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{book.title}</div>
        <div className={styles.rowAuthor}>{book.authorName}</div>
        {disabledReason && <div className={styles.rowNote}>{disabledReason}</div>}
        {!disabledReason && note && <div className={styles.rowNote}>{note}</div>}

        {!inert && candidates && candidates.length > 1 && (
          <select
            className={styles.candidates}
            aria-label={`Match for ${book.title}`}
            value={selectedCandidateId}
            onChange={(event) => onSelectCandidate?.(event.target.value)}
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {!inert && ticked && (
        <button
          type="button"
          className={styles.statusPill}
          style={{
            borderColor: LIBRARY_STATUS_COLORS[status],
            color: LIBRARY_STATUS_COLORS[status],
          }}
          onClick={onCycleStatus}
        >
          <span className={styles.statusDot} style={{ background: LIBRARY_STATUS_COLORS[status] }} />
          {LIBRARY_STATUS_LABELS[status]}
        </button>
      )}

      {!inert && (
        <button
          type="button"
          className={styles.tick}
          role="checkbox"
          aria-checked={ticked}
          aria-label={`${ticked ? 'Skip' : 'Include'} ${book.title}`}
          onClick={onToggle}
        >
          {ticked ? '✓' : '+'}
        </button>
      )}
    </div>
  );
}
