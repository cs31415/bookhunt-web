import { SearchBar } from '../../../../shared/components/SearchBar/SearchBar';
import styles from './LibraryHeader.module.css';

export interface LibraryHeaderProps {
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
}

export function LibraryHeader({ total, query, onQueryChange }: LibraryHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.eyebrow}>Your library</div>
        <h1 className={styles.title}>
          {total} {total === 1 ? 'book' : 'books'}
        </h1>
      </div>
      {/*
        A sibling of .identity rather than nested inside it, so it can be given a
        width of its own — indented past the filter rail on desktop so it lines
        up with the grid, full width once the rail stops being a rail.

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
