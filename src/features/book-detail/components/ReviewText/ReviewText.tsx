import { RichText } from '../../../../shared/lib/rich-text';
import styles from './ReviewText.module.css';

/**
 * A written review, set as prose (LOS-369).
 *
 * Shared, so that a reader's own review reads exactly as somebody else's does.
 * It was only ever somebody else's that got rendered; a reader's own sat in a
 * textarea whether or not they were writing in it.
 */
export function ReviewText({ text, className }: { text: string; className?: string }) {
  return <RichText className={[styles.review, className].filter(Boolean).join(' ')} text={text} />;
}
