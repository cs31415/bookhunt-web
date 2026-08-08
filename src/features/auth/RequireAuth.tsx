import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Gate for auth-only routes: unauthenticated visitors are bounced to /login
// (LOS-81 AC6). `replace` keeps the protected URL out of history so Back doesn't
// re-trigger the redirect loop.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    // LoginPage has always read `state.from` to decide where to return to, but
    // nothing ever set it, so a reader bounced off /library landed on Discover
    // after signing in.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
