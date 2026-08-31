import { Stars } from '../../../../shared/components/Stars/Stars';
import { RichText } from '../../../../shared/lib/rich-text';
import styles from './VisitorReview.module.css';

export interface VisitorReviewProps {
  /** Null when they wrote none, and equally when they did not publish it. */
  review: string | null;
  userRating: number | null;
}

/**
 * Another reader's review of this book, read-only (LOS-360).
 *
 * No editor, disabled or otherwise. There is nothing here for the reader to do,
 * and a greyed-out box would suggest there might be.
 *
 * A review they never wrote and one they chose not to publish look the same,
 * and that is deliberate rather than a gap: the gate is in SQL, so both arrive
 * as null and neither this component nor a visitor can tell them apart.
 */
export function VisitorReview({ review, userRating }: VisitorReviewProps) {
  if (!review && !userRating) {
    return <p className={styles.empty}>Nothing shared for this book.</p>;
  }

  return (
    <div>
      {userRating != null && userRating > 0 && (
        <div className={styles.rating}>
          <Stars value={userRating} mode="display" />
          <span className={styles.ratingValue}>{userRating.toFixed(1)}</span>
        </div>
      )}
      {review && <RichText className={styles.review} text={review} />}
    </div>
  );
}
