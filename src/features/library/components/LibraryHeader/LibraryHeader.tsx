import { SearchBar } from '../../../../shared/components/SearchBar/SearchBar';
import styles from './LibraryHeader.module.css';

export interface LibraryHeaderProps {
  total: number;
  onImportCsv: () => void;
  query: string;
  onQueryChange: (value: string) => void;
}

export function LibraryHeader({ total, onImportCsv, query, onQueryChange }: LibraryHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.eyebrow}>Your library</div>
        <h1 className={styles.title}>
          {total} {total === 1 ? 'book' : 'books'}
        </h1>
      </div>
      {/* Wrapper so a second import source (LOS-169) can sit alongside without
          the max-width:560px column stack going ragged. */}
      <div className={styles.actions}>
        <button type="button" className={styles.addButton} onClick={onImportCsv}>
          Import from CSV
        </button>
      </div>
      {/*
        A sibling of the two above rather than nested in .identity, which is what
        lets the column stack put it after the actions on a phone: title, then
        Import, then the field. Nested, it was always glued under the title.

        Filters the entries already in memory, so it narrows as you type with no
        request.
      */}
      <div className={styles.search}>
        <SearchBar
          value={query}
          onChange={onQueryChange}
          placeholder="Search your library by title, author or subject…"
        />
      </div>
    </header>
  );
}
