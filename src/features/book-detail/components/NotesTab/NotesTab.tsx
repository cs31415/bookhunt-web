import { useState } from 'react';
import { Stars } from '../../../../shared/components/Stars/Stars';
import { useDebouncedCallback } from '../../../../shared/hooks/useDebouncedCallback';
import styles from './NotesTab.module.css';

export interface NotesTabProps {
  userRating: number;
  initialNotes: string;
  onRatingChange: (rating: number) => void;
  /**
   * May be async. The promise is awaited so "saved" can mean the write landed
   * rather than that one was started (LOS-352).
   */
  onSaveNotes: (notes: string) => void | Promise<void>;
}

export function NotesTab({ userRating, initialNotes, onRatingChange, onSaveNotes }: NotesTabProps) {
  const [notes, setNotes] = useState(initialNotes);
  /**
   * Whether what is in the box has been written, and so whether there is
   * anything to say about it.
   *
   * Starts false even for notes that arrived saved from the server: the word is
   * feedback on an act of typing, and a reader opening a book they annotated
   * last month is not owed a report on it.
   */
  const [saved, setSaved] = useState(false);

  const [syncedInitial, setSyncedInitial] = useState(initialNotes);
  if (initialNotes !== syncedInitial) {
    setSyncedInitial(initialNotes);
    setNotes(initialNotes);
    // A different book, so the last book's report does not carry over.
    setSaved(false);
  }

  /**
   * Awaited rather than fired and forgotten, so "saved" is a fact rather than a
   * hope. A failed write leaves it unsaid instead of claiming a save that did
   * not happen -- the note is still in the box, and the next keystroke tries
   * again.
   */
  const debouncedSave = useDebouncedCallback((value: string) => {
    void Promise.resolve(onSaveNotes(value))
      .then(() => setSaved(true))
      .catch(() => setSaved(false));
  }, 500);

  function handleChange(value: string) {
    setNotes(value);
    // Typing makes it unsaved again, so the word cannot linger over an edit
    // that has not been written yet.
    setSaved(false);
    debouncedSave(value);
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Your rating</div>
          <Stars value={userRating} mode="interactive" onChange={onRatingChange} />
        </div>
        <span className={styles.charCount}>
          {notes.length} chars
          {/* Only once something is written, and only while there is something
              to have written: an empty box has nothing to report. */}
          {saved && notes.length > 0 && ' · saved'}
        </span>
      </div>
      <textarea
        className={styles.textarea}
        value={notes}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Your review of this book. The good, the bad, the ugly…"
      />
    </div>
  );
}
