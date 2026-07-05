import { BookCard } from '../../../../shared/components/BookCard/BookCard';
import { SectionHead } from '../../../../shared/components/SectionHead/SectionHead';
import type { Recommendation } from '../../../../normalize/recommendations';
import styles from './RecommendedSection.module.css';

export interface RecommendedSectionProps {
  recommendations: Recommendation[];
  onSelectBook: (slug: string) => void;
  onSeeMore: () => void;
}

export function RecommendedSection({
  recommendations,
  onSelectBook,
  onSeeMore,
}: RecommendedSectionProps) {
  if (recommendations.length === 0) return null;

  return (
    <section className={styles.section}>
      <SectionHead
        title="Recommended for you"
        action={
          <button type="button" className={styles.seeMore} onClick={onSeeMore}>
            See more
          </button>
        }
      />
      <div className={styles.grid}>
        {recommendations.map(({ book, reason }) => (
          <BookCard key={book.id} book={book} reason={reason} onClick={() => onSelectBook(book.slug)} />
        ))}
      </div>
    </section>
  );
}
