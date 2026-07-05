import { LogoMark } from '../icons';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <LogoMark className={styles.logo} />
          <span className={styles.wordmark}>BookHunt</span>
          <span className={styles.tagline}>a personal reading companion</span>
        </div>
        <div className={styles.meta}>© {new Date().getFullYear()} BookHunt</div>
      </div>
    </footer>
  );
}
