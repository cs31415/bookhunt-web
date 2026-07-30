import styles from './LibraryHeader.module.css';

export interface LibraryHeaderProps {
  total: number;
  /** Omitted when photo import is disabled — the button is then not rendered. */
  onAddFromPhoto?: () => void;
}

export function LibraryHeader({ total, onAddFromPhoto }: LibraryHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Your library</div>
        <h1 className={styles.title}>
          {total} {total === 1 ? 'book' : 'books'}
        </h1>
      </div>
      {/* Wrapper so a second import source (LOS-169) can sit alongside without
          the max-width:560px column stack going ragged. */}
      <div className={styles.actions}>
        {onAddFromPhoto && (
          <button type="button" className={styles.addButton} onClick={onAddFromPhoto}>
            Add from a photo
          </button>
        )}
      </div>
    </header>
  );
}
