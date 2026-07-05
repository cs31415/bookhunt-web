import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getHealth } from '../../api/health/get-health';

// Dev-only API connectivity check for Phase 1A verification. Header/Footer
// chrome is added in Ticket 1B once the design system exists.
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
      {import.meta.env.DEV && <DevHealthCheck />}
      <Outlet />
    </>
  );
}
