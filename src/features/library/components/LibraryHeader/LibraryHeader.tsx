import styles from './LibraryHeader.module.css';

export interface LibraryHeaderProps {
  total: number;
  onAddFromPhoto: () => void;
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
      <button type="button" className={styles.addButton} onClick={onAddFromPhoto}>
        Add from a photo
      </button>
    </header>
  );
}
