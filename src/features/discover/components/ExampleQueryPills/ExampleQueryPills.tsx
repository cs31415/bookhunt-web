import styles from './ExampleQueryPills.module.css';

export interface ExampleQueryPillsProps {
  queries: string[];
  onPick: (query: string) => void;
}

export function ExampleQueryPills({ queries, onPick }: ExampleQueryPillsProps) {
  return (
    <div className={styles.row}>
      {queries.map((query) => (
        <button
          key={query}
          type="button"
          className={styles.pill}
          onClick={() => onPick(query)}
        >
          {query}
        </button>
      ))}
    </div>
  );
}
