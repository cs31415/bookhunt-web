import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Gate for auth-only routes: unauthenticated visitors are bounced to /login
// (LOS-81 AC6). `replace` keeps the protected URL out of history so Back doesn't
// re-trigger the redirect loop.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
