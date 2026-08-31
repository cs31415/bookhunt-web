import { BookRow } from '../../../../shared/components/BookRow/BookRow';
import { Collapsible } from '../../../../shared/components/Collapsible/Collapsible';
import { getSurname } from '../../../../shared/lib/text';
import { RichText } from '../../../../shared/lib/rich-text';
import type { AuthorWork } from '../../../../normalize/author';
import type { BookSummary } from '../../../../shared/types/book';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  authorName: string;
  authorBio: string | null;
  works: AuthorWork[];
  onOpenAuthor: () => void;
  onSelectBook: (book: BookSummary) => void;
}

export function Sidebar({ authorName, authorBio, works, onOpenAuthor, onSelectBook }: SidebarProps) {
  if (works.length > 0) {
    return (
      <aside className={styles.aside}>
        <div className={styles.eyebrow}>More by {getSurname(authorName)}</div>
        {/*
          Capped like the description above it (LOS-367). A prolific author can
          run to dozens of works, and the whole list pushes everything below the
          sidebar off the screen -- the same complaint the blurb had in LOS-292.

          'none' rather than the default page-top scroll: this sits beside the
          main column, so collapsing it has not moved what the reader was
          reading, and jumping to the top would.
        */}
        <Collapsible label={`books by ${getSurname(authorName)}`} collapseScroll="none">
          <div className={styles.list}>
            {works.map(({ book, status }) => (
              <BookRow
                key={book.id}
                book={book}
                status={status}
                onClick={() => onSelectBook(book)}
              />
            ))}
          </div>
        </Collapsible>
      </aside>
    );
  }

  return (
    <aside className={styles.aside}>
      <div className={styles.bioCard}>
        <div className={styles.eyebrow}>About the author</div>
        <button type="button" className={styles.authorLink} onClick={onOpenAuthor}>
          {authorName}
        </button>
        {authorBio && <RichText className={styles.bio} text={authorBio} />}
      </div>
    </aside>
  );
}
