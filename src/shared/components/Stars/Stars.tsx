import { useState } from 'react';
import styles from './Stars.module.css';

const STAR_PATH =
  'M12 2l2.9 6.26 6.9.6-5.2 4.6 1.55 6.79L12 16.9l-6.15 3.35L7.4 13.46l-5.2-4.6 6.9-.6z';

export interface StarsProps {
  value: number;
  mode: 'interactive' | 'display';
  max?: number;
  onChange?: (value: number) => void;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function Stars({ value, mode, max = 5, onChange }: StarsProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const isInteractive = mode === 'interactive';
  const displayValue = isInteractive ? (hoverIndex ?? value) : value;

  return (
    <div
      className={styles.stars}
      role={isInteractive ? 'slider' : 'img'}
      aria-label={isInteractive ? 'Rating' : `Rated ${value} out of ${max}`}
      aria-valuenow={isInteractive ? value : undefined}
      aria-valuemin={isInteractive ? 0 : undefined}
      aria-valuemax={isInteractive ? max : undefined}
      onMouseLeave={isInteractive ? () => setHoverIndex(null) : undefined}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((position) => {
        const fraction = isInteractive
          ? position <= displayValue
            ? 1
            : 0
          : clamp(Math.round(displayValue * 2) / 2 - (position - 1), 0, 1);

        return (
          <span
            key={position}
            data-testid={`star-${position}`}
            className={isInteractive ? `${styles.star} ${styles.interactive}` : styles.star}
            onMouseEnter={isInteractive ? () => setHoverIndex(position) : undefined}
            onClick={isInteractive ? () => onChange?.(position) : undefined}
          >
            <svg viewBox="0 0 24 24" className={styles.empty} aria-hidden="true">
              <path d={STAR_PATH} />
            </svg>
            <span className={styles.fillClip} style={{ width: `${fraction * 100}%` }}>
              <svg viewBox="0 0 24 24" className={styles.filled} aria-hidden="true">
                <path d={STAR_PATH} />
              </svg>
            </span>
          </span>
        );
      })}
    </div>
  );
}
