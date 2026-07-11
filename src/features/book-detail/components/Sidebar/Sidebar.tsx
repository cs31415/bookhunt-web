import { BookRow } from '../../../../shared/components/BookRow/BookRow';
import { getSurname } from '../../../../shared/lib/text';
import type { AuthorWork } from '../../../../normalize/author';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  authorName: string;
  authorBio: string | null;
  works: AuthorWork[];
  onOpenAuthor: () => void;
  onSelectBook: (slug: string) => void;
}

export function Sidebar({ authorName, authorBio, works, onOpenAuthor, onSelectBook }: SidebarProps) {
  if (works.length > 0) {
    return (
      <aside className={styles.aside}>
        <div className={styles.eyebrow}>More by {getSurname(authorName)}</div>
        <div className={styles.list}>
          {works.map(({ book, status }) => (
            <BookRow key={book.id} book={book} status={status} onClick={() => onSelectBook(book.slug)} />
          ))}
        </div>
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
        {authorBio && <p className={styles.bio}>{authorBio}</p>}
      </div>
    </aside>
  );
}
