import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { postLogin } from '../../api/auth/login';
import { clearSession, getStoredUser, setSession } from '../../api/auth/token';
import type { AuthUser } from '../../api/auth/token';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from the cached session so a reload keeps the user logged in
  // (the token itself is read per-request by apiFetch via getToken()).
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser, token } = await postLogin({ email, password });
    setSession(token, loggedInUser);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider is idiomatic; only affects HMR granularity
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
