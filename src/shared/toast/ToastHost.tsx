import { useSyncExternalStore } from 'react';
import { dismiss, getToasts, subscribe } from './toast-store';
import styles from './ToastHost.module.css';

export function ToastHost() {
  const toasts = useSyncExternalStore(subscribe, getToasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          <span className={styles.text}>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                dismiss(t.id);
                t.action!.onClick();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
