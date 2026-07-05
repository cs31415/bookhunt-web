import { Cover } from '../../../../shared/components/Cover/Cover';
import { SectionHead } from '../../../../shared/components/SectionHead/SectionHead';
import type { LibraryEntry } from '../../../../normalize/library';
import styles from './CurrentlyReadingSection.module.css';

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
          <div
            key={entry.book.id}
            className={styles.card}
            role="button"
            tabIndex={0}
            onClick={() => onSelectBook(entry.book.slug)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelectBook(entry.book.slug);
            }}
          >
            <Cover book={entry.book} width={78} />
            <div className={styles.info}>
              <h4 className={styles.title}>{entry.book.title}</h4>
              <div className={styles.author}>{entry.book.authorName}</div>
              {entry.notes && <p className={styles.notes}>“{entry.notes}”</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
