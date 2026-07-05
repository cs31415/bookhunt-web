import { BookCard } from '../../../../shared/components/BookCard/BookCard';
import { SectionHead } from '../../../../shared/components/SectionHead/SectionHead';
import type { LibraryEntry } from '../../../../normalize/library';
import styles from './CurrentlyReadingSection.module.css';

const NOTE_PREVIEW_LENGTH = 72;

function notePreview(notes: string | null): string | undefined {
  if (!notes) return undefined;
  return notes.length > NOTE_PREVIEW_LENGTH
    ? `${notes.slice(0, NOTE_PREVIEW_LENGTH)}…`
    : notes;
}

export interface CurrentlyReadingSectionProps {
  entries: LibraryEntry[];
  onSelectBook: (slug: string) => void;
}

export function CurrentlyReadingSection({ entries, onSelectBook }: CurrentlyReadingSectionProps) {
  return (
    <section className={styles.section}>
      <SectionHead title="Currently reading" />
      <div className={styles.grid}>
        {entries.map((entry) => (
          <BookCard
            key={entry.book.id}
            book={entry.book}
            status={entry.status}
            reason={notePreview(entry.notes)}
            onClick={() => onSelectBook(entry.book.slug)}
          />
        ))}
      </div>
    </section>
  );
}
