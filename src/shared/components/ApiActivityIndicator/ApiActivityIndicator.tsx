import { useSyncExternalStore } from 'react';
import { getActiveRequestCount, subscribe } from '../../../api/api-activity';
import { Loader } from '../Loader/Loader';
import styles from './ApiActivityIndicator.module.css';

/**
 * Set VITE_SHOW_ACTIVITY_SPINNER=false to turn the overlay off entirely.
 * Anything else, unset included, leaves it on.
 *
 * Read here rather than at module load so a test can stub the value, and
 * because the read costs nothing next to a render.
 */
function spinnerEnabled(): boolean {
  return import.meta.env.VITE_SHOW_ACTIVITY_SPINNER !== 'false';
}

export function ApiActivityIndicator() {
  const activeCount = useSyncExternalStore(subscribe, getActiveRequestCount);

  if (!spinnerEnabled() || activeCount === 0) return null;

  return (
    <div className={styles.indicator}>
      <Loader />
    </div>
  );
}
