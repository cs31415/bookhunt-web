import { Outlet } from 'react-router-dom';
import { ApiActivityIndicator } from '../components/ApiActivityIndicator/ApiActivityIndicator';
import { Footer } from './Footer/Footer';
import { MobileNav } from './MobileNav/MobileNav';
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
      <MobileNav />
    </>
  );
}
