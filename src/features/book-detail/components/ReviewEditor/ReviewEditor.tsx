import { useState } from 'react';
import { Stars } from '../../../../shared/components/Stars/Stars';
import { ReviewText } from '../ReviewText/ReviewText';
import styles from './ReviewEditor.module.css';

export interface ReviewEditorProps {
  userRating: number;
  initialReview: string;
  onRatingChange: (rating: number) => void;
  /** May be async. Awaited, so Save can report what actually happened. */
  onSaveReview: (review: string) => void | Promise<void>;
}

/**
 * A reader's review of one book: read as prose, written behind an Edit button.
 *
 * It used to be a textarea at all times, so a review a reader had finished
 * months ago still looked like an unfinished draft, and read in the field face
 * rather than the prose one everything else on the page is set in (LOS-369).
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = review !== savedReview;

  async function save() {
    setSaving(true);
    try {
      await onSaveReview(review);
      setSavedReview(review);
      // The review reappears as prose, with the new words in it. That says the
      // save landed better than the word "saved" did, and it is why the word is
      // gone from here.
      setEditing(false);
    } catch {
      // Left unsaid, and the box stays open. The review is still in it and Save
      // is still there, so the reader can try again -- more use than a message.
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    // Back to the last written text, so leaving discards rather than half-keeps.
    setReview(savedReview);
    setEditing(false);
  }

  /*
   * The stars stay live in both modes, on purpose. Rating is one click and
   * saves on its own; making a reader open an editor to do it would put a
   * writing act in front of a filing one.
   */
  const rating = (
    <div>
      <div className={styles.eyebrow}>Your rating</div>
      <Stars value={userRating} mode="interactive" onChange={onRatingChange} />
    </div>
  );

  if (!editing) {
    return (
      <div>
        <div className={styles.header}>
          {rating}
          <button type="button" className={styles.editButton} onClick={() => setEditing(true)}>
            {savedReview ? 'Edit' : 'Write a review'}
          </button>
        </div>
        {savedReview ? (
          <ReviewText text={savedReview} />
        ) : (
          <p className={styles.empty}>You have not reviewed this book yet.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        {rating}
        <span className={styles.charCount}>{review.length} chars</span>
      </div>
      <textarea
        className={styles.textarea}
        value={review}
        onChange={(event) => setReview(event.target.value)}
        placeholder="Your review of this book. The good, the bad, the ugly…"
        // The reader pressed Edit to get here, so the caret belongs in the box.
        autoFocus
      />
      <div className={styles.actions}>
        <button type="button" className={styles.cancelButton} onClick={cancel} disabled={saving}>
          Cancel
        </button>
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
