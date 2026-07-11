import { useState } from 'react';
import { SectionHead } from '../../../../shared/components/SectionHead/SectionHead';
import { RelatedCard } from './RelatedCard';
import { RelatedPicker } from './RelatedPicker';
import type { RelatedWork } from '../../hooks/useRelatedReads';
import styles from './RelatedReads.module.css';

export interface RelatedReadsProps {
  works: RelatedWork[];
  inLibrary: boolean;
  onOpenBook: (slug: string) => void;
  onRemoveRelated: (bookId: number) => void;
  onAddRelated: (bookId: number) => void;
  onAddToLibrary: (bookId: number) => void;
  onRemoveFromLibrary: (bookId: number) => void;
}

export function RelatedReads({
  works,
  inLibrary,
  onOpenBook,
  onRemoveRelated,
  onAddRelated,
  onAddToLibrary,
  onRemoveFromLibrary,
}: RelatedReadsProps) {
  const [picking, setPicking] = useState(false);

  return (
    <section className={styles.section}>
      <SectionHead
        title="Related reads"
        action={
          inLibrary ? (
            <button type="button" className={styles.pickButton} onClick={() => setPicking((v) => !v)}>
              {picking ? 'Done' : '+ Add related'}
            </button>
          ) : undefined
        }
      />

      {picking && (
        <RelatedPicker
          excludeIds={works.map((w) => w.book.id)}
          onPick={(bookId) => {
            onAddRelated(bookId);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {!inLibrary && (
        <p className={styles.hint}>
          Add this book to your library to curate its related reads — your picks live alongside the
          algorithm&rsquo;s suggestions.
        </p>
      )}

      {works.length > 0 && (
        <div className={styles.grid}>
          {works.map(({ book, source, inLibrary: bookInLibrary, status }) => (
            <RelatedCard
              key={`${source}-${book.id}`}
              book={book}
              source={source}
              inLibrary={bookInLibrary}
              status={status}
              onOpen={() => onOpenBook(book.slug)}
              onRemove={source === 'you' ? () => onRemoveRelated(book.id) : undefined}
              onToggleLibrary={() =>
                bookInLibrary ? onRemoveFromLibrary(book.id) : onAddToLibrary(book.id)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
