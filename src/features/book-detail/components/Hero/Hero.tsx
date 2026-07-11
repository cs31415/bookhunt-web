import { Cover } from '../../../../shared/components/Cover/Cover';
import { ActionMenu } from '../../../../shared/components/ActionMenu/ActionMenu';
import { Stars } from '../../../../shared/components/Stars/Stars';
import type { BookDetail, LibraryEntrySummary } from '../../../../normalize/book-detail';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import { readTime } from '../../../../shared/lib/read-time';
import styles from './Hero.module.css';

export interface HeroProps {
  book: BookDetail;
  libraryEntry?: LibraryEntrySummary;
  themes: string[];
  themesLoading: boolean;
  onToggleLibrary: () => void;
  onStatusChange: (status: LibraryStatus) => void;
  onRate: (rating: number) => void;
  onOpenAuthor: () => void;
  onThemeClick: (theme: string) => void;
  onMoodClick: (mood: string) => void;
}

export function Hero({
  book,
  libraryEntry,
  themes,
  themesLoading,
  onToggleLibrary,
  onStatusChange,
  onRate,
  onOpenAuthor,
  onThemeClick,
  onMoodClick,
}: HeroProps) {
  const meta = [
    book.year,
    book.pages ? `${book.pages} pages` : null,
    readTime(book.pages) ? `${readTime(book.pages)} read` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.hero}>
      <div className={styles.left}>
        <div className={styles.coverWrap}>
          <Cover book={book} width={144} />
          <button
            type="button"
            title={libraryEntry ? 'Remove from library' : 'Add to library'}
            className={libraryEntry ? styles.libButton : `${styles.libButton} ${styles.libButtonAdd}`}
            onClick={onToggleLibrary}
          >
            {libraryEntry ? '–' : '+'}
          </button>
        </div>

        {libraryEntry ? (
          <ActionMenu current={libraryEntry.status} onSelect={onStatusChange} />
        ) : (
          <button type="button" className={styles.addButton} onClick={onToggleLibrary}>
            + Add to library
          </button>
        )}

        {book.googleBooksId && (
          <a
            href={`https://books.google.com/books?id=${book.googleBooksId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.googleLink}
          >
            View on Google Books
          </a>
        )}
      </div>

      <div className={styles.right}>
        <h1 className={styles.title}>{book.title}</h1>
        <div className={styles.author}>
          by{' '}
          <button type="button" className={styles.authorLink} onClick={onOpenAuthor}>
            {book.authorName}
          </button>
        </div>

        <div className={styles.ratings}>
          {book.rating != null && (
            <div className={styles.ratingGroup}>
              <span className={styles.eyebrow}>Average rating</span>
              <div className={styles.ratingRow}>
                <Stars value={book.rating} mode="display" />
                <span className={styles.ratingValue}>{book.rating.toFixed(1)}</span>
              </div>
            </div>
          )}
          <div className={styles.ratingGroup}>
            <span className={`${styles.eyebrow} ${styles.eyebrowRust}`}>My rating</span>
            <div className={styles.ratingRow}>
              <Stars value={libraryEntry?.userRating ?? 0} mode="interactive" onChange={onRate} />
              <span className={styles.ratingValue}>
                {libraryEntry?.userRating ? libraryEntry.userRating.toFixed(1) : 'Rate it'}
              </span>
            </div>
          </div>
        </div>

        {meta && <div className={styles.meta}>{meta}</div>}
        <p className={styles.blurb}>{book.blurb}</p>

        <div className={styles.themesBlock}>
          <span className={styles.eyebrow}>Themes</span>
          {themesLoading ? (
            <div className={styles.pillRow}>
              {[150, 118, 168, 132].map((width, i) => (
                <div key={i} className={styles.skeletonPill} style={{ width }} />
              ))}
            </div>
          ) : (
            <div className={styles.pillRow}>
              {themes.map((theme) => (
                <button key={theme} type="button" className={styles.pill} onClick={() => onThemeClick(theme)}>
                  {theme}
                </button>
              ))}
            </div>
          )}
        </div>

        {book.moods.length > 0 && (
          <div>
            <span className={styles.eyebrow}>Mood</span>
            <div className={styles.pillRow}>
              {book.moods.map((mood) => (
                <button key={mood} type="button" className={styles.pill} onClick={() => onMoodClick(mood)}>
                  {mood}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
