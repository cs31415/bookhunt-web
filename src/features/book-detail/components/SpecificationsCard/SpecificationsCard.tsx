import type { ReactNode } from 'react';
import type { BookDetail } from '../../../../normalize/book-detail';
import styles from './SpecificationsCard.module.css';

export interface SpecificationsCardProps {
  book: BookDetail;
  onSubjectClick: (subject: string) => void;
}

/**
 * A well-catalogued book carries far more subjects than a row can hold --
 * Sapiens has 21 once the API has curated them (LOS-300) -- and the tail is
 * the least useful part of the list, since providers lead with their best.
 */
const SUBJECT_LIMIT = 10;

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.spec}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{children}</div>
    </div>
  );
}

export function SpecificationsCard({ book, onSubjectClick }: SpecificationsCardProps) {
  return (
    <div className={styles.card}>
      <Spec label="Category">
        <div className={styles.pillRow}>
          {book.subjects.slice(0, SUBJECT_LIMIT).map((subject) => (
            <button key={subject} type="button" className={styles.pill} onClick={() => onSubjectClick(subject)}>
              {subject}
            </button>
          ))}
        </div>
      </Spec>
      <Spec label="Publisher">{book.publisher ?? '—'}</Spec>
      <Spec label="Language">{book.language ?? '—'}</Spec>
      <Spec label="ISBN-13">
        <span className={styles.mono}>{book.isbn13 ?? '—'}</span>
      </Spec>
    </div>
  );
}
