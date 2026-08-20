import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { isThemeChoice } from './theme';
import type { ResolvedTheme, ThemeChoice } from './theme';
import { useAuth } from '../../features/auth/AuthContext';
import { updateMe } from '../../api/users/update-me';

export interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  /** Applies the theme here and now. Writes nothing: that is what saveChoice is for. */
  setChoice: (choice: ThemeChoice) => void;
  /** Carries the current choice to the account, and so to another browser. */
  saveChoice: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Ties the local theme to the signed-in reader's stored preference.
 *
 * localStorage is the source of truth for the first paint -- the inline script
 * in index.html has already used it, and disagreeing with that would reintroduce
 * the flash it exists to prevent. The server value is what carries a choice to
 * a second browser, so it is adopted once, when a session appears.
 *
 * Must sit inside AuthProvider.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { user, updateUser } = useAuth();
  const { setChoice: setLocalChoice } = theme;

  // Adopted once per reader. Without this a reader who picks Dark here, then
  // signs in on a machine set to Light, has their choice overwritten on every
  // render rather than being able to change it.
  const adoptedFor = useRef<number | null>(null);
  const storedChoice = user?.preferences?.theme;

  useEffect(() => {
    if (!user) {
      adoptedFor.current = null;
      return;
    }
    if (adoptedFor.current === user.id) return;
    adoptedFor.current = user.id;
    if (isThemeChoice(storedChoice)) setLocalChoice(storedChoice);
  }, [user, storedChoice, setLocalChoice]);

  /**
   * Local only (LOS-299). The choice used to write itself on every click; it
   * now waits for Save, so the appearance card behaves like the profile fields
   * above it rather than being the one control that commits silently.
   *
   * A choice left unsaved still holds in this browser -- useTheme keeps it in
   * localStorage -- it simply does not follow the reader elsewhere.
   */
  const setChoice = useCallback(
    (next: ThemeChoice) => setLocalChoice(next),
    [setLocalChoice],
  );

  // Awaited, unlike the old fire-and-forget write: a reader who pressed Save is
  // owed an answer, including a failure.
  const saveChoice = useCallback(async () => {
    if (!user) return;
    const { user: updated } = await updateMe({ preferences: { theme: theme.choice } });
    updateUser({ preferences: updated.preferences });
  }, [user, updateUser, theme.choice]);

  return (
    <ThemeContext.Provider value={{ ...theme, setChoice, saveChoice }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider is idiomatic; only affects HMR granularity
export function useThemeChoice(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemeChoice must be used inside ThemeProvider');
  return value;
}
