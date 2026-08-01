import { SearchBar } from '../../../../shared/components/SearchBar/SearchBar';
import styles from './LibraryHeader.module.css';

export interface LibraryHeaderProps {
  total: number;
  /** Omitted when photo import is disabled — the button is then not rendered. */
  onAddFromPhoto?: () => void;
  onImportCsv: () => void;
  query: string;
  onQueryChange: (value: string) => void;
}

export function LibraryHeader({
  total,
  onAddFromPhoto,
  onImportCsv,
  query,
  onQueryChange,
}: LibraryHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.eyebrow}>Your library</div>
        <h1 className={styles.title}>
          {total} {total === 1 ? 'book' : 'books'}
        </h1>
        {/* Filters the entries already in memory, so it narrows as you type
            with no request. */}
        <div className={styles.search}>
          <SearchBar
            value={query}
            onChange={onQueryChange}
            placeholder="Search your library by title, author or subject…"
          />
        </div>
      </div>
      {/* Wrapper so a second import source (LOS-169) can sit alongside without
          the max-width:560px column stack going ragged. */}
      <div className={styles.actions}>
        {onAddFromPhoto && (
          <button type="button" className={styles.secondaryButton} onClick={onAddFromPhoto}>
            Add from a photo
          </button>
        )}
        <button type="button" className={styles.addButton} onClick={onImportCsv}>
          Import from CSV
        </button>
      </div>
    </header>
  );
}
