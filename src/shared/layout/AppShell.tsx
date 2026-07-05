import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getHealth } from '../../api/health/get-health';
import { Footer } from './Footer/Footer';
import { MobileNav } from './MobileNav/MobileNav';
import { TopBar } from './TopBar/TopBar';
import styles from './AppShell.module.css';

// Dev-only API connectivity check for Phase 1A verification.
function DevHealthCheck() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking');

  useEffect(() => {
    getHealth()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('unreachable'));
  }, []);

  return <div data-testid="dev-health-check">API: {status}</div>;
}

export function AppShell() {
  return (
    <>
      <TopBar />
      {import.meta.env.DEV && <DevHealthCheck />}
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}
