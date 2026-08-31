import { Cover } from '../../../../shared/components/Cover/Cover';
import { ActionMenu } from '../../../../shared/components/ActionMenu/ActionMenu';
import { CoverFold } from '../../../../shared/components/CoverFold/CoverFold';
import { FavoriteButton } from '../../../../shared/components/FavoriteButton/FavoriteButton';
import { Stars } from '../../../../shared/components/Stars/Stars';
import type { BookDetail, LibraryEntrySummary } from '../../../../normalize/book-detail';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import { readTime } from '../../../../shared/lib/read-time';
import { RichText } from '../../../../shared/lib/rich-text';
import { Collapsible } from '../../../../shared/components/Collapsible/Collapsible';
import styles from './Hero.module.css';

export interface HeroProps {
  book: BookDetail;
  libraryEntry?: LibraryEntrySummary;
  themes: string[];
  themesLoading: boolean;
  moods: string[];
  addingToLibrary: boolean;
  onToggleLibrary: () => void;
  /** Offered as its own button once the book is in the library. */
  onRemoveFromLibrary?: () => void;
  onStatusChange: (status: LibraryStatus) => void;
  onToggleFavorite: (next: boolean) => void;
  onOpenAuthor: () => void;
  onThemeClick: (theme: string) => void;
  onMoodClick: (mood: string) => void;
}

export function Hero({
  book,
  libraryEntry,
  themes,
  themesLoading,
  moods,
  addingToLibrary,
  onToggleLibrary,
  onRemoveFromLibrary,
  onStatusChange,
  onToggleFavorite,
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
          {/*
           * The same dog-eared corner the library grid uses, so a book carries
           * one status mark everywhere — here it is also the control that
           * changes it, rather than a second thing sitting beside it.
           */}
          {libraryEntry && (
            <ActionMenu
              current={libraryEntry.status}
              onSelect={onStatusChange}
              trigger={<CoverFold status={libraryEntry.status} />}
              className={styles.statusFold}
              align="right"
            />
          )}
          {/*
           * Bottom-right, clear of the status fold, which is the same
           * arrangement the library grid uses -- a book carries its marks in the
           * same corners wherever it appears. Only once it is owned: there is no
           * entry to favourite otherwise, and Add is the control that matters.
           */}
          {libraryEntry && (
            <div className={styles.favorite}>
              <FavoriteButton
                isFavorite={libraryEntry.isFavorite}
                onToggle={onToggleFavorite}
              />
            </div>
          )}
        </div>

        {/*
         * Remove is its own button rather than an item in the status menu: it is
         * the counterpart to adding, so it takes the same slot and the same
         * styling as the add button, visible without opening anything (LOS-207).
         * The visible labels are trimmed to fit the 144px cover column on one
         * line; the accessible names keep the full phrase, which on its own out
         * of context is what "- Library" fails to convey.
         */}
        {libraryEntry ? (
          onRemoveFromLibrary && (
            <button
              type="button"
              className={styles.libraryButton}
              aria-label="Remove from library"
              onClick={onRemoveFromLibrary}
            >
              - Library
            </button>
          )
        ) : (
          <button
            type="button"
            className={styles.libraryButton}
            disabled={addingToLibrary}
            aria-label={addingToLibrary ? 'Adding…' : 'Add to library'}
            onClick={onToggleLibrary}
          >
            {addingToLibrary ? 'Adding…' : '+ Library'}
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

        {/*
          The catalog's figure alone. A reader's own score used to sit beside it
          here as well as under My review, which showed one person two of their
          own ratings on one screen and left it unclear which one counted
          (LOS-349). The review section is the one that keeps it, since that is
          where a reader is already saying what they thought.
        */}
        {book.rating != null && (
          <div className={styles.ratings}>
            <div className={styles.ratingGroup}>
              <span className={styles.eyebrow}>Average rating</span>
              <div className={styles.ratingRow}>
                <Stars value={book.rating} mode="display" />
                <span className={styles.ratingValue}>{book.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}

        {meta && <div className={styles.meta}>{meta}</div>}
        {/*
          Guarded like the other two RichText call sites. A catalog book can have
          no blurb at all -- an import that resolved against Open Library often
          brings back none -- and RichText calls .replace on what it is given.
        */}
        {book.blurb && (
          // Capped, since a Google Books description can run for paragraphs and
          // push Themes and everything under it off the screen (LOS-292).
          <Collapsible label="description" className={styles.blurbBlock}>
            <RichText className={styles.blurb} text={book.blurb} />
          </Collapsible>
        )}

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

        {moods.length > 0 && (
          <div>
            <span className={styles.eyebrow}>Mood</span>
            <div className={styles.pillRow}>
              {moods.map((mood) => (
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
