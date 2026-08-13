import { SearchBar } from '../../../../shared/components/SearchBar/SearchBar';
import styles from './LibraryHeader.module.css';

export interface LibraryHeaderProps {
  total: number;
  onImportCsv: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  /**
   * Enters multi-select. Hidden while it is already on; the toolbar owns leaving it.
   *
   * Labelled "Edit" on screen, not "Select": what follows is picking books and
   * acting on them, and "Edit" says that better to someone looking at a shelf.
   * The machinery underneath is still selection — useLibrarySelection, selectedIds,
   * "Select all" in the toolbar — so grep for "select", not "edit".
   */
  onSelect?: () => void;
}

export function LibraryHeader({
  total,
  onImportCsv,
  query,
  onQueryChange,
  onSelect,
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
        {onSelect && (
          <button type="button" className={styles.secondaryButton} onClick={onSelect}>
            Edit
          </button>
        )}
        <button type="button" className={styles.addButton} onClick={onImportCsv}>
          Import from CSV
        </button>
      </div>
    </header>
  );
}
