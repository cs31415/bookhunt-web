import type { ReactNode } from 'react';
import type { BookDetail } from '../../../../normalize/book-detail';
import styles from './SpecificationsCard.module.css';

export interface SpecificationsCardProps {
  book: BookDetail;
  onSubjectClick: (subject: string) => void;
}

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
          {book.subjects.map((subject) => (
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
