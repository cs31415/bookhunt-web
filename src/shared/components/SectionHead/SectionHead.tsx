import type { ReactNode } from 'react';
import styles from './SectionHead.module.css';

export interface SectionHeadProps {
  title: string;
  action?: ReactNode;
}

export function SectionHead({ title, action }: SectionHeadProps) {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
