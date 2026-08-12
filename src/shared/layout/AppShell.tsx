import { Outlet } from 'react-router-dom';
import { ApiActivityIndicator } from '../components/ApiActivityIndicator/ApiActivityIndicator';
import { ToastHost } from '../toast/ToastHost';
import { Footer } from './Footer/Footer';
import { TopBar } from './TopBar/TopBar';
import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <>
      <ApiActivityIndicator />
      <TopBar />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <ToastHost />
    </>
  );
}
