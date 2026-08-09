import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { postLogin } from '../../api/auth/login';
import { postLogout } from '../../api/auth/logout';
import { postVerifyEmail } from '../../api/auth/verify-email';
import { mergeGuestPins } from '../../api/canned-searches/merge-guest-pins';
import { SESSION_EXPIRED_EVENT } from '../../api/auth/session-expired';
import { clearStoredUser, getStoredUser, setStoredUser } from '../../api/auth/stored-user';
import type { AuthUser } from '../../api/auth/stored-user';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Registering is not here on purpose: under the LOS-218 gate it creates no
  // session, so it changes nothing this provider owns and RegisterPage calls
  // postRegister directly. Verifying does create one.
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from the cached user so a reload keeps the reader logged in. The
  // session itself is an httpOnly cookie the browser attaches on its own, so
  // there is nothing here to read it from — which is the point (LOS-119).
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  // Shared by the two ways a session begins: signing in, and following the
  // verification link from the sign-up email.
  const startSession = useCallback(async (sessionUser: AuthUser) => {
    setStoredUser(sessionUser);
    setUser(sessionUser);

    // After the session is set, so the pin calls carry the new token. Awaited
    // rather than fired and forgotten, so Discover renders the merged pins on
    // first paint instead of visibly rearranging them a moment later. Never
    // allowed to fail the login — the reader is signed in either way (LOS-212).
    try {
      await mergeGuestPins();
    } catch {
      // Guest pins stay in localStorage and merge on the next sign-in.
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: loggedInUser } = await postLogin({ email, password });
      await startSession(loggedInUser);
    },
    [startSession],
  );

  // Carrying guest pins across matters more here than at sign-in: this is the
  // moment a brand-new account first exists, and everything the reader pinned
  // while browsing signed-out would otherwise be stranded in localStorage.
  const verifyEmail = useCallback(
    async (verificationToken: string) => {
      const { user: verifiedUser } = await postVerifyEmail({ token: verificationToken });
      await startSession(verifiedUser);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    // Only the BFF can clear an httpOnly cookie, so this is a round trip now.
    // A failed call must not strand the reader in a page they meant to leave —
    // the local state is dropped either way, and a stale cookie is harmless
    // once nothing is using it.
    try {
      await postLogout();
    } catch {
      // Signed out locally regardless.
    }
    clearStoredUser();
    setUser(null);
  }, []);

  // A session can also end without anyone asking: the cookie expires, and the
  // next call comes back 401. apiFetch announces that here so the UI stops
  // showing a reader who is no longer signed in.
  useEffect(() => {
    const handleExpiry = () => {
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiry);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiry);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, verifyEmail, logout }),
    [user, login, verifyEmail, logout],
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
