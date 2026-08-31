import { useState } from 'react';
import { Stars } from '../../../../shared/components/Stars/Stars';
import styles from './ReviewEditor.module.css';

export interface ReviewEditorProps {
  userRating: number;
  initialReview: string;
  onRatingChange: (rating: number) => void;
  /** May be async. Awaited, so Save can report what actually happened. */
  onSaveReview: (review: string) => void | Promise<void>;
}

/**
 * A reader's review of one book, saved when they say so.
 *
 * Saving used to be debounced on every keystroke, which meant the page reloaded
 * mid-sentence: the reload scrolls to the top and hands back the text as the
 * server has it, so the caret jumped and anything typed since the last debounce
 * was overwritten (LOS-353). A button fires once, when the reader has stopped.
 *
 * Mounted with `key={book.id}` by the page above, so a different book is a
 * different component. That is what keeps the box the sole owner of its text --
 * there is no syncing back from the prop to clobber an edit in progress.
 */
export function ReviewEditor({ userRating, initialReview, onRatingChange, onSaveReview }: ReviewEditorProps) {
  const [review, setReview] = useState(initialReview);
  /** The text as last written. What is in the box is compared against it. */
  const [savedReview, setSavedReview] = useState(initialReview);
  const [saving, setSaving] = useState(false);
  /**
   * Set by a save that landed, and only that. A review arriving already saved
   * from the server does not set it: the word reports an act, and a reader
   * opening a book they reviewed last month is not owed a report on it.
   */
  const [justSaved, setJustSaved] = useState(false);

  const dirty = review !== savedReview;

  async function save() {
    setSaving(true);
    try {
      await onSaveReview(review);
      setSavedReview(review);
      setJustSaved(true);
    } catch {
      // Left unsaid. The review is still in the box and Save is still there, so
      // the reader can try again -- which is more use than a message.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Your rating</div>
          <Stars value={userRating} mode="interactive" onChange={onRatingChange} />
        </div>
        <span className={styles.charCount}>
          {review.length} chars
          {/* Only after a save that landed, and only while it still describes
              what is in the box. */}
          {justSaved && !dirty && review.length > 0 && ' · saved'}
        </span>
      </div>
      <textarea
        className={styles.textarea}
        value={review}
        onChange={(event) => {
          setReview(event.target.value);
          // The report no longer describes what is in the box.
          setJustSaved(false);
        }}
        placeholder="Your review of this book. The good, the bad, the ugly…"
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={save}
          // Nothing to write, or already writing. Both would be a request that
          // changed nothing.
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
