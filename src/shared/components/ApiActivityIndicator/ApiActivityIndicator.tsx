import { useSyncExternalStore } from 'react';
import { getActiveRequestCount, subscribe } from '../../../api/api-activity';
import { Loader } from '../Loader/Loader';
import styles from './ApiActivityIndicator.module.css';

export function ApiActivityIndicator() {
  const activeCount = useSyncExternalStore(subscribe, getActiveRequestCount);

  if (activeCount === 0) return null;

  return (
    <div className={styles.indicator}>
      <Loader />
    </div>
  );
}
