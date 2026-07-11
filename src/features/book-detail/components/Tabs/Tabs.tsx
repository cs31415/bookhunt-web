import styles from './Tabs.module.css';

export type TabId = 'summary' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'notes', label: 'My notes' },
];

export interface TabsProps {
  active: TabId;
  hasNote: boolean;
  onChange: (tab: TabId) => void;
}

export function Tabs({ active, hasNote, onChange }: TabsProps) {
  return (
    <div className={styles.row}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === active ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.id === 'notes' && hasNote ? ' ·' : ''}
        </button>
      ))}
    </div>
  );
}
