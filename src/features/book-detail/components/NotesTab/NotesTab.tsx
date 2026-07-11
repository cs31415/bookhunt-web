import { useState } from 'react';
import { Stars } from '../../../../shared/components/Stars/Stars';
import { useDebouncedCallback } from '../../../../shared/hooks/useDebouncedCallback';
import styles from './NotesTab.module.css';

export interface NotesTabProps {
  userRating: number;
  initialNotes: string;
  inLibrary: boolean;
  onRatingChange: (rating: number) => void;
  onSaveNotes: (notes: string) => void;
}

export function NotesTab({ userRating, initialNotes, inLibrary, onRatingChange, onSaveNotes }: NotesTabProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [syncedInitial, setSyncedInitial] = useState(initialNotes);
  if (initialNotes !== syncedInitial) {
    setSyncedInitial(initialNotes);
    setNotes(initialNotes);
  }

  const debouncedSave = useDebouncedCallback(onSaveNotes, 500);

  function handleChange(value: string) {
    setNotes(value);
    debouncedSave(value);
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Your rating</div>
          <Stars value={userRating} mode="interactive" onChange={onRatingChange} />
        </div>
        <span className={styles.charCount}>{notes.length} chars · saved</span>
      </div>
      <textarea
        className={styles.textarea}
        value={notes}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Quotes, page references, what it changed your mind about…"
      />
      {!inLibrary && (
        <p className={styles.hint}>
          Saving a note adds this book to your library so your notes stay alongside it.
        </p>
      )}
    </div>
  );
}
