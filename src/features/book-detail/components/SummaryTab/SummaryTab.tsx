import styles from './SummaryTab.module.css';

export interface SummaryTabProps {
  loading: boolean;
  error: boolean;
  summary: string | null;
  blurb: string;
  onRegenerate: () => void;
}

export function SummaryTab({ loading, error, summary, blurb, onRegenerate }: SummaryTabProps) {
  if (loading) {
    return (
      <div className={styles.skeletonWrap}>
        {[97, 93, 99, 88, 60].map((width, i) => (
          <div key={i} className={styles.skeletonLine} style={{ width: `${width}%` }} />
        ))}
        <div className={styles.spinnerRow}>
          <span className={styles.spinner} /> Writing a summary…
        </div>
      </div>
    );
  }

  if (!error && summary) {
    return <div className={styles.summary}>{summary}</div>;
  }

  return (
    <p className={styles.fallback}>
      {blurb} A fuller summary couldn&rsquo;t be generated just now —{' '}
      <button type="button" className={styles.regenerateLink} onClick={onRegenerate}>
        try Regenerate
      </button>
      .
    </p>
  );
}
