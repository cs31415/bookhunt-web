import { useActivityVisibility } from './use-activity-visibility';
import styles from './ApiActivityIndicator.module.css';

/**
 * Set VITE_SHOW_ACTIVITY_SPINNER=false to turn the indicator off entirely.
 * Anything else, unset included, leaves it on.
 *
 * Read here rather than at module load so a test can stub the value, and
 * because the read costs nothing next to a render.
 */
function spinnerEnabled(): boolean {
  return import.meta.env.VITE_SHOW_ACTIVITY_SPINNER !== 'false';
}

/**
 * A hairline at the top of the window while the app is talking to the API.
 *
 * It used to be the page loader over a full-screen layer, which meant a page
 * that already had its content got a spinner thrown over the top of it on every
 * background refresh. The flash read as worse than no feedback at all.
 *
 * A first load is a different case and is not this component's job: a view with
 * nothing on it yet says so itself, through its own loading state.
 */
export function ApiActivityIndicator() {
  const { visible } = useActivityVisibility();

  if (!spinnerEnabled() || !visible) return null;

  return (
    <div className={styles.track} role="status" aria-label="Loading">
      <div className={styles.glide} />
    </div>
  );
}
