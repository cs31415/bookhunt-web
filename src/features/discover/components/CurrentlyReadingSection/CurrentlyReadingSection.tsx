import { Cover } from '../../../../shared/components/Cover/Cover';
import { SectionHead } from '../../../../shared/components/SectionHead/SectionHead';
import type { LibraryEntry } from '../../../../normalize/library';
import type { BookSummary } from '../../../../shared/types/book';
import styles from './CurrentlyReadingSection.module.css';

export interface CurrentlyReadingSectionProps {
  entries: LibraryEntry[];
  onSelectBook: (book: BookSummary) => void;
}

/**
 * The books being read now, standing on a shelf rather than laid out as cards.
 *
 * A card is a container for a book *and* things said about it — the note preview
 * it used to carry, the box that held them together. Three or four of those is a
 * lot of chrome for what is really a short list of covers. Standing them on a
 * shelf says the same thing with the artwork, which is what a reader recognises
 * their own books by, and the note stays on the book page where it is edited.
 *
 * A row rather than a grid, scrolling sideways: a shelf of books that wraps to a
 * second line is not a shelf, and this list is short by definition.
 */
export function CurrentlyReadingSection({ entries, onSelectBook }: CurrentlyReadingSectionProps) {
  return (
    <section className={styles.section}>
      <SectionHead title="Currently reading" />
      {/* Focusable so the row can be scrolled from the keyboard where it
          overflows, which a plain overflow container cannot be. */}
      <div className={styles.scroller} tabIndex={0} role="group" aria-label="Currently reading">
        <div className={styles.row}>
          {entries.map((entry) => (
            <button
              key={entry.book.id}
              type="button"
              className={styles.book}
              onClick={() => onSelectBook(entry.book)}
            >
              <Cover book={entry.book} width="100%" />
              {/* Below the shelf edge, the way a label sits under a book rather
                  than on it. */}
              <span className={styles.label}>
                <span className={styles.title}>{entry.book.title}</span>
                <span className={styles.author}>{entry.book.authorName}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
