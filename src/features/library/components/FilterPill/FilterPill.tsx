import styles from './FilterPill.module.css';

export interface FilterPillProps {
  label: string;
  value: string;
  onClear: () => void;
}

export function FilterPill({ label, value, onClear }: FilterPillProps) {
  return (
    <div className={styles.pill}>
      <span className={styles.label}>
        {label}: <strong>{value}</strong>
      </span>
      <button
        type="button"
        className={styles.clear}
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
      >
        ×
      </button>
    </div>
  );
}
