import type { ReactNode } from 'react';
import styles from './SectionHead.module.css';

export interface SectionHeadProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function SectionHead({ title, eyebrow, action }: SectionHeadProps) {
  return (
    <div className={styles.head}>
      <div className={styles.titleGroup}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h2 className={styles.title}>{title}</h2>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
