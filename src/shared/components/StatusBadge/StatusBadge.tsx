import type { LibraryStatus } from '../../types/library-status';
import { LIBRARY_STATUS_LABELS } from '../../types/library-status';
import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  status: LibraryStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>{LIBRARY_STATUS_LABELS[status]}</span>
  );
}
